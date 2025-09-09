import { Socket } from 'node:net'
import { EventEmitter } from 'node:events'

export interface TargetClientOptions {
  socketPath: string
  reconnectDelay?: number
  maxReconnectAttempts?: number
  messageTimeout?: number
  logger?: {
    info: (message: string, ...args: any[]) => void
    error: (message: string, ...args: any[]) => void
    debug: (message: string, ...args: any[]) => void
  }
}

interface PendingMessage {
  message: string
  resolve: (response: string) => void
  reject: (error: Error) => void
  timeoutId: NodeJS.Timeout
}

export class TargetClient extends EventEmitter {
  private socket: Socket | null = null
  private options: TargetClientOptions
  private buffer = ''
  private isConnected = false
  private isConnecting = false
  private reconnectAttempts = 0
  private messageQueue: PendingMessage[] = []
  private isShuttingDown = false

  constructor(options: TargetClientOptions) {
    super()
    this.options = {
      reconnectDelay: 1000,
      maxReconnectAttempts: 5,
      messageTimeout: 10000,
      logger: {
        info: () => {},
        error: () => {},
        debug: () => {}
      },
      ...options
    }
  }

  async connect(): Promise<void> {
    if (this.isConnected || this.isConnecting) {
      return
    }

    this.isConnecting = true
    this.socket = new Socket()

    return new Promise((resolve, reject) => {
      const connectTimeout = setTimeout(() => {
        this.handleConnectionError(new Error('Connection timeout'))
        reject(new Error('Connection timeout'))
      }, this.options.messageTimeout!)

      this.socket!.connect(this.options.socketPath, () => {
        clearTimeout(connectTimeout)
        this.handleConnection()
        resolve()
      })

      this.socket!.on('error', (error) => {
        clearTimeout(connectTimeout)
        this.handleConnectionError(error)
        if (this.isConnecting) {
          reject(error)
        }
      })

      this.socket!.on('data', (data) => {
        this.handleData(data.toString())
      })

      this.socket!.on('close', () => {
        this.handleDisconnection()
      })
    })
  }

  async disconnect(): Promise<void> {
    this.isShuttingDown = true
    
    // Reject all pending messages
    for (const pending of this.messageQueue) {
      clearTimeout(pending.timeoutId)
      pending.reject(new Error('Client is shutting down'))
    }
    this.messageQueue = []

    if (this.socket) {
      return new Promise((resolve) => {
        this.socket!.once('close', resolve)
        this.socket!.destroy()
      })
    }
  }

  async sendMessage(message: string): Promise<string> {
    if (!this.isConnected) {
      // Try to connect if not connected
      try {
        await this.connect()
      } catch (error) {
        throw new Error(`Cannot send message: not connected to target (${error})`)
      }
    }

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        const index = this.messageQueue.findIndex(p => p.timeoutId === timeoutId)
        if (index !== -1) {
          this.messageQueue.splice(index, 1)
        }
        reject(new Error('Message timeout'))
      }, this.options.messageTimeout!)

      const pendingMessage: PendingMessage = {
        message,
        resolve,
        reject,
        timeoutId
      }

      this.messageQueue.push(pendingMessage)

      try {
        // Send message with newline delimiter
        const messageWithNewline = message.endsWith('\n') ? message : message + '\n'
        this.socket!.write(messageWithNewline)
        this.options.logger?.debug(`Sent message to target: ${message}`)
      } catch (error) {
        // Remove from queue and reject
        const index = this.messageQueue.indexOf(pendingMessage)
        if (index !== -1) {
          this.messageQueue.splice(index, 1)
        }
        clearTimeout(timeoutId)
        reject(error)
      }
    })
  }

  private handleConnection(): void {
    this.isConnected = true
    this.isConnecting = false
    this.reconnectAttempts = 0
    this.options.logger?.info(`Connected to target socket: ${this.options.socketPath}`)
    this.emit('connected')
  }

  private handleConnectionError(error: Error): void {
    this.isConnecting = false
    this.options.logger?.error(`Target connection error: ${error.message}`)
    this.emit('error', error)
    
    if (!this.isShuttingDown) {
      this.scheduleReconnect()
    }
  }

  private handleData(data: string): void {
    this.buffer += data
    
    // Process complete messages (newline-delimited)
    const messages = this.buffer.split('\n')
    this.buffer = messages.pop() || '' // Keep incomplete message in buffer

    for (const message of messages) {
      if (message.trim()) {
        this.processResponse(message.trim())
      }
    }
  }

  private processResponse(response: string): void {
    this.options.logger?.debug(`Received response from target: ${response}`)
    
    // For simplicity, we assume FIFO message handling
    // In a more complex implementation, we could use message IDs for matching
    const pending = this.messageQueue.shift()
    if (pending) {
      clearTimeout(pending.timeoutId)
      pending.resolve(response)
    } else {
      this.options.logger?.debug('Received unexpected response from target (no pending messages)')
    }
  }

  private handleDisconnection(): void {
    this.isConnected = false
    this.socket = null
    this.buffer = ''
    
    // Reject all pending messages
    for (const pending of this.messageQueue) {
      clearTimeout(pending.timeoutId)
      pending.reject(new Error('Connection lost'))
    }
    this.messageQueue = []

    this.options.logger?.info('Disconnected from target socket')
    this.emit('disconnected')

    if (!this.isShuttingDown) {
      this.scheduleReconnect()
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.options.maxReconnectAttempts!) {
      this.options.logger?.error(`Max reconnect attempts (${this.options.maxReconnectAttempts}) reached`)
      this.emit('maxReconnectAttemptsReached')
      return
    }

    this.reconnectAttempts++
    const delay = this.options.reconnectDelay! * this.reconnectAttempts

    this.options.logger?.info(`Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`)

    setTimeout(() => {
      if (!this.isShuttingDown) {
        this.connect().catch((error) => {
          this.options.logger?.error(`Reconnect attempt ${this.reconnectAttempts} failed:`, error)
        })
      }
    }, delay)
  }

  public isTargetConnected(): boolean {
    return this.isConnected
  }

  public getPendingMessageCount(): number {
    return this.messageQueue.length
  }
}