import { test, expect, beforeEach, afterEach } from 'bun:test';
import { ProxyServer } from '../src/proxy-server.js';
import type { MessageProcessor, ProcessingContext } from '../src/message-processor.js';

let targetServer: ReturnType<typeof Bun.serve> | null = null;
let proxyServer: ProxyServer | null = null;

const createTargetServer = (port: number) => {
  return Bun.serve({
    port,
    fetch: async (request) => {
      const url = new URL(request.url);
      
      if (url.pathname === '/echo') {
        const body = await request.text();
        return new Response(JSON.stringify({
          method: request.method,
          path: url.pathname,
          query: url.search,
          headers: Object.fromEntries(request.headers.entries()),
          body,
        }), {
          headers: { 'content-type': 'application/json' },
        });
      }
      
      if (url.pathname === '/timeout') {
        await new Promise(resolve => setTimeout(resolve, 2000));
        return new Response('timeout');
      }
      
      return new Response(`Hello from target server: ${url.pathname}`, {
        headers: { 'x-test-header': 'target-value' },
      });
    },
  });
};

beforeEach(() => {
  targetServer = createTargetServer(8080);
});

afterEach(async () => {
  if (proxyServer) {
    await proxyServer.stop();
    proxyServer = null;
  }
  if (targetServer) {
    targetServer.stop();
    targetServer = null;
  }
});

test('ProxyServer starts and stops correctly', async () => {
  proxyServer = new ProxyServer({
    localPort: 3001,
    targetHost: 'localhost',
    targetPort: 8080,
    timeoutMs: 30000,
    enableLogging: false,
    logLevel: 'info',
  });

  await proxyServer.start();
  
  const response = await fetch('http://localhost:3001/test');
  expect(response.ok).toBe(true);
  const text = await response.text();
  expect(text).toContain('Hello from target server: /test');

  await proxyServer.stop();
});

test('ProxyServer forwards requests correctly', async () => {
  proxyServer = new ProxyServer({
    localPort: 3002,
    targetHost: 'localhost',
    targetPort: 8080,
    timeoutMs: 30000,
    enableLogging: false,
    logLevel: 'info',
  });

  await proxyServer.start();
  
  const response = await fetch('http://localhost:3002/echo', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ test: 'data' }),
  });

  const data = await response.json() as any;
  expect(data.method).toBe('POST');
  expect(data.path).toBe('/echo');
  expect(data.body).toBe('{"test":"data"}');
});

test('ProxyServer handles custom processors', async () => {
  const testProcessor: MessageProcessor = {
    name: 'test-processor',
    process: () => ({
      shouldForward: true,
      modifiedRequest: new Request('http://localhost:8080/modified'),
    }),
  };

  proxyServer = new ProxyServer({
    localPort: 3003,
    targetHost: 'localhost',
    targetPort: 8080,
    timeoutMs: 30000,
    enableLogging: false,
    logLevel: 'info',
  });

  proxyServer.addProcessor(testProcessor);
  await proxyServer.start();
  
  const response = await fetch('http://localhost:3003/original');
  const text = await response.text();
  expect(text).toContain('Hello from target server: /modified');
});

test('ProxyServer handles custom responses from processors', async () => {
  const testProcessor: MessageProcessor = {
    name: 'custom-response-processor',
    process: () => ({
      shouldForward: false,
      customResponse: new Response('Custom response from processor', { status: 200 }),
    }),
  };

  proxyServer = new ProxyServer({
    localPort: 3004,
    targetHost: 'localhost',
    targetPort: 8080,
    timeoutMs: 30000,
    enableLogging: false,
    logLevel: 'info',
  });

  proxyServer.addProcessor(testProcessor);
  await proxyServer.start();
  
  const response = await fetch('http://localhost:3004/any-path');
  const text = await response.text();
  expect(text).toBe('Custom response from processor');
});

test('ProxyServer handles timeout correctly', async () => {
  proxyServer = new ProxyServer({
    localPort: 3005,
    targetHost: 'localhost',
    targetPort: 8080,
    timeoutMs: 1000,
    enableLogging: false,
    logLevel: 'info',
  });

  await proxyServer.start();
  
  const response = await fetch('http://localhost:3005/timeout');
  expect(response.status).toBe(504);
  const text = await response.text();
  expect(text).toBe('Request timeout');
});