import { ProxyServer } from '../src/proxy-server.js';

// Create a simple test
const testColoredLogging = async () => {
  console.log('🌈 Testing Colored Logging for HTTP Proxy\n');

  // Start a simple target server
  const targetServer = Bun.serve({
    port: 8081,
    fetch: async (request) => {
      const url = new URL(request.url);
      
      if (url.pathname === '/api/users') {
        return new Response(JSON.stringify({
          users: [
            { id: 1, name: 'Alice', email: 'alice@example.com' },
            { id: 2, name: 'Bob', email: 'bob@example.com' }
          ]
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      
      if (url.pathname === '/api/error') {
        return new Response(JSON.stringify({ error: 'Not found' }), {
          status: 404,
          headers: { 'content-type': 'application/json' },
        });
      }
      
      return new Response('Hello from target!', { status: 200 });
    },
  });

  // Start proxy server
  const proxyServer = new ProxyServer({
    localPort: 3002,
    targetHost: 'localhost',
    targetPort: 8081,
    timeoutMs: 30000,
    enableLogging: true,
    logLevel: 'info',
  });

  await proxyServer.start();

  // Make some test requests
  console.log('Making test requests...\n');

  // Test GET request
  await fetch('http://localhost:3002/api/users');
  
  // Test POST request
  await fetch('http://localhost:3002/api/users', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Charlie', email: 'charlie@example.com' })
  });
  
  // Test error response
  await fetch('http://localhost:3002/api/error');
  
  // Test PUT request
  await fetch('http://localhost:3002/api/users/1', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Alice Updated', email: 'alice.updated@example.com' })
  });
  
  // Test DELETE request
  await fetch('http://localhost:3002/api/users/1', {
    method: 'DELETE'
  });

  console.log('\n✅ Test completed! You should see colorized request/response logs above.');
  
  // Cleanup
  await proxyServer.stop();
  targetServer.stop();
};

testColoredLogging().catch(console.error);