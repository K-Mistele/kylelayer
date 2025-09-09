const server = Bun.serve({
  port: 8080,
  fetch: async (request) => {
    const url = new URL(request.url);
    
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }), {
        headers: { 'content-type': 'application/json' },
      });
    }
    
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
    
    return new Response(`Hello from test server! Path: ${url.pathname}`, {
      headers: { 'x-test-server': 'true' },
    });
  },
});

console.log(`Test server running on port 8080`);
console.log(`Visit http://localhost:8080/health for health check`);
console.log(`Visit http://localhost:8080/echo for echo endpoint`);
console.log(`Press Ctrl+C to stop`);

process.on('SIGINT', () => {
  console.log('\nStopping test server...');
  server.stop();
  process.exit(0);
});