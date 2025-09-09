import { test, expect, beforeEach, afterEach, describe } from 'bun:test'
import { ProxyServer } from '../src/proxy-server.ts'
import { TargetClient } from '../src/target-client.ts'
import { MessageRouter, RoutingRules } from '../src/message-router.ts'
import { ResponseHandler } from '../src/response-handler.ts'
import { Socket, createServer } from 'node:net'
import { unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

describe('Integration Tests', () => {
  let proxySocketPath: string
  let targetSocketPath: string
  let proxyServer: ProxyServer
  let targetServer: any
  let targetClient: TargetClient
  let messageRouter: MessageRouter
  let responseHandler: ResponseHandler

  beforeEach(() => {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(7)
    proxySocketPath = join(tmpdir(), `proxy-integration-${timestamp}-${random}.sock`)
    targetSocketPath = join(tmpdir(), `target-integration-${timestamp}-${random}.sock`)
  })

  afterEach(async () => {
    const cleanupTasks = []
    
    if (proxyServer?.isRunning()) {
      cleanupTasks.push(proxyServer.stop())
    }
    
    if (targetClient?.isTargetConnected()) {
      cleanupTasks.push(targetClient.disconnect())
    }
    
    if (targetServer) {
      cleanupTasks.push(new Promise(resolve => targetServer.close(resolve)))
    }

    await Promise.allSettled(cleanupTasks)

    // Clean up socket files
    try {
      await unlink(proxySocketPath)
    } catch {}
    try {
      await unlink(targetSocketPath)
    } catch {}
  })

  test('should forward messages to target and return responses', async () => {
    // Set up mock target server
    targetServer = createServer((socket) => {
      socket.on('data', (data) => {
        const message = data.toString().trim()
        socket.write(`Target response: ${message}\n`)
      })
    })

    await new Promise<void>(resolve => {
      targetServer.listen(targetSocketPath, resolve)
    })

    // Set up proxy components
    targetClient = new TargetClient({ socketPath: targetSocketPath })
    messageRouter = new MessageRouter({ defaultAction: 'forward' })
    responseHandler = new ResponseHandler()

    proxyServer = new ProxyServer({
      socketPath: proxySocketPath,
      onMessage: async (message, clientId) => {
        const decision = messageRouter.routeMessage(message)
        if (decision.shouldForward) {
          return await targetClient.sendMessage(message)
        } else {
          return responseHandler.generateResponse(message, clientId)
        }
      }
    })

    await proxyServer.start()

    // Test client
    const client = new Socket()
    const response = await new Promise<string>((resolve) => {
      client.connect(proxySocketPath, () => {
        client.write('hello world\n')
      })
      
      client.on('data', (data) => {
        resolve(data.toString().trim())
      })
    })

    expect(response).toBe('Target response: hello world')
    client.destroy()
  })

  test('should handle internal responses for matching rules', async () => {
    // Set up proxy with internal routing for echo commands
    messageRouter = new MessageRouter({ defaultAction: 'forward' })
    messageRouter.addRule(RoutingRules.startsWith('echo'))
    
    responseHandler = new ResponseHandler({ enableEcho: true })

    proxyServer = new ProxyServer({
      socketPath: proxySocketPath,
      onMessage: async (message, clientId) => {
        const decision = messageRouter.routeMessage(message)
        if (!decision.shouldForward) {
          return responseHandler.generateResponse(message, clientId)
        }
        return 'Should not reach here for echo commands'
      }
    })

    await proxyServer.start()

    // Test client
    const client = new Socket()
    const response = await new Promise<string>((resolve) => {
      client.connect(proxySocketPath, () => {
        client.write('echo test message\n')
      })
      
      client.on('data', (data) => {
        resolve(data.toString().trim())
      })
    })

    expect(response).toBe('ECHO: test message')
    client.destroy()
  })

  test('should handle mixed routing (some forward, some internal)', async () => {
    // Set up mock target server
    const receivedMessages: string[] = []
    targetServer = createServer((socket) => {
      socket.on('data', (data) => {
        const message = data.toString().trim()
        receivedMessages.push(message)
        socket.write(`Forwarded: ${message}\n`)
      })
    })

    await new Promise<void>(resolve => {
      targetServer.listen(targetSocketPath, resolve)
    })

    // Set up proxy with mixed routing
    targetClient = new TargetClient({ socketPath: targetSocketPath })
    messageRouter = new MessageRouter({ defaultAction: 'forward' })
    messageRouter.addRule(RoutingRules.startsWith('status'))
    
    responseHandler = new ResponseHandler({ enableStatus: true })

    proxyServer = new ProxyServer({
      socketPath: proxySocketPath,
      onMessage: async (message, clientId) => {
        const decision = messageRouter.routeMessage(message)
        if (decision.shouldForward) {
          return await targetClient.sendMessage(message)
        } else {
          return responseHandler.generateResponse(message, clientId)
        }
      }
    })

    await proxyServer.start()

    // Test forwarded message
    const client1 = new Socket()
    const forwardedResponse = await new Promise<string>((resolve) => {
      client1.connect(proxySocketPath, () => {
        client1.write('normal message\n')
      })
      client1.on('data', (data) => {
        resolve(data.toString().trim())
      })
    })

    // Test internal message
    const client2 = new Socket()
    const internalResponse = await new Promise<string>((resolve) => {
      client2.connect(proxySocketPath, () => {
        client2.write('status\n')
      })
      client2.on('data', (data) => {
        resolve(data.toString().trim())
      })
    })

    expect(forwardedResponse).toBe('Forwarded: normal message')
    expect(internalResponse).toContain('"status": "active"')
    expect(receivedMessages).toContain('normal message')
    expect(receivedMessages).not.toContain('status')

    client1.destroy()
    client2.destroy()
  })

  test('should handle target server unavailability gracefully', async () => {
    // Set up proxy without target server running
    targetClient = new TargetClient({ 
      socketPath: targetSocketPath,
      maxReconnectAttempts: 1,
      reconnectDelay: 100
    })
    
    messageRouter = new MessageRouter({ defaultAction: 'forward' })
    responseHandler = new ResponseHandler()

    let errorOccurred = false
    proxyServer = new ProxyServer({
      socketPath: proxySocketPath,
      onMessage: async (message, clientId) => {
        const decision = messageRouter.routeMessage(message)
        if (decision.shouldForward) {
          try {
            return await targetClient.sendMessage(message)
          } catch (error) {
            errorOccurred = true
            return JSON.stringify({ error: 'Target unavailable' })
          }
        } else {
          return responseHandler.generateResponse(message, clientId)
        }
      }
    })

    await proxyServer.start()

    // Test client
    const client = new Socket()
    const response = await new Promise<string>((resolve) => {
      client.connect(proxySocketPath, () => {
        client.write('test message\n')
      })
      client.on('data', (data) => {
        resolve(data.toString().trim())
      })
    })

    expect(errorOccurred).toBe(true)
    expect(response).toContain('Target unavailable')
    client.destroy()
  })

  test('should handle multiple concurrent connections', async () => {
    // Set up mock target server
    let connectionCount = 0
    targetServer = createServer((socket) => {
      connectionCount++
      socket.on('data', (data) => {
        const message = data.toString().trim()
        socket.write(`Response ${connectionCount}: ${message}\n`)
      })
    })

    await new Promise<void>(resolve => {
      targetServer.listen(targetSocketPath, resolve)
    })

    // Set up proxy
    targetClient = new TargetClient({ socketPath: targetSocketPath })
    messageRouter = new MessageRouter({ defaultAction: 'forward' })
    responseHandler = new ResponseHandler()

    proxyServer = new ProxyServer({
      socketPath: proxySocketPath,
      onMessage: async (message, clientId) => {
        const decision = messageRouter.routeMessage(message)
        if (decision.shouldForward) {
          return await targetClient.sendMessage(message)
        } else {
          return responseHandler.generateResponse(message, clientId)
        }
      }
    })

    await proxyServer.start()

    // Create multiple concurrent clients
    const clients: Socket[] = []
    const responses: string[] = []

    for (let i = 0; i < 3; i++) {
      const client = new Socket()
      clients.push(client)
      
      const responsePromise = new Promise<string>((resolve) => {
        client.connect(proxySocketPath, () => {
          client.write(`message-${i}\n`)
        })
        client.on('data', (data) => {
          resolve(data.toString().trim())
        })
      })
      
      responses.push(await responsePromise)
    }

    // All responses should be received
    expect(responses.length).toBe(3)
    responses.forEach((response, i) => {
      expect(response).toContain(`message-${i}`)
    })

    clients.forEach(client => client.destroy())
  })
})