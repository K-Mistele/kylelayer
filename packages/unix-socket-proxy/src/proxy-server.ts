import { createServer, type Server, type Socket } from 'node:net'
import { unlink, access } from 'node:fs/promises'
import { EventEmitter } from 'node:events'

export interface ProxyServerOptions {
  socketPath: string
  onMessage?: (message: string, clientId: string) => Promise<string | null>
  onClientConnect?: (clientId: string) => void
  onClientDisconnect?: (clientId: string) => void
  logger?: {
    info: (message: string, ...args: any[]) => void
    error: (message: string, ...args: any[]) => void
    debug: (message: string, ...args: any[]) => void
  }
}

export interface ClientConnection {
  id: string
  socket: Socket
  buffer: string
}

export class ProxyServer extends EventEmitter {
  private server: Server | null = null
  private clients = new Map<string, ClientConnection>()
  private options: ProxyServerOptions
  private isShuttingDown = false

  constructor(options: ProxyServerOptions) {
    super()
    this.options = {
      logger: {
        info: () => {},
        error: () => {},
        debug: () => {}
      },
      ...options
    }
  }

  async start(): Promise<void> {
    if (this.server) {
      throw new Error('Proxy server is already running')
    }

    // Clean up any existing socket file
    await this.cleanupSocket()

    this.server = createServer()
    
    this.server.on('connection', (socket) => {
      this.handleClientConnection(socket)
    })

    this.server.on('error', (error) => {
      this.options.logger?.error('Proxy server error:', error)
      this.emit('error', error)
    })

    return new Promise((resolve, reject) => {
      this.server!.listen(this.options.socketPath, () => {
        this.options.logger?.info(`Proxy server listening on ${this.options.socketPath}`)
        this.emit('listening')
        resolve()
      })

      this.server!.on('error', reject)
    })
  }

  async stop(): Promise<void> {
    if (!this.server) {
      return
    }

    this.isShuttingDown = true
    
    // Close all client connections
    for (const client of this.clients.values()) {
      client.socket.destroy()
    }
    this.clients.clear()

    return new Promise((resolve) => {
      this.server!.close(async () => {
        this.server = null
        await this.cleanupSocket()
        this.options.logger?.info('Proxy server stopped')
        this.emit('stopped')
        resolve()
      })
    })
  }

  private async cleanupSocket(): Promise<void> {
    try {
      await access(this.options.socketPath)
      await unlink(this.options.socketPath)
      this.options.logger?.debug(`Cleaned up existing socket at ${this.options.socketPath}`)
    } catch {
      // Socket doesn't exist, which is fine
    }
  }

  private handleClientConnection(socket: Socket): void {
    if (this.isShuttingDown) {
      socket.destroy()
      return
    }

    const clientId = `client_${Date.now()}_${Math.random().toString(36).substring(7)}`
    const client: ClientConnection = {
      id: clientId,
      socket,
      buffer: ''
    }

    this.clients.set(clientId, client)
    this.options.logger?.debug(`Client connected: ${clientId}`)
    this.options.onClientConnect?.(clientId)
    this.emit('clientConnect', clientId)

    socket.on('data', (data) => {
      this.handleClientData(client, data.toString())
    })

    socket.on('close', () => {
      this.handleClientDisconnect(client)
    })

    socket.on('error', (error) => {
      this.options.logger?.error(`Client ${clientId} error:`, error)
      this.handleClientDisconnect(client)
    })
  }

  private async handleClientData(client: ClientConnection, data: string): Promise<void> {
    client.buffer += data
    
    // Process complete messages (newline-delimited)
    let messages = client.buffer.split('\n')
    client.buffer = messages.pop() || '' // Keep incomplete message in buffer

    for (const message of messages) {
      if (message.trim()) {
        await this.processMessage(client, message.trim())
      }
    }
  }

  private async processMessage(client: ClientConnection, message: string): Promise<void> {
    this.options.logger?.debug(`Processing message from ${client.id}: ${message}`)
    
    try {
      // Let the configured handler process the message
      const response = await this.options.onMessage?.(message, client.id)
      
      if (response !== null && response !== undefined) {
        this.sendToClient(client, response)
      }
    } catch (error) {
      this.options.logger?.error(`Error processing message from ${client.id}:`, error)
      this.emit('messageError', error, client.id, message)
    }
  }

  private sendToClient(client: ClientConnection, message: string): void {
    try {
      // Ensure message ends with newline for proper delimiting
      const messageWithNewline = message.endsWith('\n') ? message : message + '\n'
      client.socket.write(messageWithNewline)
      this.options.logger?.debug(`Sent response to ${client.id}: ${message}`)
    } catch (error) {
      this.options.logger?.error(`Error sending message to ${client.id}:`, error)
    }
  }

  private handleClientDisconnect(client: ClientConnection): void {
    this.clients.delete(client.id)
    this.options.logger?.debug(`Client disconnected: ${client.id}`)
    this.options.onClientDisconnect?.(client.id)
    this.emit('clientDisconnect', client.id)
  }

  public getConnectedClients(): string[] {
    return Array.from(this.clients.keys())
  }

  public isRunning(): boolean {
    return this.server !== null && this.server.listening
  }
}