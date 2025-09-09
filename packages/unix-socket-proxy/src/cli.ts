#!/usr/bin/env bun

import { ProxyServer } from './proxy-server.ts'
import { TargetClient } from './target-client.ts'
import { MessageRouter, RoutingRules } from './message-router.ts'
import { ResponseHandler } from './response-handler.ts'
import { ConfigManager } from './config.ts'

interface CliOptions {
  proxyPath: string
  targetPath: string
  configFile?: string
  debug?: boolean
  verbose?: boolean
  help?: boolean
  version?: boolean
  defaultAction?: 'forward' | 'internal'
  enableEcho?: boolean
  enableStatus?: boolean
  enableHealth?: boolean
}

class Logger {
  constructor(
    private level: 'silent' | 'error' | 'warn' | 'info' | 'debug' = 'info',
    private enableTimestamp = true,
    private enableColors = true
  ) {}

  private shouldLog(level: string): boolean {
    const levels = ['silent', 'error', 'warn', 'info', 'debug']
    const currentLevelIndex = levels.indexOf(this.level)
    const messageLevelIndex = levels.indexOf(level)
    return messageLevelIndex <= currentLevelIndex && currentLevelIndex > 0
  }

  private formatMessage(level: string, message: string, ...args: any[]): string {
    const timestamp = this.enableTimestamp ? new Date().toISOString() + ' ' : ''
    const levelPrefix = level.toUpperCase().padEnd(5)
    const formattedArgs = args.length > 0 ? ' ' + args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ') : ''
    
    return `${timestamp}[${levelPrefix}] ${message}${formattedArgs}`
  }

  private colorize(text: string, color: string): string {
    if (!this.enableColors) return text
    const colors: Record<string, string> = {
      red: '\x1b[31m',
      yellow: '\x1b[33m',
      blue: '\x1b[34m',
      green: '\x1b[32m',
      gray: '\x1b[90m',
      reset: '\x1b[0m'
    }
    return `${colors[color] || ''}${text}${colors.reset}`
  }

  error(message: string, ...args: any[]): void {
    if (this.shouldLog('error')) {
      console.error(this.colorize(this.formatMessage('ERROR', message, ...args), 'red'))
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.shouldLog('warn')) {
      console.warn(this.colorize(this.formatMessage('WARN', message, ...args), 'yellow'))
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.shouldLog('info')) {
      console.log(this.colorize(this.formatMessage('INFO', message, ...args), 'blue'))
    }
  }

  debug(message: string, ...args: any[]): void {
    if (this.shouldLog('debug')) {
      console.log(this.colorize(this.formatMessage('DEBUG', message, ...args), 'gray'))
    }
  }
}

class UnixSocketProxyCli {
  private proxyServer?: ProxyServer
  private targetClient?: TargetClient
  private messageRouter?: MessageRouter
  private responseHandler?: ResponseHandler
  private logger: Logger
  private isShuttingDown = false

  constructor() {
    this.logger = new Logger('info')
  }

  async run(): Promise<void> {
    try {
      const options = this.parseArguments()
      
      if (options.help) {
        this.showHelp()
        return
      }

      if (options.version) {
        this.showVersion()
        return
      }

      if (!options.proxyPath || !options.targetPath) {
        this.logger.error('Both proxy path and target path are required')
        this.showUsage()
        process.exit(1)
      }

      await this.startProxy(options)
    } catch (error) {
      this.logger.error('Failed to start proxy:', error)
      process.exit(1)
    }
  }

  private parseArguments(): CliOptions {
    const args = process.argv.slice(2)
    const options: CliOptions = {
      proxyPath: '',
      targetPath: ''
    }

    for (let i = 0; i < args.length; i++) {
      const arg = args[i]
      const nextArg = args[i + 1]

      switch (arg) {
        case '-h':
        case '--help':
          options.help = true
          break
        case '-v':
        case '--version':
          options.version = true
          break
        case '-c':
        case '--config':
          if (nextArg) {
            options.configFile = nextArg
            i++
          }
          break
        case '-d':
        case '--debug':
          options.debug = true
          break
        case '--verbose':
          options.verbose = true
          break
        case '-p':
        case '--proxy-path':
          if (nextArg) {
            options.proxyPath = nextArg
            i++
          }
          break
        case '-t':
        case '--target-path':
          if (nextArg) {
            options.targetPath = nextArg
            i++
          }
          break
        case '--default-action':
          if (nextArg && (nextArg === 'forward' || nextArg === 'internal')) {
            options.defaultAction = nextArg
            i++
          }
          break
        case '--enable-echo':
          options.enableEcho = true
          break
        case '--disable-echo':
          options.enableEcho = false
          break
        case '--enable-status':
          options.enableStatus = true
          break
        case '--disable-status':
          options.enableStatus = false
          break
        case '--enable-health':
          options.enableHealth = true
          break
        case '--disable-health':
          options.enableHealth = false
          break
        default:
          // Positional arguments: proxy-path target-path
          if (!options.proxyPath && !arg?.startsWith('-')) {
            options.proxyPath = arg || ''
          } else if (!options.targetPath && !arg?.startsWith('-')) {
            options.targetPath = arg || ''
          }
          break
      }
    }

    return options
  }

