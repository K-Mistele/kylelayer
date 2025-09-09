import { test, expect } from 'bun:test';
import { ProxyConfigSchema, validateConfig, mergeConfigs, createConfigFromEnv } from '../src/config.js';

test('ProxyConfigSchema validates valid config', () => {
  const validConfig = {
    localPort: 3000,
    targetHost: 'localhost',
    targetPort: 8080,
    timeoutMs: 30000,
    enableLogging: true,
    logLevel: 'info' as const,
  };

  const result = ProxyConfigSchema.parse(validConfig);
  expect(result).toEqual(validConfig);
});

test('ProxyConfigSchema applies defaults', () => {
  const minimalConfig = {
    targetHost: 'localhost',
    targetPort: 8080,
  };

  const result = ProxyConfigSchema.parse(minimalConfig);
  expect(result.localPort).toBe(3000);
  expect(result.timeoutMs).toBe(30000);
  expect(result.enableLogging).toBe(true);
  expect(result.logLevel).toBe('info');
});

test('ProxyConfigSchema validates port ranges', () => {
  expect(() => ProxyConfigSchema.parse({
    targetHost: 'localhost',
    targetPort: 0,
  })).toThrow();

  expect(() => ProxyConfigSchema.parse({
    targetHost: 'localhost',
    targetPort: 65536,
  })).toThrow();

  expect(() => ProxyConfigSchema.parse({
    localPort: -1,
    targetHost: 'localhost',
    targetPort: 8080,
  })).toThrow();
});

test('validateConfig wraps schema validation', () => {
  const validConfig = {
    targetHost: 'localhost',
    targetPort: 8080,
  };

  const result = validateConfig(validConfig);
  expect(result.targetHost).toBe('localhost');
  expect(result.targetPort).toBe(8080);
});

test('mergeConfigs combines configurations', () => {
  const config1 = {
    localPort: 3000,
    targetHost: 'localhost',
  };

  const config2 = {
    targetPort: 8080,
    timeoutMs: 5000,
  };

  const result = mergeConfigs(config1, config2);
  expect(result.localPort).toBe(3000);
  expect(result.targetHost).toBe('localhost');
  expect(result.targetPort).toBe(8080);
  expect(result.timeoutMs).toBe(5000);
});

test('createConfigFromEnv reads environment variables', () => {
  const originalEnv = process.env;
  
  process.env = {
    ...originalEnv,
    PROXY_LOCAL_PORT: '3001',
    PROXY_TARGET_HOST: 'example.com',
    PROXY_TARGET_PORT: '8080',
    PROXY_TIMEOUT_MS: '60000',
    PROXY_ENABLE_LOGGING: 'false',
    PROXY_LOG_LEVEL: 'debug',
  };

  const config = createConfigFromEnv();
  expect(config.localPort).toBe(3001);
  expect(config.targetHost).toBe('example.com');
  expect(config.targetPort).toBe(8080);
  expect(config.timeoutMs).toBe(60000);
  expect(config.enableLogging).toBe(false);
  expect(config.logLevel).toBe('debug');

  process.env = originalEnv;
});