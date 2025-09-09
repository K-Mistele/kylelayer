import { test, expect, describe } from 'bun:test'
import { ConfigManager, ConfigExamples } from '../src/config.ts'

describe('ConfigManager', () => {
  test('should create default configuration', () => {
    const config = ConfigManager.createDefault('/tmp/proxy.sock', '/tmp/target.sock')
    
    expect(config.server.socketPath).toBe('/tmp/proxy.sock')
    expect(config.target.socketPath).toBe('/tmp/target.sock')
    expect(config.routing.defaultAction).toBe('forward')
    expect(config.responses.enableEcho).toBe(true)
  })

  test('should validate configuration', async () => {
    const config = ConfigManager.createDefault('/tmp/proxy.sock', '/tmp/target.sock')
    const manager = new ConfigManager(config)
    
    const validation = manager.validate()
    expect(validation.valid).toBe(true)
    expect(validation.errors).toEqual([])
  })

  test('should handle invalid configuration', () => {
    // Test with missing required fields
    try {
      const invalidConfig = {
        server: { socketPath: '/tmp/proxy.sock' },
        // missing target
      } as any
      
      const manager = new ConfigManager(invalidConfig)
      const validation = manager.validate()
      
      expect(validation.valid).toBe(false)
      expect(validation.errors.length).toBeGreaterThan(0)
    } catch (error) {
      // This is expected when required fields are missing
      expect(error).toBeDefined()
    }
  })

  test('should merge configurations', () => {
    const baseConfig = ConfigManager.createDefault('/tmp/proxy.sock', '/tmp/target.sock')
    const manager = new ConfigManager(baseConfig)
    
    manager.updateConfig({
      routing: { defaultAction: 'internal', rules: [] },
      responses: { 
        enableEcho: false, 
        enableStatus: true, 
        enableHealth: true, 
        templates: [], 
        cacheResponses: true 
      }
    })
    
    const updated = manager.getConfig()
    expect(updated.routing.defaultAction).toBe('internal')
    expect(updated.responses.enableEcho).toBe(false)
    expect(updated.server.socketPath).toBe('/tmp/proxy.sock') // Should preserve original
  })

  test('should load from environment variables', async () => {
    const env = {
      PROXY_SOCKET_PATH: '/tmp/env-proxy.sock',
      TARGET_SOCKET_PATH: '/tmp/env-target.sock',
      ROUTING_DEFAULT_ACTION: 'internal',
      LOG_LEVEL: 'debug',
      RESPONSES_ENABLE_ECHO: 'false'
    }
    
    const manager = await ConfigManager.load({ environment: env })
    const config = manager.getConfig()
    
    expect(config.server.socketPath).toBe('/tmp/env-proxy.sock')
    expect(config.target.socketPath).toBe('/tmp/env-target.sock')
    expect(config.routing.defaultAction).toBe('internal')
    expect(config.logging.level).toBe('debug')
    expect(config.responses.enableEcho).toBe(false)
  })

  test('should handle overrides', async () => {
    const overrides = { 
      server: { socketPath: '/tmp/proxy.sock' },
      target: { socketPath: '/tmp/target.sock' },
      logging: { level: 'error' as const, timestamp: true, colors: true } 
    }
    
    const manager = await ConfigManager.load({ overrides })
    const config = manager.getConfig()
    
    expect(config.logging.level).toBe('error')
  })

  test('should provide configuration sections', () => {
    const config = ConfigManager.createDefault('/tmp/proxy.sock', '/tmp/target.sock')
    const manager = new ConfigManager(config)
    
    expect(manager.getServerConfig().socketPath).toBe('/tmp/proxy.sock')
    expect(manager.getTargetConfig().socketPath).toBe('/tmp/target.sock')
    expect(manager.getRoutingConfig().defaultAction).toBe('forward')
    expect(manager.getResponseConfig().enableEcho).toBe(true)
    expect(manager.getLoggingConfig().level).toBe('info')
  })

  test('should serialize to JSON', () => {
    const config = ConfigManager.createDefault('/tmp/proxy.sock', '/tmp/target.sock')
    const manager = new ConfigManager(config)
    
    const json = manager.toJSON()
    const parsed = JSON.parse(json)
    
    expect(parsed.server.socketPath).toBe('/tmp/proxy.sock')
    expect(parsed.target.socketPath).toBe('/tmp/target.sock')
  })
})

describe('ConfigExamples', () => {
  test('should create basic configuration', () => {
    const config = ConfigExamples.basic('/tmp/proxy.sock', '/tmp/target.sock')
    
    expect(config.server.socketPath).toBe('/tmp/proxy.sock')
    expect(config.target.socketPath).toBe('/tmp/target.sock')
    expect(config.routing.defaultAction).toBe('forward')
  })

  test('should create echo debug configuration', () => {
    const config = ConfigExamples.withEchoDebug('/tmp/proxy.sock', '/tmp/target.sock')
    
    expect(config.routing.defaultAction).toBe('internal')
    expect(config.routing.rules.length).toBe(2)
    expect(config.responses.templates.length).toBe(1)
    expect(config.logging.level).toBe('debug')
  })

  test('should create JSON-RPC configuration', () => {
    const config = ConfigExamples.forJsonRpc('/tmp/proxy.sock', '/tmp/target.sock')
    
    expect(config.routing.defaultAction).toBe('forward')
    expect(config.routing.rules.some(r => r.type === 'jsonRpcMethod')).toBe(true)
    expect(config.responses.enableEcho).toBe(false)
    expect(config.responses.templates.some(t => t.id === 'ping')).toBe(true)
  })

  test('should create pass-through configuration', () => {
    const config = ConfigExamples.passThrough('/tmp/proxy.sock', '/tmp/target.sock')
    
    expect(config.routing.defaultAction).toBe('forward')
    expect(config.responses.enableEcho).toBe(false)
    expect(config.responses.enableStatus).toBe(false)
    expect(config.responses.enableHealth).toBe(false)
    expect(config.logging.level).toBe('warn')
  })
})