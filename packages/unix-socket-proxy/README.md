# Unix Socket Proxy

A simple yet powerful Unix domain socket proxy CLI tool built with TypeScript and Bun. This tool allows you to intercept, inspect, and optionally handle messages between Unix socket clients and servers.

## Features

- **Message Forwarding**: Forward messages from clients to target servers
- **Internal Message Handling**: Intercept specific messages for internal processing
- **Configurable Routing**: Use rules to determine which messages to forward vs handle internally
- **Built-in Commands**: Echo, status, and health check responses
- **Custom Response Templates**: Define your own response templates with variable substitution
- **Multiple Client Support**: Handle multiple concurrent client connections
- **Graceful Shutdown**: Clean socket cleanup and proper connection termination
- **Comprehensive Logging**: Configurable logging with different levels and colors
- **JSON-RPC Support**: Special handling for JSON-RPC method routing

## Installation

Since this is a workspace package, install dependencies from the root:

```bash
bun install
```

## Quick Start

### Basic Usage

```bash
# Start a simple forwarding proxy
bun src/cli.ts /tmp/proxy.sock /tmp/target.sock

# With debug logging
bun src/cli.ts --debug /tmp/proxy.sock /tmp/target.sock

# Handle most messages internally by default
bun src/cli.ts --default-action internal /tmp/proxy.sock /tmp/target.sock
```

### Using Configuration Files

Create a configuration file (see `examples/` directory for samples):

```bash
# Use a configuration file
bun src/cli.ts --config examples/basic.config.json

# Override config with command line options
bun src/cli.ts --config examples/debug.config.json --debug
```

## Built-in Commands

The proxy supports several built-in commands that can be sent by clients:

- `echo <text>` - Returns "ECHO: <text>"
- `status` - Returns JSON status information about the proxy
- `ping` or `health` - Returns JSON health check response

Example:
```bash
echo "echo hello world" | nc -U /tmp/proxy.sock
# Returns: ECHO: hello world

echo "status" | nc -U /tmp/proxy.sock  
# Returns: {"status":"active","timestamp":"...","messageCount":1,...}
```

## Examples

### Run the Interactive Demo

```bash
# Start the demo (creates target server and proxy)
bun examples/simple-demo.ts

# In another terminal, test it:
echo "hello world" | nc -U /tmp/demo-proxy.sock    # Forwarded to target
echo "echo test" | nc -U /tmp/demo-proxy.sock      # Handled internally  
echo "status" | nc -U /tmp/demo-proxy.sock         # Internal status response
```

## Development

### Run Tests

```bash
# Run all tests
bun test

# Run specific test files
bun test test/proxy-server.test.ts
bun test test/message-router.test.ts
```

### Type Check

```bash
bun run typecheck
```

For complete configuration options and advanced usage, see the examples/ directory.
