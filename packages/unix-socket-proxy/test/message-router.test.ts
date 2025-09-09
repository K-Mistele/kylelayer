import { test, expect, describe } from 'bun:test'
import { MessageRouter, RoutingRules } from '../src/message-router.ts'

describe('MessageRouter', () => {
  test('should use default forward action when no rules match', () => {
    const router = new MessageRouter({ defaultAction: 'forward' })
    const decision = router.routeMessage('test message')
    expect(decision.shouldForward).toBe(true)
  })

  test('should use default internal action when no rules match', () => {
    const router = new MessageRouter({ defaultAction: 'internal' })
    const decision = router.routeMessage('test message')
    expect(decision.shouldForward).toBe(false)
  })

  test('should apply custom rules', () => {
    const router = new MessageRouter()
    router.addRule((message) => message.includes('debug'))

    expect(router.routeMessage('normal message').shouldForward).toBe(true)
    expect(router.routeMessage('debug message').shouldForward).toBe(false)
  })

  test('should handle multiple rules with first match wins', () => {
    const router = new MessageRouter()
    router.addRule((message) => message.includes('first'))
    router.addRule((message) => message.includes('second'))

    expect(router.routeMessage('first and second').shouldForward).toBe(false)
    expect(router.routeMessage('second only').shouldForward).toBe(false)
    expect(router.routeMessage('neither').shouldForward).toBe(true)
  })

  test('should handle rule errors gracefully', () => {
    const router = new MessageRouter()
    router.addRule(() => {
      throw new Error('Rule error')
    })
    router.addRule((message) => message === 'match')

    // Should continue to next rule after error
    expect(router.routeMessage('match').shouldForward).toBe(false)
    expect(router.routeMessage('nomatch').shouldForward).toBe(true)
  })

  test('should manage rules', () => {
    const router = new MessageRouter()
    const rule1 = (msg: string) => msg.includes('test')
    const rule2 = (msg: string) => msg.includes('debug')

    router.addRule(rule1)
    router.addRule(rule2)
    expect(router.getRules().length).toBe(2)

    router.clearRules()
    expect(router.getRules().length).toBe(0)
  })

  test('should allow changing default action', () => {
    const router = new MessageRouter()
    
    router.setDefaultAction('internal')
    expect(router.routeMessage('test').shouldForward).toBe(false)

    router.setDefaultAction('forward')
    expect(router.routeMessage('test').shouldForward).toBe(true)
  })
})

describe('RoutingRules', () => {
  test('containsText rule', () => {
    const rule = RoutingRules.containsText('debug')
    expect(rule('debug message')).toBe(true)
    expect(rule('normal message')).toBe(false)
  })

  test('matchesRegex rule', () => {
    const rule = RoutingRules.matchesRegex(/^test-\d+$/)
    expect(rule('test-123')).toBe(true)
    expect(rule('test-abc')).toBe(false)
    expect(rule('test-123-extra')).toBe(false)
  })

  test('startsWith rule', () => {
    const rule = RoutingRules.startsWith('CMD:')
    expect(rule('CMD: do something')).toBe(true)
    expect(rule('OTHER: do something')).toBe(false)
  })

  test('endsWith rule', () => {
    const rule = RoutingRules.endsWith('.json')
    expect(rule('config.json')).toBe(true)
    expect(rule('config.xml')).toBe(false)
  })

  test('jsonRpcMethod rule', () => {
    const rule = RoutingRules.jsonRpcMethod('ping')
    expect(rule('{"jsonrpc":"2.0","method":"ping","id":1}')).toBe(true)
    expect(rule('{"jsonrpc":"2.0","method":"status","id":1}')).toBe(false)
    expect(rule('not json')).toBe(false)
  })

  test('isJsonRpc rule', () => {
    const rule = RoutingRules.isJsonRpc()
    expect(rule('{"jsonrpc":"2.0","method":"test","id":1}')).toBe(true)
    expect(rule('{"jsonrpc":"2.0","result":"ok","id":1}')).toBe(true)
    expect(rule('{"jsonrpc":"2.0","error":{"code":-1},"id":1}')).toBe(true)
    expect(rule('{"method":"test"}')).toBe(false) // missing jsonrpc
    expect(rule('not json')).toBe(false)
  })

  test('byLength rule', () => {
    const rule = RoutingRules.byLength(5, 10)
    expect(rule('short')).toBe(true) // 5 chars
    expect(rule('medium msg')).toBe(true) // 10 chars
    expect(rule('tiny')).toBe(false) // 4 chars
    expect(rule('this is too long')).toBe(false) // 16 chars
  })

  test('byLength rule with min only', () => {
    const rule = RoutingRules.byLength(10)
    expect(rule('short')).toBe(false)
    expect(rule('this is long enough')).toBe(true)
  })

  test('matchAll rule', () => {
    const rule = RoutingRules.matchAll()
    expect(rule('anything')).toBe(true)
    expect(rule('')).toBe(true)
  })

  test('matchNone rule', () => {
    const rule = RoutingRules.matchNone()
    expect(rule('anything')).toBe(false)
    expect(rule('')).toBe(false)
  })

  test('or rule', () => {
    const rule = RoutingRules.or(
      RoutingRules.containsText('debug'),
      RoutingRules.containsText('error')
    )
    expect(rule('debug message')).toBe(true)
    expect(rule('error message')).toBe(true)
    expect(rule('info message')).toBe(false)
  })

  test('and rule', () => {
    const rule = RoutingRules.and(
      RoutingRules.containsText('debug'),
      RoutingRules.containsText('test')
    )
    expect(rule('debug test message')).toBe(true)
    expect(rule('debug message')).toBe(false)
    expect(rule('test message')).toBe(false)
  })

  test('not rule', () => {
    const rule = RoutingRules.not(RoutingRules.containsText('debug'))
    expect(rule('debug message')).toBe(false)
    expect(rule('normal message')).toBe(true)
  })
})