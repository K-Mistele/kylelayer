import { z } from 'zod'
import { readFile, access } from 'node:fs/promises'
import { join } from 'node:path'

// Zod schemas for configuration validation
const routingRuleSchema = z.object({
  type: z.enum(['contains', 'regex', 'startsWith', 'endsWith', 'jsonRpcMethod', 'length']),
  value: z.string(),
  minLength: z.number().optional(),
  maxLength: z.number().optional()
})

const responseTemplateSchema = z.object({
  id: z.string(),
  template: z.string(),
  variables: z.record(z.string(), z.any()).optional()
})

const loggerConfigSchema = z.object({
  level: z.enum(['silent', 'error', 'warn', 'info', 'debug']).default('info'),
  timestamp: z.boolean().default(true),
  colors: z.boolean().default(true)
})

const serverConfigSchema = z.object({
  socketPath: z.string(),
  maxConnections: z.number().min(1).default(100),
  messageBufferSize: z.number().min(1024).default(1024 * 1024) // 1MB default
})

const targetConfigSchema = z.object({
  socketPath: z.string(),
  reconnectDelay: z.number().min(100).default(1000),
  maxReconnectAttempts: z.number().min(0).default(5),
  messageTimeout: z.number().min(1000).default(10000),
  enableConnectionPooling: z.boolean().default(false)
})

const routingConfigSchema = z.object({
  defaultAction: z.enum(['forward', 'internal']).default('forward'),
  rules: z.array(routingRuleSchema).default([])
})

const responseConfigSchema = z.object({
  enableEcho: z.boolean().default(true),
  enableStatus: z.boolean().default(true),
  enableHealth: z.boolean().default(true),
  defaultResponse: z.string().optional(),
  templates: z.array(responseTemplateSchema).default([]),
  cacheResponses: z.boolean().default(true)
})

const configSchema = z.object({
  server: serverConfigSchema,
  target: targetConfigSchema,
  routing: routingConfigSchema.optional().default({ defaultAction: 'forward', rules: [] }),
  responses: responseConfigSchema.optional().default({
    enableEcho: true,
    enableStatus: true,
    enableHealth: true,
    templates: [],
    cacheResponses: true
  }),
  logging: loggerConfigSchema.optional().default({
    level: 'info',
    timestamp: true,
    colors: true
  })
})

export type ProxyConfig = z.infer<typeof configSchema>
export type RoutingRule = z.infer<typeof routingRuleSchema>
export type ResponseTemplate = z.infer<typeof responseTemplateSchema>
export type LoggerConfig = z.infer<typeof loggerConfigSchema>

interface ConfigOptions {
  configFile?: string
  environment?: Record<string, string>
  overrides?: {
    server?: Partial<ProxyConfig['server']>
    target?: Partial<ProxyConfig['target']>
    routing?: Partial<ProxyConfig['routing']>
    responses?: Partial<ProxyConfig['responses']>
    logging?: Partial<ProxyConfig['logging']>
  }
}

export class ConfigManager {
  private config: ProxyConfig
  private configPath?: string

  constructor(config: ProxyConfig) {
    this.config = config
  }

  static async load(options: ConfigOptions = {}): Promise<ConfigManager> {
    let config: Partial<ProxyConfig> = {}

    // Load from config file if specified
    if (options.configFile) {
      try {
        await access(options.configFile)
        const configContent = await readFile(options.configFile, 'utf-8')
        const fileConfig = JSON.parse(configContent)
        config = { ...config, ...fileConfig }
      } catch (error) {
        throw new Error(`Failed to load config file ${options.configFile}: ${error}`)
      }
    }

    // Apply environment variable overrides
    if (options.environment) {
      const envConfig = ConfigManager.parseEnvironmentVariables(options.environment)
      config = ConfigManager.mergeConfigs(config, envConfig)
    }

    // Apply explicit overrides
    if (options.overrides) {
      config = ConfigManager.mergeConfigs(config, options.overrides)
    }

    // Validate and set defaults
    const validatedConfig = configSchema.parse(config)
    const manager = new ConfigManager(validatedConfig)
    manager.configPath = options.configFile
    return manager
  }

  static createDefault(proxySocketPath: string, targetSocketPath: string): ProxyConfig {
    return configSchema.parse({
      server: {
        socketPath: proxySocketPath
      },
      target: {
        socketPath: targetSocketPath
      }
    })
  }

  getConfig(): ProxyConfig {
    return this.config
  }

  getServerConfig() {
    return this.config.server
  }

  getTargetConfig() {
    return this.config.target
  }

  getRoutingConfig() {
    return this.config.routing
  }

  getResponseConfig() {
    return this.config.responses
  }

  getLoggingConfig() {
    return this.config.logging
  }

  updateConfig(updates: {
    server?: Partial<ProxyConfig['server']>
    target?: Partial<ProxyConfig['target']>
    routing?: Partial<ProxyConfig['routing']>
    responses?: Partial<ProxyConfig['responses']>
    logging?: Partial<ProxyConfig['logging']>
  }): void {
    const mergedConfig = ConfigManager.mergeConfigs(this.config, updates)
    this.config = configSchema.parse(mergedConfig)
  }

