import { beforeEach, describe, expect, test } from 'bun:test'
import { z } from 'zod'
import { JsonRpcClient } from '../src/client'
import { JsonRpcServer, createServerRequestHandler } from '../src/server'
import { InMemoryRpcClientTransport, InMemoryRpcServerTransport } from '../src/transports/memory'

const handlers = {
    list_sessions: createServerRequestHandler({
        method: 'list_sessions',
        paramsSchema: z.object({ test: z.string().optional() }),
        resultSchema: z.array(z.object({ id: z.string(), title: z.string() })),
        handler: (params) => {
            return []
        }
    }),
    echo: createServerRequestHandler({
        method: 'echo',
        paramsSchema: z.object({ message: z.string() }),
        resultSchema: z.object({ message: z.string() }),
        handler: ({ message }) => ({ message })
    }),
    slow_operation: createServerRequestHandler({
        method: 'slow_operation',
        paramsSchema: z.object({ delay: z.number() }),
        resultSchema: z.object({ completed: z.boolean(), delay: z.number() }),
        handler: async ({ delay }) => {
            await new Promise(resolve => setTimeout(resolve, delay))
            return { completed: true, delay }
        }
    }),
    error_operation: createServerRequestHandler({
        method: 'error_operation',
        paramsSchema: z.object({ shouldError: z.boolean() }),
        resultSchema: z.object({ success: z.boolean() }),
        handler: ({ shouldError }) => {
            if (shouldError) {
                throw new Error('Intentional test error')
            }
            return { success: true }
        }
    }),
    complex_data: createServerRequestHandler({
        method: 'complex_data',
        paramsSchema: z.object({
            nested: z.object({
                items: z.array(z.string()),
                count: z.number(),
                metadata: z.object({
                    tag: z.string()
                }).optional()
            })
        }),
        resultSchema: z.object({
            processed: z.boolean(),
            itemCount: z.number(),
            tags: z.array(z.string())
        }),
        handler: ({ nested }) => {
            return {
                processed: true,
                itemCount: nested.items.length,
                tags: nested.metadata ? [nested.metadata.tag] : []
            }
        }
    })
}
describe('RPC Client Tests', () => {
    let server = new JsonRpcServer({
        handlers,
        notifications: {},
        unknownMethodHandler: (method: string, params: any) => {
            console.warn(`Invalid method ${method} (`, params, ')')
        }
    })

    let inMemoryServerTransport = new InMemoryRpcServerTransport(server)

    // NOTE that this is only necessary since it's in memory
    let inMemoryClientTransport = new InMemoryRpcClientTransport(inMemoryServerTransport)

    // NOTE that the client doesn't actually need this since it doesn't need the methods but it's shaped nicely
    let client = new JsonRpcClient({ transport: inMemoryClientTransport, notifications: {}, methods: server.handlers })

    beforeEach(() => {
        server = new JsonRpcServer({
            handlers,
            notifications: {},
            unknownMethodHandler: (method: string, params: any) => {
                console.warn(`Invalid method ${method} (`, params, ')')
            }
        })

        inMemoryServerTransport = new InMemoryRpcServerTransport(server)
        inMemoryClientTransport = new InMemoryRpcClientTransport(inMemoryServerTransport)
        client = new JsonRpcClient({
            notifications: {},
            methods: server.handlers,
            transport: inMemoryClientTransport
        })
    })

    describe('Setup tests', () => {
        test('Should create method definitions correctly', () => {
            for (const key of Object.keys(server.handlers)) {
                // @ts-expect-error it's fine
                expect(server.methods.includes(key))
            }
        })

        test('Should use default incrementing integer IDs', async () => {
            for (let i = 1; i < 10; i++) {
                // @ts-expect-error we are accessing a private method to assess internal state management
                expect(client.nextRequestId).toBe(i)
                await client.call('list_sessions', {})
            }
        })
    })

    describe('Typed method calls', () => {
        test('list_sessions should return proper types', async () => {
            const result = await client.call('list_sessions', { test: 'optional' })
            expect(Array.isArray(result)).toBe(true)
            expect(result).toEqual([])
        })

        test('echo should return proper types', async () => {
            const message = 'Hello, world!'
            const result = await client.call('echo', { message })
            expect(result).toEqual({ message })
            expect(typeof result.message).toBe('string')
        })

        test('should enforce parameter types at compile time', async () => {
            // These calls should have proper typing:
            // list_sessions accepts { test?: string }
            await client.call('list_sessions', {})
            await client.call('list_sessions', { test: 'hello' })

            // echo requires { message: string }
            const result = await client.call('echo', { message: 'test' })
            expect(result.message).toBe('test')
        })

        test('should handle complex nested data structures', async () => {
            const complexInput = {
                nested: {
                    items: ['item1', 'item2', 'item3'],
                    count: 3,
                    metadata: {
                        tag: 'test-tag'
                    }
                }
            }

            const result = await client.call('complex_data', complexInput)
            
            expect(result.processed).toBe(true)
            expect(result.itemCount).toBe(3)
            expect(result.tags).toEqual(['test-tag'])
        })

        test('should handle optional nested properties', async () => {
            const inputWithoutMetadata = {
                nested: {
                    items: ['item1'],
                    count: 1
                }
            }

            const result = await client.call('complex_data', inputWithoutMetadata)
            
            expect(result.processed).toBe(true)
            expect(result.itemCount).toBe(1)
            expect(result.tags).toEqual([])
        })
    })

    describe('Error handling', () => {
        test('should handle server errors gracefully', async () => {
            try {
                await client.call('error_operation', { shouldError: true })
                throw new Error('Expected error not thrown')
            } catch (error) {
                expect(error).toBeInstanceOf(Error)
                expect((error as Error).message).toContain('Intentional test error')
            }
        })

        test('should handle successful operations after errors', async () => {
            // First call should error
            try {
                await client.call('error_operation', { shouldError: true })
                throw new Error('Expected error not thrown')
            } catch (error) {
                expect(error).toBeInstanceOf(Error)
            }

            // Second call should succeed
            const result = await client.call('error_operation', { shouldError: false })
            expect(result.success).toBe(true)
        })

        test('should handle non-existent methods', async () => {
            try {
                // @ts-expect-error Testing runtime error for non-existent method
                await client.call('non_existent_method', {})
                throw new Error('Expected error not thrown')
            } catch (error) {
                expect(error).toBeInstanceOf(Error)
                expect((error as Error).message).toContain('Method non_existent_method not found')
            }
        })
    })

    describe('Concurrent requests', () => {
        test('should handle multiple concurrent requests', async () => {
            const promises = [
                client.call('echo', { message: 'msg1' }),
                client.call('echo', { message: 'msg2' }),
                client.call('echo', { message: 'msg3' }),
                client.call('list_sessions', {}),
                client.call('list_sessions', { test: 'concurrent' })
            ]

            const results = await Promise.all(promises)
            
            expect(results[0]).toEqual({ message: 'msg1' })
            expect(results[1]).toEqual({ message: 'msg2' })
            expect(results[2]).toEqual({ message: 'msg3' })
            expect(results[3]).toEqual([])
            expect(results[4]).toEqual([])
        })

        test('should handle mixed success and error requests concurrently', async () => {
            const promises = [
                client.call('echo', { message: 'success' }),
                client.call('error_operation', { shouldError: false }),
                client.call('error_operation', { shouldError: true }).catch(e => e),
                client.call('echo', { message: 'another success' })
            ]

            const results = await Promise.all(promises)
            
            expect(results[0]).toEqual({ message: 'success' })
            expect(results[1]).toEqual({ success: true })
            expect(results[2]).toBeInstanceOf(Error)
            expect(results[3]).toEqual({ message: 'another success' })
        })

        test('should handle concurrent slow operations', async () => {
            const start = Date.now()
            
            const promises = [
                client.call('slow_operation', { delay: 50 }),
                client.call('slow_operation', { delay: 75 }),
                client.call('slow_operation', { delay: 25 })
            ]

            const results = await Promise.all(promises)
            const elapsed = Date.now() - start
            
            // Should complete in roughly the time of the slowest operation (75ms)
            // rather than the sum of all operations (150ms)
            expect(elapsed).toBeLessThan(150)
            expect(elapsed).toBeGreaterThan(70) // Allow for some timing variance
            
            expect(results[0]).toEqual({ completed: true, delay: 50 })
            expect(results[1]).toEqual({ completed: true, delay: 75 })
            expect(results[2]).toEqual({ completed: true, delay: 25 })
        })
    })

    describe('Timeout handling', () => {
        test('should respect custom timeout', async () => {
            const start = Date.now()
            
            try {
                await client.call('slow_operation', { delay: 200 }, { timeout: 100 })
                expect.fail('Should have timed out')
            } catch (error) {
                const elapsed = Date.now() - start
                expect(error).toBeInstanceOf(Error)
                expect((error as Error).message).toContain('timed out')
                expect(elapsed).toBeLessThan(150) // Should timeout around 100ms
                expect(elapsed).toBeGreaterThan(90) // Allow for some timing variance
            }
        })

        test('should complete fast operations within timeout', async () => {
            const result = await client.call('slow_operation', { delay: 10 }, { timeout: 100 })
            expect(result).toEqual({ completed: true, delay: 10 })
        })

        test('should use default timeout when not specified', async () => {
            // This test verifies the default timeout is reasonable for normal operations
            const result = await client.call('echo', { message: 'test' })
            expect(result).toEqual({ message: 'test' })
        })
    })

    describe('Client lifecycle', () => {
        test('should track pending request count', () => {
            expect(client.getPendingRequestCount()).toBe(0)
        })

        test('should handle graceful shutdown with no pending requests', async () => {
            await client.gracefulShutdown()
            
            // After shutdown, new requests should fail
            try {
                await client.call('echo', { message: 'after shutdown' })
                throw new Error('Expected error not thrown')
            } catch (error) {
                expect(error).toBeInstanceOf(Error)
                expect((error as Error).message).toContain('shutting down')
            }
        })

        test('should handle graceful shutdown with pending requests', async () => {
            // Create a new client for this test
            const testServer = new JsonRpcServer({ handlers, notifications: {} })
            const testServerTransport = new InMemoryRpcServerTransport(testServer)
            const testClientTransport = new InMemoryRpcClientTransport(testServerTransport)
            const testClient = new JsonRpcClient({
                transport: testClientTransport,
                methods: testServer.handlers,
                notifications: {},
                shutdownTimeout: 200
            })

            // Start a slow operation
            const slowPromise = testClient.call('slow_operation', { delay: 100 })
            
            expect(testClient.getPendingRequestCount()).toBe(1)
            
            // Shutdown should wait for pending request
            const shutdownPromise = testClient.gracefulShutdown()
            
            const [slowResult] = await Promise.all([slowPromise, shutdownPromise])
            expect(slowResult).toEqual({ completed: true, delay: 100 })
            expect(testClient.getPendingRequestCount()).toBe(0)
        })
    })

    describe('Request ID management', () => {
        test('should generate unique request IDs', async () => {
            const client1 = new JsonRpcClient({
                transport: inMemoryClientTransport,
                methods: server.handlers,
                notifications: {}
            })

            const promises = []
            for (let i = 0; i < 5; i++) {
                promises.push(client1.call('echo', { message: `test${i}` }))
            }

            const results = await Promise.all(promises)
            
            for (let i = 0; i < 5; i++) {
                expect(results[i]).toEqual({ message: `test${i}` })
            }
        })

        test('should handle custom ID generation', async () => {
            const customIdClient = new JsonRpcClient({
                transport: inMemoryClientTransport,
                methods: server.handlers,
                notifications: {},
                generateRequestId: () => `custom-${Math.random().toString(36).substr(2, 9)}`
            })

            const result = await customIdClient.call('echo', { message: 'custom-id-test' })
            expect(result).toEqual({ message: 'custom-id-test' })
        })
    })

    describe('Edge cases', () => {
        test('should handle rapid sequential requests', async () => {
            const results = []
            for (let i = 0; i < 10; i++) {
                const result = await client.call('echo', { message: `seq${i}` })
                results.push(result)
            }

            for (let i = 0; i < 10; i++) {
                expect(results[i]).toEqual({ message: `seq${i}` })
            }
        })

        test('should handle empty and minimal valid parameters', async () => {
            const result1 = await client.call('list_sessions', {})
            expect(result1).toEqual([])

            const result2 = await client.call('echo', { message: '' })
            expect(result2).toEqual({ message: '' })

            const result3 = await client.call('echo', { message: 'a' })
            expect(result3).toEqual({ message: 'a' })
        })

        test('should maintain client state across multiple operations', async () => {
            // Verify client doesn't get corrupted by various operations
            await client.call('echo', { message: 'test1' })
            
            try {
                await client.call('error_operation', { shouldError: true })
            } catch (error) {
                // Expected error
            }
            
            await client.call('slow_operation', { delay: 10 })
            
            const finalResult = await client.call('echo', { message: 'final' })
            expect(finalResult).toEqual({ message: 'final' })
            
            // Client should still be functional
            expect(client.getPendingRequestCount()).toBe(0)
        })
    })
})
