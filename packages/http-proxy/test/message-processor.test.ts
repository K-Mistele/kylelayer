import { test, expect } from 'bun:test';
import { DefaultProcessor, LoggingProcessor } from '../src/message-processor.js';
import type { ProcessingContext } from '../src/message-processor.js';

const createMockContext = (request: Request): ProcessingContext => ({
  request,
  config: {
    localPort: 3000,
    targetHost: 'localhost',
    targetPort: 8080,
    timeoutMs: 30000,
    enableLogging: true,
    logLevel: 'info' as const,
  },
  timestamp: new Date(),
  requestId: 'test-id',
});

test('DefaultProcessor allows forwarding', () => {
  const processor = new DefaultProcessor();
  const request = new Request('http://localhost:3000/test');
  const context = createMockContext(request);

  const result = processor.process(context);
  expect(result.shouldForward).toBe(true);
  expect(result.modifiedRequest).toBeUndefined();
  expect(result.customResponse).toBeUndefined();
});

test('LoggingProcessor logs and allows forwarding', async () => {
  const processor = new LoggingProcessor();
  const request = new Request('http://localhost:3000/test?param=value', {
    method: 'POST',
    body: JSON.stringify({ test: 123 }),
    headers: { 'content-type': 'application/json' },
  });
  const context = createMockContext(request);

  const originalLog = console.log;
  const logs: string[] = [];
  console.log = (...args: any[]) => logs.push(args.join(' '));

  const result = await processor.process(context);
  
  console.log = originalLog;

  expect(result.shouldForward).toBe(true);
  expect(logs.length).toBeGreaterThan(0);
  expect(logs[0]).toContain('POST /test?param=value');
});

test('LoggingProcessor handles GET requests without body', async () => {
  const processor = new LoggingProcessor();
  const request = new Request('http://localhost:3000/test', { method: 'GET' });
  const context = createMockContext(request);

  const originalLog = console.log;
  const logs: string[] = [];
  console.log = (...args: any[]) => logs.push(args.join(' '));

  const result = await processor.process(context);
  
  console.log = originalLog;

  expect(result.shouldForward).toBe(true);
  expect(logs.length).toBe(1);
  expect(logs[0]).toContain('GET /test');
});