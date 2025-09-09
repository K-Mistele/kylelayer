# @kylelayer/http-proxy

A simple HTTP proxy server built with Bun that forwards requests to a target server with configurable message processing capabilities.

## Features

- Forward HTTP requests to configurable target servers
- Pluggable message processing system for request/response modification
- Built-in colored logging with request/response correlation
- Automatic JSON formatting and pretty-printing
- Request timeout handling
- Custom header manipulation
- Environment variable configuration
- Comprehensive CLI interface
- TypeScript support with full type safety

## Installation

```bash
bun install
```

## Quick Start

1. **Start a test server** (in one terminal):
   ```bash
   bun run examples/simple-test-server.ts
   ```

2. **Run the proxy** (in another terminal):
   ```bash
   bun run index.ts --target-host localhost --target-port 8080
   ```

3. **Test the proxy** (in a third terminal):
   ```bash
   # Test basic forwarding
   curl http://localhost:3000/health
   
   # Test with POST data
   curl -X POST http://localhost:3000/echo \
     -H "Content-Type: application/json" \
     -d '{"message": "Hello proxy!"}'
   ```

The proxy will forward requests from `localhost:3000` to `localhost:8080` and log all requests in the specified format.

## Usage

### Command Line Interface

```bash
# Basic usage
bun run index.ts --target-host localhost --target-port 8080

# Custom local port
bun run index.ts --local-port 3001 --target-host api.example.com --target-port 443

# With custom timeout
bun run index.ts --target-host localhost --target-port 8080 --timeout 60000

# Disable logging
bun run index.ts --target-host localhost --target-port 8080 --no-logging

# Show help
bun run index.ts --help
```

### Environment Variables

```bash
export PROXY_LOCAL_PORT=3000
export PROXY_TARGET_HOST=localhost
export PROXY_TARGET_PORT=8080
export PROXY_TIMEOUT_MS=30000
export PROXY_ENABLE_LOGGING=true
export PROXY_LOG_LEVEL=info

bun run index.ts
```

### Programmatic Usage

```typescript
import { ProxyServer, mergeConfigs } from '@kylelayer/http-proxy';

const config = mergeConfigs({
  localPort: 3000,
  targetHost: 'localhost',
  targetPort: 8080,
  enableLogging: true,
});

const server = new ProxyServer(config);
await server.start();

// Add cleanup
process.on('SIGINT', async () => {
  await server.stop();
  process.exit(0);
});
```

### Custom Message Processors

```typescript
import { ProxyServer, MessageProcessor } from '@kylelayer/http-proxy';

const authProcessor: MessageProcessor = {
  name: 'auth-processor',
  async process(context) {
    const authHeader = context.request.headers.get('authorization');
    
    if (!authHeader) {
      return {
        shouldForward: false,
        customResponse: new Response('Unauthorized', { status: 401 }),
      };
    }
    
    // Add custom header
    const headers = new Headers(context.request.headers);
    headers.set('x-proxy-processed', 'true');
    
    const modifiedRequest = new Request(context.request.url, {
      method: context.request.method,
      headers,
      body: context.request.body,
    });
    
    return {
      shouldForward: true,
      modifiedRequest,
    };
  },
};

const server = new ProxyServer(config);
server.addProcessor(authProcessor);
await server.start();
```

## Configuration

```typescript
interface ProxyConfig {
  localPort: number;           // Port to listen on (default: 3000)
  targetHost: string;          // Target host to forward to
  targetPort: number;          // Target port to forward to
  timeoutMs: number;           // Request timeout (default: 30000)
  customHeaders?: Record<string, string>; // Headers to add
  removeHeaders?: string[];    // Headers to remove
  enableLogging: boolean;      // Enable request logging (default: true)
  logLevel: 'error' | 'warn' | 'info' | 'debug'; // Log level (default: 'info')
}
```

## Request/Response Logging

When logging is enabled, both requests and responses are logged with colored output for better readability:

### Features
- **Color-coded HTTP methods**: GET (green), POST (blue), PUT (yellow), DELETE (red), etc.
- **Color-coded status codes**: 2xx (green), 3xx (yellow), 4xx (red), 5xx (magenta)
- **Request IDs**: Short IDs to correlate requests with responses
- **Automatic JSON formatting**: Pretty-printed JSON with proper indentation
- **Request/Response indicators**: → for requests, ← for responses

### Example Output
```
[a1b2c3d4] GET /api/users →
[a1b2c3d4] 200 OK ←
    {
        "users": [
            {
                "id": 1,
                "name": "Alice"
            }
        ]
    }

[e5f6g7h8] POST /api/users →
    {
        "name": "Bob",
        "email": "bob@example.com"
    }
[e5f6g7h8] 201 Created ←
    {
        "id": 2,
        "name": "Bob",
        "email": "bob@example.com"
    }
```

### Testing Colored Logging
```bash
# Run the colored logging demo
bun run examples/test-colored-logging.ts
```

## Common Use Cases

### API Development Proxy
```bash
# Proxy API calls to development server with logging
bun run index.ts --target-host api.dev.example.com --target-port 80 --local-port 3001
```

### Local Service Testing
```bash
# Test microservices locally
bun run index.ts --target-host localhost --target-port 8080 --timeout 10000
```

### Load Testing Setup
```bash
# Proxy to load balancer with custom headers
PROXY_TARGET_HOST=lb.example.com \
PROXY_TARGET_PORT=443 \
PROXY_TIMEOUT_MS=60000 \
bun run index.ts
```

## Troubleshooting

### Common Issues

**Error: "EADDRINUSE: address already in use"**
- Change the local port: `--local-port 3001`
- Kill existing processes on that port

**Error: "ECONNREFUSED"**
- Verify target server is running
- Check target host and port settings
- Ensure network connectivity

**Request timeouts**
- Increase timeout: `--timeout 60000`
- Check target server response times

**Missing request logs**
- Ensure logging is enabled: remove `--no-logging` flag
- Check console output for errors

### Debug Mode
```bash
# Enable verbose logging
PROXY_LOG_LEVEL=debug bun run index.ts --target-host localhost --target-port 8080
```

## Testing

```bash
# Run all tests
bun test

# Run specific test file
bun test test/proxy-server.test.ts

# Run with coverage
bun test --coverage
```

## Development

The package follows Bun conventions and includes:

- TypeScript configuration with strict mode
- Comprehensive test suite using `bun:test`
- ESLint and Prettier configuration
- Zod for runtime type validation

## License

Private package for @kylelayer workspace.
