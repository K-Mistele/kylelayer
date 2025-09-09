#!/usr/bin/env bun

/**
 * Simple demonstration of the Unix Socket Proxy
 * 
 * This script shows how to:
 * 1. Create a proxy server that intercepts certain commands
 * 2. Forward other commands to a target server
 * 3. Handle both internal responses and forwarding
 * 
 * Usage:
 *   bun examples/simple-demo.ts
 */

import { ProxyServer } from '../src/proxy-server.ts'
import { TargetClient } from '../src/target-client.ts'
import { MessageRouter, RoutingRules } from '../src/message-router.ts'
import { ResponseHandler } from '../src/response-handler.ts'
import { createServer, Socket } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { unlink } from 'node:fs/promises'

const PROXY_SOCKET = join(tmpdir(), 'demo-proxy.sock')
const TARGET_SOCKET = join(tmpdir(), 'demo-target.sock')

// Clean up any existing sockets
async function cleanup() {
  try {
    await unlink(PROXY_SOCKET)
  } catch {}
  try {
    await unlink(TARGET_SOCKET)
  } catch {}
}

async function main() {
  console.log('🚀 Starting Unix Socket Proxy Demo')
  console.log(`📡 Proxy socket: ${PROXY_SOCKET}`)
  console.log(`🎯 Target socket: ${TARGET_SOCKET}`)
  console.log()

  await cleanup()

  // 1. Create a simple target server (echo server)
  console.log('📝 Creating target echo server...')
  const targetServer = createServer((socket) => {
    console.log('🔗 Target server: client connected')
    
    socket.on('data', (data) => {
      const message = data.toString().trim()
      console.log(`🎯 Target received: "${message}"`)
      const response = `TARGET ECHO: ${message}`
      socket.write(response + '\n')
      console.log(`🎯 Target sent: "${response}"`)
    })

    socket.on('close', () => {
      console.log('🔗 Target server: client disconnected')
    })
  })

  await new Promise<void>((resolve) => {
    targetServer.listen(TARGET_SOCKET, () => {
      console.log('✅ Target server listening')
      resolve()
    })
  })

  // 2. Set up proxy components
  console.log('⚙️  Setting up proxy components...')
  
  const targetClient = new TargetClient({
    socketPath: TARGET_SOCKET,
    logger: {
      info: (msg, ...args) => console.log(`🔄 TargetClient: ${msg}`, ...args),
      error: (msg, ...args) => console.error(`❌ TargetClient: ${msg}`, ...args),
      debug: (msg, ...args) => console.log(`🔍 TargetClient: ${msg}`, ...args)
    }
  })

  const messageRouter = new MessageRouter({
    defaultAction: 'forward',
    logger: {
      info: (msg, ...args) => console.log(`🧭 Router: ${msg}`, ...args),
      error: (msg, ...args) => console.error(`❌ Router: ${msg}`, ...args),
      debug: (msg, ...args) => console.log(`🔍 Router: ${msg}`, ...args)
    }
  })

  // Route certain commands internally
  messageRouter.addRule(RoutingRules.startsWith('echo '))
  messageRouter.addRule(RoutingRules.containsText('status'))
  messageRouter.addRule(RoutingRules.containsText('ping'))

  const responseHandler = new ResponseHandler({
    enableEcho: true,
    enableStatus: true,
    enableHealth: true,
    logger: {
      info: (msg, ...args) => console.log(`💬 ResponseHandler: ${msg}`, ...args),
      error: (msg, ...args) => console.error(`❌ ResponseHandler: ${msg}`, ...args),
      debug: (msg, ...args) => console.log(`🔍 ResponseHandler: ${msg}`, ...args)
    }
  })

  // Add custom response
  responseHandler.addResponse('demo', 'This is a demo response from the proxy! Message was: ${message}')

  // 3. Create and start the proxy server
  console.log('🛡️  Starting proxy server...')
  
  const proxyServer = new ProxyServer({
    socketPath: PROXY_SOCKET,
    logger: {
      info: (msg, ...args) => console.log(`🛡️  ProxyServer: ${msg}`, ...args),
      error: (msg, ...args) => console.error(`❌ ProxyServer: ${msg}`, ...args),
      debug: (msg, ...args) => console.log(`🔍 ProxyServer: ${msg}`, ...args)
    },
    onMessage: async (message: string, clientId: string) => {
      console.log(`📨 Proxy received: "${message}" from ${clientId}`)
      
      const decision = messageRouter.routeMessage(message)
      
      if (decision.shouldForward) {
        console.log(`➡️  Forwarding to target...`)
        try {
          const response = await targetClient.sendMessage(message)
          console.log(`⬅️  Got response from target: "${response}"`)
          return response
        } catch (error) {
          console.error(`❌ Error forwarding to target:`, error)
          return `ERROR: Could not reach target server`
        }
      } else {
        console.log(`🏠 Handling internally...`)
        const response = responseHandler.generateResponse(message, clientId)
        console.log(`🏠 Internal response: "${response}"`)
        return response
      }
    },
    onClientConnect: (clientId: string) => {
      console.log(`🔗 Client connected: ${clientId}`)
    },
    onClientDisconnect: (clientId: string) => {
      console.log(`🔗 Client disconnected: ${clientId}`)
    }
  })

  await proxyServer.start()
  console.log('✅ Proxy server started')
  console.log()

  // 4. Show usage examples
  console.log('📋 Demo Commands:')
  console.log('  Try these commands with netcat or socat:')
  console.log(`  echo "hello world" | nc -U ${PROXY_SOCKET}     # Will be forwarded`)
  console.log(`  echo "echo hello" | nc -U ${PROXY_SOCKET}      # Will be handled internally`)
  console.log(`  echo "status" | nc -U ${PROXY_SOCKET}          # Will be handled internally`)
  console.log(`  echo "ping" | nc -U ${PROXY_SOCKET}            # Will be handled internally`)
  console.log(`  echo "demo" | nc -U ${PROXY_SOCKET}            # Will be handled internally`)
  console.log()

  // 5. Demonstrate programmatically
  console.log('🤖 Running automated demo...')
  
  const testCommands = [
    'hello world',     // Should be forwarded
    'echo test',       // Should be internal
    'status',          // Should be internal
    'demo',            // Should be internal
    'forward this'     // Should be forwarded
  ]

  for (const command of testCommands) {
    console.log(`\n📤 Sending: "${command}"`)
    
    const client = new Socket()
    const response = await new Promise<string>((resolve) => {
      client.connect(PROXY_SOCKET, () => {
        client.write(command + '\n')
      })
      
      client.on('data', (data) => {
        resolve(data.toString().trim())
      })
    })
    
    console.log(`📥 Response: "${response}"`)
    client.destroy()
    
    // Wait a bit between commands
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  console.log()
  console.log('✨ Demo completed!')
  console.log('💡 The proxy server is still running. You can test it manually using:')
  console.log(`   echo "your message" | nc -U ${PROXY_SOCKET}`)
  console.log('   Press Ctrl+C to stop the demo')

  // Keep running until interrupted
  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down...')
    
    const shutdownTasks = []
    
    if (proxyServer.isRunning()) {
      shutdownTasks.push(proxyServer.stop())
    }
    
    if (targetClient.isTargetConnected()) {
      shutdownTasks.push(targetClient.disconnect())
    }
    
    shutdownTasks.push(new Promise(resolve => targetServer.close(resolve)))
    
    await Promise.allSettled(shutdownTasks)
    await cleanup()
    
    console.log('✅ Shutdown complete')
    process.exit(0)
  })
}

// Run the demo
main().catch((error) => {
  console.error('❌ Demo failed:', error)
  process.exit(1)
})