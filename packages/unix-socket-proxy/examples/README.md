# Unix Socket Proxy Examples

This directory contains example configuration files for various use cases of the Unix Socket Proxy.

## Configuration Files

### basic.config.json
Simple forwarding proxy with built-in commands enabled. Good starting point for most use cases.

**Usage:**
```bash
unix-socket-proxy --config examples/basic.config.json
```

**Features:**
- Forwards all messages to target by default
- Enables echo, status, and health commands
- Info-level logging

### debug.config.json
Debug-focused configuration that handles most messages internally with detailed logging.

**Usage:**
```bash
unix-socket-proxy --config examples/debug.config.json
```

**Features:**
- Handles messages containing "debug" internally
- Intercepts echo commands and ping/status/health requests
- Custom debug response templates
- Debug-level logging with timestamps and colors

### jsonrpc.config.json
JSON-RPC focused configuration that intercepts specific RPC methods.

**Usage:**
```bash
unix-socket-proxy --config examples/jsonrpc.config.json
```

**Features:**
- Forwards JSON-RPC messages by default
- Intercepts `ping`, `echo`, and `proxy.status` methods
- Returns proper JSON-RPC responses
- Disables built-in text-based commands

## Testing Examples

You can test these configurations using simple Unix socket clients:

### Using netcat (nc)
```bash
# Terminal 1: Start proxy with debug config
unix-socket-proxy --config examples/debug.config.json /tmp/debug-proxy.sock /tmp/target.sock

# Terminal 2: Connect and send messages
echo "debug test message" | nc -U /tmp/debug-proxy.sock
echo "echo hello world" | nc -U /tmp/debug-proxy.sock
echo "status" | nc -U /tmp/debug-proxy.sock
```

### Using socat
```bash
# Terminal 1: Start proxy
unix-socket-proxy --config examples/jsonrpc.config.json /tmp/jsonrpc-proxy.sock /tmp/target.sock

# Terminal 2: Send JSON-RPC messages
echo '{"jsonrpc":"2.0","method":"ping","id":1}' | socat - UNIX-CONNECT:/tmp/jsonrpc-proxy.sock
echo '{"jsonrpc":"2.0","method":"echo","params":"hello","id":2}' | socat - UNIX-CONNECT:/tmp/jsonrpc-proxy.sock
```

### Creating a Mock Target Server

For testing forwarding behavior, you can create a simple target server:

```bash
# Create a simple echo server on the target socket
socat UNIX-LISTEN:/tmp/target.sock,fork EXEC:cat
```

Or using netcat:
```bash
# Create a target server that echoes with prefix
while true; do
  nc -l -U /tmp/target.sock -c 'while read line; do echo "TARGET: $line"; done'
done
```

## Environment Variables

All configurations can be overridden using environment variables:

```bash
export PROXY_SOCKET_PATH="/tmp/my-proxy.sock"
export TARGET_SOCKET_PATH="/tmp/my-target.sock"
export LOG_LEVEL="debug"
export ROUTING_DEFAULT_ACTION="internal"

unix-socket-proxy --config examples/basic.config.json
```

## Command Line Overrides

You can also override configuration settings via command line:

```bash
# Override socket paths
unix-socket-proxy --config examples/basic.config.json \
  --proxy-path /tmp/override-proxy.sock \
  --target-path /tmp/override-target.sock

# Change default routing behavior
unix-socket-proxy --config examples/basic.config.json \
  --default-action internal \
  --debug
```

## Custom Configurations

To create your own configuration:

1. Copy one of the example files as a starting point
2. Modify the routing rules and response templates as needed
3. Test with the `--debug` flag to see routing decisions
4. Validate the configuration by starting the proxy

Example custom rule for handling commands that start with "cmd:":

```json
{
  "routing": {
    "rules": [
      { "type": "startsWith", "value": "cmd:" }
    ]
  },
  "responses": {
    "templates": [
      {
        "id": "cmd:",
        "template": "Command processed: ${message} (from ${clientId})"
      }
    ]
  }
}
```