  private async startProxy(options: CliOptions): Promise<void> {
    // Set up logger
    const logLevel = options.debug ? 'debug' : options.verbose ? 'info' : 'warn'
    this.logger = new Logger(logLevel as any)

    // Load configuration
    let configManager: ConfigManager
    try {
      if (options.configFile) {
        configManager = await ConfigManager.load({
          configFile: options.configFile,
          environment: process.env as Record<string, string>,
          overrides: {
            server: options.proxyPath ? { socketPath: options.proxyPath } : undefined,
            target: options.targetPath ? { socketPath: options.targetPath } : undefined,
            routing: options.defaultAction ? { defaultAction: options.defaultAction, rules: [] } : undefined,
            responses: options.enableEcho !== undefined || options.enableStatus !== undefined || options.enableHealth !== undefined ? {
              enableEcho: options.enableEcho ?? true,
              enableStatus: options.enableStatus ?? true,
              enableHealth: options.enableHealth ?? true,
              templates: [],
              cacheResponses: true
            } : undefined
          }
        })
      } else {
        // Try to find config file automatically
        const foundConfigFile = await ConfigManager.findConfigFile()
        configManager = await ConfigManager.load({
          configFile: foundConfigFile || undefined,
          environment: process.env as Record<string, string>,
          overrides: {
            server: options.proxyPath ? { socketPath: options.proxyPath } : undefined,
            target: options.targetPath ? { socketPath: options.targetPath } : undefined,
            routing: options.defaultAction ? { defaultAction: options.defaultAction, rules: [] } : undefined,
            responses: options.enableEcho !== undefined || options.enableStatus !== undefined || options.enableHealth !== undefined ? {
              enableEcho: options.enableEcho ?? true,
              enableStatus: options.enableStatus ?? true,
              enableHealth: options.enableHealth ?? true,
              templates: [],
              cacheResponses: true
            } : undefined
          }
        })
      }
    } catch (error) {
      this.logger.error('Failed to load configuration:', error)
      process.exit(1)
    }

    const config = configManager.getConfig()
    
    // Validate configuration
    const validation = configManager.validate()
    if (!validation.valid) {
      this.logger.error('Configuration validation failed:')
      validation.errors.forEach(error => this.logger.error('  -', error))
      process.exit(1)
    }

    this.logger.info('Starting Unix Socket Proxy')
    this.logger.info(`Proxy socket: ${config.server.socketPath}`)
    this.logger.info(`Target socket: ${config.target.socketPath}`)
    this.logger.debug('Configuration:', config)

    // Initialize components
    this.targetClient = new TargetClient({
      ...config.target,
      logger: this.logger
    })

    this.responseHandler = new ResponseHandler({
      ...config.responses,
      logger: this.logger
    })

    this.messageRouter = new MessageRouter({
      defaultAction: config.routing.defaultAction,
      logger: this.logger
    })

    // Add routing rules from configuration
    for (const rule of config.routing.rules) {
      switch (rule.type) {
        case 'contains':
          this.messageRouter.addRule(RoutingRules.containsText(rule.value))
          break
        case 'regex':
          this.messageRouter.addRule(RoutingRules.matchesRegex(new RegExp(rule.value)))
          break
        case 'startsWith':
          this.messageRouter.addRule(RoutingRules.startsWith(rule.value))
          break
        case 'endsWith':
          this.messageRouter.addRule(RoutingRules.endsWith(rule.value))
          break
        case 'jsonRpcMethod':
          this.messageRouter.addRule(RoutingRules.jsonRpcMethod(rule.value))
          break
        case 'length':
          if (rule.minLength !== undefined || rule.maxLength !== undefined) {
            this.messageRouter.addRule(RoutingRules.byLength(
              rule.minLength || 0,
              rule.maxLength || Infinity
            ))
          }
          break
      }
    }

    // Add response templates from configuration
    for (const template of config.responses.templates) {
      this.responseHandler.addResponse(template.id, template.template, template.variables)
    }

    this.proxyServer = new ProxyServer({
      ...config.server,
      logger: this.logger,
      onMessage: async (message: string, clientId: string) => {
        return await this.handleMessage(message, clientId)
      }
    })

    // Set up signal handlers
    this.setupSignalHandlers()

    try {
      await this.proxyServer.start()
      this.logger.info('Proxy server started successfully')
      
      // Keep process alive
      await this.waitForShutdown()
    } catch (error) {
      this.logger.error('Failed to start proxy server:', error)
      process.exit(1)
    }
  }

