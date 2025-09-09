import { test, expect, beforeEach, afterEach, describe } from 'bun:test'
import { ProxyServer } from '../src/proxy-server.ts'
import { Socket } from 'node:net'
import { unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

describe('ProxyServer', () => {
  let server: ProxyServer
  let socketPath: string

  beforeEach(() => {
    socketPath = join(tmpdir(), `proxy-test-${Date.now()}-${Math.random().toString(36).substring(7)}.sock`)
  })

  afterEach(async () => {
    if (server?.isRunning()) {
      await server.stop()
    }
    try {
      await unlink(socketPath)
    } catch {}
  })

  test('should create and start server', async () => {
    let messageReceived = ''
    let clientId = ''

    server = new ProxyServer({
      socketPath,
      onMessage: async (message, id) => {
        messageReceived = message
        clientId = id
        return 'echo: ' + message
      }
    })

    await server.start()
    expect(server.isRunning()).toBe(true)
  })

  test('should handle client connections', (done) => {
    let connectedClientId = ''

    server = new ProxyServer({
      socketPath,
      onClientConnect: (id) => {
        connectedClientId = id
      },
      onMessage: async (message, id) => {
        expect(id).toBe(connectedClientId)
        expect(message).toBe('test message')
        done()
        return 'response'
      }
    })

    server.start().then(() => {
      const client = new Socket()
      client.connect(socketPath, () => {
        client.write('test message\n')
      })
    })
  })

  test('should handle multiple clients', (done) => {
    let messageCount = 0
    const clients: Socket[] = []

    server = new ProxyServer({
      socketPath,
      onMessage: async (message, clientId) => {
        messageCount++
        if (messageCount === 2) {
          clients.forEach(c => c.destroy())
          done()
        }
        return `response-${messageCount}`
      }
    })

    server.start().then(() => {
      // Create two clients
      for (let i = 0; i < 2; i++) {
        const client = new Socket()
        clients.push(client)
        client.connect(socketPath, () => {
          client.write(`message-${i + 1}\n`)
        })
      }
    })
  })

  test('should handle newline-delimited messages', (done) => {
    const receivedMessages: string[] = []

    server = new ProxyServer({
      socketPath,
      onMessage: async (message) => {
        receivedMessages.push(message)
        if (receivedMessages.length === 3) {
          expect(receivedMessages).toEqual(['msg1', 'msg2', 'msg3'])
          done()
        }
        return null
      }
    })

    server.start().then(() => {
      const client = new Socket()
      client.connect(socketPath, () => {
        client.write('msg1\nmsg2\nmsg3\n')
      })
    })
  })

  test('should handle incomplete messages in buffer', (done) => {
    const receivedMessages: string[] = []

    server = new ProxyServer({
      socketPath,
      onMessage: async (message) => {
        receivedMessages.push(message)
        if (receivedMessages.length === 2) {
          expect(receivedMessages).toEqual(['incomplete', 'message'])
          done()
        }
        return null
      }
    })

    server.start().then(() => {
      const client = new Socket()
      client.connect(socketPath, () => {
        // Send incomplete message first
        client.write('incomplete\nmessage')
        // Then complete it
        setTimeout(() => {
          client.write('\n')
        }, 10)
      })
    })
  })

  test('should clean up connections on stop', async () => {
    server = new ProxyServer({
      socketPath,
      onMessage: async () => null
    })

    await server.start()
    expect(server.isRunning()).toBe(true)

    const client = new Socket()
    client.connect(socketPath)

    // Wait for connection
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(server.getConnectedClients().length).toBeGreaterThan(0)

    await server.stop()
    expect(server.isRunning()).toBe(false)
    expect(server.getConnectedClients().length).toBe(0)
  })

  test('should handle errors gracefully', (done) => {
    server = new ProxyServer({
      socketPath,
      onMessage: async () => {
        throw new Error('Test error')
      }
    })

    server.on('messageError', (error, clientId, message) => {
      expect(error.message).toBe('Test error')
      expect(typeof clientId).toBe('string')
      expect(message).toBe('test')
      done()
    })

    server.start().then(() => {
      const client = new Socket()
      client.connect(socketPath, () => {
        client.write('test\n')
      })
    })
  })
})