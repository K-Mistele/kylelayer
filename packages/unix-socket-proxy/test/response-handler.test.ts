import { test, expect, describe } from 'bun:test'
import { ResponseHandler, ResponseTemplates } from '../src/response-handler.ts'

describe('ResponseHandler', () => {
  test('should handle echo command', () => {
    const handler = new ResponseHandler({ enableEcho: true })
    
    expect(handler.generateResponse('echo', 'client1')).toBe('ECHO: echo')
    expect(handler.generateResponse('echo hello world', 'client1')).toBe('ECHO: hello world')
  })

  test('should handle status command', () => {
    const handler = new ResponseHandler({ enableStatus: true })
    const response = handler.generateResponse('status', 'client1')
    
    expect(response).not.toBeNull()
    const parsed = JSON.parse(response!)
    expect(parsed.status).toBe('active')
    expect(parsed.clientId).toBe('client1')
    expect(typeof parsed.messageCount).toBe('number')
  })

  test('should handle health command', () => {
    const handler = new ResponseHandler({ enableHealth: true })
    
    const response1 = handler.generateResponse('health', 'client1')
    const response2 = handler.generateResponse('ping', 'client1')
    
    expect(response1).not.toBeNull()
    expect(response2).not.toBeNull()
    
    const parsed1 = JSON.parse(response1!)
    const parsed2 = JSON.parse(response2!)
    
    expect(parsed1.status).toBe('healthy')
    expect(parsed2.status).toBe('healthy')
  })

  test('should handle custom responses', () => {
    const handler = new ResponseHandler()
    handler.addResponse('greeting', 'Hello, ${clientId}!')
    
    const response = handler.generateResponse('greeting', 'alice')
    expect(response).toBe('Hello, alice!')
  })

  test('should handle default response', () => {
    const handler = new ResponseHandler({ defaultResponse: 'Default: ${message}' })
    
    const response = handler.generateResponse('unknown command', 'client1')
    expect(response).toBe('Default: unknown command')
  })

  test('should return null when no response configured', () => {
    const handler = new ResponseHandler({ 
      enableEcho: false, 
      enableStatus: false, 
      enableHealth: false 
    })
    
    const response = handler.generateResponse('unknown', 'client1')
    expect(response).toBeNull()
  })

  test('should substitute variables correctly', () => {
    const handler = new ResponseHandler()
    handler.addResponse('vars', 'Client: ${clientId}, Message: ${message}, Time: ${timestamp}')
    
    const response = handler.generateResponse('vars', 'test-client')
    expect(response).toContain('Client: test-client')
    expect(response).toContain('Message: vars')
    expect(response).toContain('Time: ')
  })

  test('should handle response templates with additional variables', () => {
    const handler = new ResponseHandler()
    handler.addResponse('custom', 'Name: ${name}, Age: ${age}', { name: 'John', age: 30 })
    
    const response = handler.generateResponse('custom', 'client1')
    expect(response).toBe('Name: John, Age: 30')
  })

  test('should cache responses for performance', () => {
    const handler = new ResponseHandler()
    handler.addResponse('cached', 'Cached response')
    
    // First call
    const response1 = handler.generateResponse('cached', 'client1')
    
    // Second call should use cache
    const response2 = handler.generateResponse('cached', 'client2')
    
    expect(response1).toBe('Cached response')
    expect(response2).toBe('Cached response')
    
    const stats = handler.getCacheStats()
    expect(stats.size).toBe(1)
    expect(stats.keys).toContain('cached')
  })

  test('should manage responses', () => {
    const handler = new ResponseHandler()
    
    handler.addResponse('test1', 'Response 1')
    handler.addResponse('test2', 'Response 2')
    
    expect(handler.getResponseIds()).toEqual(['test1', 'test2'])
    
    handler.removeResponse('test1')
    expect(handler.getResponseIds()).toEqual(['test2'])
  })

  test('should clear cache when responses change', () => {
    const handler = new ResponseHandler()
    handler.addResponse('test', 'Response')
    
    // Generate response to populate cache
    handler.generateResponse('test', 'client1')
    expect(handler.getCacheStats().size).toBe(1)
    
    // Adding new response should clear cache
    handler.addResponse('test2', 'Response 2')
    expect(handler.getCacheStats().size).toBe(0)
  })

  test('should increment message count', () => {
    const handler = new ResponseHandler({ enableStatus: true })
    
    // Generate a few messages
    handler.generateResponse('status', 'client1')
    handler.generateResponse('status', 'client2')
    const response = handler.generateResponse('status', 'client3')
    
    const parsed = JSON.parse(response!)
    expect(parsed.messageCount).toBe(3)
  })
})

describe('ResponseTemplates', () => {
  test('should create echo template', () => {
    const template = ResponseTemplates.echo('test message')
    expect(template.template).toBe('ECHO: test message')
  })

  test('should create error template', () => {
    const template = ResponseTemplates.error('Something went wrong')
    const parsed = JSON.parse(template.template)
    expect(parsed.error).toBe('Something went wrong')
  })

  test('should create JSON-RPC error template', () => {
    const template = ResponseTemplates.jsonRpcError(-32601, 'Method not found', 123)
    const parsed = JSON.parse(template.template)
    expect(parsed.jsonrpc).toBe('2.0')
    expect(parsed.error.code).toBe(-32601)
    expect(parsed.error.message).toBe('Method not found')
    expect(parsed.id).toBe(123)
  })

  test('should create JSON-RPC success template', () => {
    const template = ResponseTemplates.jsonRpcSuccess({ status: 'ok' }, 456)
    const parsed = JSON.parse(template.template)
    expect(parsed.jsonrpc).toBe('2.0')
    expect(parsed.result.status).toBe('ok')
    expect(parsed.id).toBe(456)
  })

  test('should create custom JSON template', () => {
    const template = ResponseTemplates.customJson({ custom: 'data', count: 42 })
    const parsed = JSON.parse(template.template)
    expect(parsed.custom).toBe('data')
    expect(parsed.count).toBe(42)
  })

  test('should create timestamp template', () => {
    const template = ResponseTemplates.timestamp()
    expect(template.template).toBe('Current time: ${timestamp}')
  })
})