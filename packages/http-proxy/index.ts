export { ProxyServer } from './src/proxy-server.js';
export type { ProxyConfig } from './src/config.js';
export { ProxyConfigSchema, createConfigFromEnv, validateConfig, mergeConfigs } from './src/config.js';
export type { MessageProcessor, ProcessingContext, ProcessingResult, ResponseContext } from './src/message-processor.js';
export { DefaultProcessor, LoggingProcessor } from './src/message-processor.js';

import { ProxyServer } from './src/proxy-server.js';
import { createConfigFromEnv, mergeConfigs } from './src/config.js';

const runCLI = async () => {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
HTTP Proxy Server

Usage: bun run index.ts [options]

Options:
  --local-port <port>      Local port to listen on (default: 3000)
  --target-host <host>     Target host to forward requests to (required)
  --target-port <port>     Target port to forward requests to (required)
  --timeout <ms>           Request timeout in milliseconds (default: 30000)
  --no-logging            Disable request logging
  --help, -h              Show this help message

Environment variables:
  PROXY_LOCAL_PORT        Local port to listen on
  PROXY_TARGET_HOST       Target host to forward requests to
  PROXY_TARGET_PORT       Target port to forward requests to
  PROXY_TIMEOUT_MS        Request timeout in milliseconds
  PROXY_ENABLE_LOGGING    Enable request logging (true/false)

Examples:
  bun run index.ts --target-host localhost --target-port 8080
  bun run index.ts --local-port 3001 --target-host api.example.com --target-port 443
    `);
    process.exit(0);
  }

  const parseArg = (argName: string, defaultValue?: any) => {
    const index = args.indexOf(argName);
    if (index !== -1 && index + 1 < args.length) {
      return args[index + 1];
    }
    return defaultValue;
  };

  const localPort = parseArg('--local-port');
  const targetHost = parseArg('--target-host');
  const targetPort = parseArg('--target-port');
  const timeout = parseArg('--timeout');
  const enableLogging = !args.includes('--no-logging');

  if (!targetHost) {
    console.error('Error: --target-host is required');
    console.error('Use --help for usage information');
    process.exit(1);
  }

  if (!targetPort) {
    console.error('Error: --target-port is required');
    console.error('Use --help for usage information');
    process.exit(1);
  }

  try {
    const envConfig = createConfigFromEnv();
    const cliConfig = {
      localPort: localPort ? parseInt(localPort) : undefined,
      targetHost,
      targetPort: parseInt(targetPort),
      timeoutMs: timeout ? parseInt(timeout) : undefined,
      enableLogging,
    };

    const config = mergeConfigs(envConfig, cliConfig);
    const server = new ProxyServer(config);

    const cleanup = async () => {
      console.log('\nShutting down server...');
      await server.stop();
      process.exit(0);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);

    await server.start();
  } catch (error) {
    console.error('Failed to start proxy server:', error);
    process.exit(1);
  }
};

if (import.meta.main) {
  runCLI();
}