  validate(): { valid: boolean; errors: string[] } {
    try {
      configSchema.parse(this.config)
      return { valid: true, errors: [] }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          valid: false,
          errors: error.issues.map((e: any) => `${e.path.join('.')}: ${e.message}`)
        }
      }
      return { valid: false, errors: [String(error)] }
    }
  }

  private static parseEnvironmentVariables(env: Record<string, string>): Partial<ProxyConfig> {
    const config: any = {}

    // Server configuration
    if (env.PROXY_SOCKET_PATH) {
      config.server = { socketPath: env.PROXY_SOCKET_PATH }
    }
    if (env.PROXY_MAX_CONNECTIONS) {
      config.server = { ...config.server, maxConnections: parseInt(env.PROXY_MAX_CONNECTIONS, 10) }
    }

    // Target configuration
    if (env.TARGET_SOCKET_PATH) {
      config.target = { socketPath: env.TARGET_SOCKET_PATH }
    }
    if (env.TARGET_RECONNECT_DELAY) {
      config.target = { ...config.target, reconnectDelay: parseInt(env.TARGET_RECONNECT_DELAY, 10) }
    }
    if (env.TARGET_MAX_RECONNECT_ATTEMPTS) {
      config.target = { ...config.target, maxReconnectAttempts: parseInt(env.TARGET_MAX_RECONNECT_ATTEMPTS, 10) }
    }

    // Routing configuration
    if (env.ROUTING_DEFAULT_ACTION) {
      config.routing = { defaultAction: env.ROUTING_DEFAULT_ACTION }
    }

    // Response configuration
    if (env.RESPONSES_ENABLE_ECHO) {
      config.responses = { enableEcho: env.RESPONSES_ENABLE_ECHO === 'true' }
    }
    if (env.RESPONSES_ENABLE_STATUS) {
      config.responses = { ...config.responses, enableStatus: env.RESPONSES_ENABLE_STATUS === 'true' }
    }
    if (env.RESPONSES_ENABLE_HEALTH) {
      config.responses = { ...config.responses, enableHealth: env.RESPONSES_ENABLE_HEALTH === 'true' }
    }

    // Logging configuration
    if (env.LOG_LEVEL) {
      config.logging = { level: env.LOG_LEVEL }
    }

    return config
  }

  private static mergeConfigs(base: any, override: any): any {
    const result = { ...base }
    
    for (const [key, value] of Object.entries(override)) {
      if (value !== undefined) {
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          result[key] = ConfigManager.mergeConfigs(result[key] || {}, value)
        } else {
          result[key] = value
        }
      }
    }
    
    return result
  }

  toJSON(): string {
    return JSON.stringify(this.config, null, 2)
  }

  static async findConfigFile(searchPaths: string[] = []): Promise<string | null> {
    const defaultPaths = [
      './unix-socket-proxy.config.json',
      './proxy.config.json',
      './.proxy.json',
      join(process.env.HOME || process.env.USERPROFILE || '', '.unix-socket-proxy.json'),
      '/etc/unix-socket-proxy/config.json'
    ]

    const allPaths = [...searchPaths, ...defaultPaths]

    for (const configPath of allPaths) {
      try {
        await access(configPath)
        return configPath
      } catch {
        // File doesn't exist, continue to next path
      }
    }

    return null
  }
}

// Example configuration generator
export class ConfigExamples {
  static basic(proxyPath: string, targetPath: string): ProxyConfig {
    return ConfigManager.createDefault(proxyPath, targetPath)
  }

  static withEchoDebug(proxyPath: string, targetPath: string): ProxyConfig {
    return configSchema.parse({
      server: { socketPath: proxyPath },
      target: { socketPath: targetPath },
      routing: {
        defaultAction: 'internal',
        rules: [
          { type: 'contains', value: 'debug' },
          { type: 'startsWith', value: 'echo' }
        ]
      },
      responses: {
        enableEcho: true,
        enableStatus: true,
        enableHealth: true,
        templates: [
          {
            id: 'debug',
            template: 'DEBUG: Received message "${message}" from ${clientId} at ${timestamp}'
          }
        ]
      },
      logging: { level: 'debug' }
    })
  }

  static forJsonRpc(proxyPath: string, targetPath: string): ProxyConfig {
    return configSchema.parse({
      server: { socketPath: proxyPath },
      target: { socketPath: targetPath },
      routing: {
        defaultAction: 'forward',
        rules: [
          { type: 'jsonRpcMethod', value: 'debug' },
          { type: 'jsonRpcMethod', value: 'ping' }
        ]
      },
      responses: {
        enableEcho: false,
        enableStatus: false,
        enableHealth: false,
        templates: [
          {
            id: 'ping',
            template: '{"jsonrpc":"2.0","result":"pong","id":null}'
          }
        ]
      }
    })
  }

  static passThrough(proxyPath: string, targetPath: string): ProxyConfig {
    return configSchema.parse({
      server: { socketPath: proxyPath },
      target: { socketPath: targetPath },
      routing: { defaultAction: 'forward' },
      responses: {
        enableEcho: false,
        enableStatus: false,
        enableHealth: false
      },
      logging: { level: 'warn' }
    })
  }
}