  private async handleMessage(message: string, clientId: string): Promise<string | null> {
    try {
      const routingDecision = this.messageRouter!.routeMessage(message)
      
      if (routingDecision.shouldForward) {
        // Forward message to target
        this.logger.debug(`Forwarding message from ${clientId} to target`)
        const response = await this.targetClient!.sendMessage(message)
        return response
      } else {
        // Handle internally
        this.logger.debug(`Handling message from ${clientId} internally`)
        const response = this.responseHandler!.generateResponse(message, clientId)
        return response
      }
    } catch (error) {
      this.logger.error(`Error handling message from ${clientId}:`, error)
      return JSON.stringify({
        error: 'Internal proxy error',
        timestamp: new Date().toISOString()
      })
    }
  }

  private setupSignalHandlers(): void {
    const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM', 'SIGUSR2']
    
    for (const signal of signals) {
      process.on(signal, async () => {
        this.logger.info(`Received ${signal}, shutting down gracefully...`)
        await this.shutdown()
        process.exit(0)
      })
    }

    process.on('uncaughtException', (error) => {
      this.logger.error('Uncaught exception:', error)
      this.shutdown().finally(() => process.exit(1))
    })

    process.on('unhandledRejection', (reason) => {
      this.logger.error('Unhandled rejection:', reason)
      this.shutdown().finally(() => process.exit(1))
    })
  }

  private async shutdown(): Promise<void> {
    if (this.isShuttingDown) return
    this.isShuttingDown = true

    this.logger.info('Shutting down...')

    const shutdownTasks = []

    if (this.proxyServer) {
      shutdownTasks.push(this.proxyServer.stop())
    }

    if (this.targetClient) {
      shutdownTasks.push(this.targetClient.disconnect())
    }

    await Promise.allSettled(shutdownTasks)
    this.logger.info('Shutdown complete')
  }

  private async waitForShutdown(): Promise<void> {
    return new Promise((resolve) => {
      const checkShutdown = () => {
        if (this.isShuttingDown) {
          resolve()
        } else {
          setTimeout(checkShutdown, 100)
        }
      }
      checkShutdown()
    })
  }

  private showHelp(): void {
    console.log(`
Unix Socket Proxy - Forward or intercept messages between Unix domain sockets

USAGE:
  unix-socket-proxy [OPTIONS] <PROXY_PATH> <TARGET_PATH>

ARGUMENTS:
  <PROXY_PATH>    Path for the proxy socket (where clients connect)
  <TARGET_PATH>   Path of the target socket (where messages are forwarded)

OPTIONS:
  -h, --help                Show this help message
  -v, --version             Show version information
  -c, --config <FILE>       Configuration file path
  -d, --debug               Enable debug logging
      --verbose             Enable verbose logging
  -p, --proxy-path <PATH>   Proxy socket path (alternative to positional arg)
  -t, --target-path <PATH>  Target socket path (alternative to positional arg)
      --default-action <ACTION>  Default routing action: 'forward' or 'internal'
      --enable-echo         Enable echo command responses
      --disable-echo        Disable echo command responses
      --enable-status       Enable status command responses
      --disable-status      Disable status command responses
      --enable-health       Enable health check responses
      --disable-health      Disable health check responses

EXAMPLES:
  # Basic forwarding proxy
  unix-socket-proxy /tmp/proxy.sock /tmp/target.sock

  # Proxy with debug logging
  unix-socket-proxy --debug /tmp/proxy.sock /tmp/target.sock

  # Use configuration file
  unix-socket-proxy --config ./proxy.json /tmp/proxy.sock /tmp/target.sock

  # Internal handling by default
  unix-socket-proxy --default-action internal /tmp/proxy.sock /tmp/target.sock

BUILT-IN COMMANDS:
  echo <text>    Echo back the provided text
  status         Get proxy status information
  ping           Health check (returns "healthy")
  health         Same as ping

ENVIRONMENT VARIABLES:
  PROXY_SOCKET_PATH              Proxy socket path
  TARGET_SOCKET_PATH             Target socket path
  ROUTING_DEFAULT_ACTION         Default routing action
  RESPONSES_ENABLE_ECHO          Enable/disable echo responses
  LOG_LEVEL                      Logging level (silent, error, warn, info, debug)

For more information and examples, visit: https://github.com/kylelayer/unix-socket-proxy
`)
  }

  private showUsage(): void {
    console.log('Usage: unix-socket-proxy [OPTIONS] <PROXY_PATH> <TARGET_PATH>')
    console.log('Use --help for more information')
  }

  private showVersion(): void {
    console.log('Unix Socket Proxy v0.1.0')
  }
}

// Run the CLI if this file is executed directly
if (import.meta.main) {
  const cli = new UnixSocketProxyCli()
  cli.run().catch((error) => {
    console.error('CLI error:', error)
    process.exit(1)
  })
}

export { UnixSocketProxyCli }