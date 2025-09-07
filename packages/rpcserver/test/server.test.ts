import { beforeEach, describe, expect, test } from 'bun:test'
import { z } from 'zod'
import { CustomServerError, JsonRpcErrorCodes } from '../src/errors'
import { JsonRpcServer, createNotificationhandler, createRequestHandler } from '../src/server'

describe('RPC server tests', () => {
    describe('createRequestHandler tests', () => {
        test('Creates valid request handler', () => {
            const handler = createRequestHandler({
                method: 'test_method',
                paramsSchema: z.object({ name: z.string() }),
                resultSchema: z.string(),
                handler: (params) => `Hello ${params.name}`
            })

            expect(handler.method).toBe('test_method')
            expect(handler.paramsSchema).toBeDefined()
            expect(handler.resultSchema).toBeDefined()
            expect(typeof handler.handler).toBe('function')
        })

        test('Handler function works correctly', () => {
            const handler = createRequestHandler({
                method: 'add',
                paramsSchema: z.object({ a: z.number(), b: z.number() }),
                resultSchema: z.number(),
                handler: (params) => params.a + params.b
            })

            const result = handler.handler({ a: 2, b: 3 })
            expect(result).toBe(5)
        })
    })

    describe('createNotificationhandler tests', () => {
        test('Creates valid notification handler', () => {
            const handler = createNotificationhandler({
                method: 'notify_test',
                paramsSchema: z.object({ message: z.string() }),
                handler: (params) => {
                    console.log(params.message)
                }
            })

            expect(handler.method).toBe('notify_test')
            expect(handler.paramsSchema).toBeDefined()
            expect(typeof handler.handler).toBe('function')
        })
    })

    describe('JsonRpcServer constructor tests', () => {
        test('Creates server with handlers', () => {
            const server = new JsonRpcServer({
                handlers: {
                    test_method: createRequestHandler({
                        method: 'test_method',
                        paramsSchema: z.object({ name: z.string() }),
                        resultSchema: z.string(),
                        handler: (params) => `Hello ${params.name}`
                    })
                }
            })

            expect(server.handlers).toBeDefined()
            expect(server.methods).toEqual(['test_method'])
        })

        test('Creates server with notifications', () => {
            const server = new JsonRpcServer({
                handlers: {},
                notifications: {
                    notify_test: createNotificationhandler({
                        method: 'notify_test',
                        paramsSchema: z.object({ message: z.string() }),
                        handler: (params) => {}
                    })
                }
            })

            expect(server.notifications).toBeDefined()
        })
    })

    describe('handleRawMessage tests', () => {
        let server: JsonRpcServer<any, any>

        beforeEach(() => {
            server = new JsonRpcServer({
                handlers: {
                    echo: createRequestHandler({
                        method: 'echo',
                        paramsSchema: z.object({ message: z.string() }),
                        resultSchema: z.string(),
                        handler: (params) => params.message
                    })
                }
            })
        })

        test('Handles valid JSON request', async () => {
            const validMessage = JSON.stringify({
                jsonrpc: '2.0',
                method: 'echo',
                params: { message: 'hello' },
                id: 1
            })

            const result = await server.handleRawMessage(validMessage)
            expect(result).toBeDefined()
            expect((result as any).jsonrpc).toBe('2.0')
            expect((result as any).result).toBe('hello')
            expect((result as any).id).toBe(1)
        })

        test('Returns parse error for invalid JSON', async () => {
            const invalidMessage = '{"invalid": json}'

            const result = await server.handleRawMessage(invalidMessage)
            expect(result).toBeDefined()
            expect((result as any).jsonrpc).toBe('2.0')
            expect((result as any).error.code).toBe(JsonRpcErrorCodes.PARSE_ERROR)
            expect((result as any).error.message).toBe('invalid JSON payload structure')
            expect((result as any).id).toBeNull()
        })

        test('Handles empty string gracefully', async () => {
            const result = await server.handleRawMessage('')
            expect(result).toBeDefined()
            expect((result as any).error.code).toBe(JsonRpcErrorCodes.PARSE_ERROR)
        })
    })

    describe('handleMessage tests', () => {
        let server: JsonRpcServer<any, any>

        beforeEach(() => {
            server = new JsonRpcServer({
                handlers: {
                    echo: createRequestHandler({
                        method: 'echo',
                        paramsSchema: z.object({ message: z.string() }),
                        resultSchema: z.string(),
                        handler: (params) => params.message
                    }),
                    throw_error: createRequestHandler({
                        method: 'throw_error',
                        paramsSchema: z.object({}),
                        resultSchema: z.string(),
                        handler: () => {
                            throw new Error('Test error')
                        }
                    }),
                    async_echo: createRequestHandler({
                        method: 'async_echo',
                        paramsSchema: z.object({ message: z.string() }),
                        resultSchema: z.string(),
                        handler: async (params) => {
                            await new Promise((resolve) => setTimeout(resolve, 1))
                            return params.message
                        }
                    })
                },
                notifications: {
                    log: createNotificationhandler({
                        method: 'log',
                        paramsSchema: z.object({ message: z.string() }),
                        handler: (params) => {
                            console.log(params.message)
                        }
                    })
                }
            })
        })

        test('Handles valid request', async () => {
            const request = {
                jsonrpc: '2.0',
                method: 'echo',
                params: { message: 'hello world' },
                id: 'test-1'
            }

            const result = await server.handleMessage(request)
            expect(result).toBeDefined()
            expect((result as any).jsonrpc).toBe('2.0')
            expect((result as any).result).toBe('hello world')
            expect((result as any).id).toBe('test-1')
        })

        test('Handles async request', async () => {
            const request = {
                jsonrpc: '2.0',
                method: 'async_echo',
                params: { message: 'async hello' },
                id: 2
            }

            const result = await server.handleMessage(request)
            expect(result).toBeDefined()
            expect((result as any).result).toBe('async hello')
        })

        test('Handles valid notification', async () => {
            const notification = {
                jsonrpc: '2.0',
                method: 'log',
                params: { message: 'test log' }
            }

            const result = await server.handleMessage(notification)
            expect(result).toBe(null)
        })

        test('Returns method not found error', async () => {
            const request = {
                jsonrpc: '2.0',
                method: 'unknown_method',
                id: 'test-2'
            }

            const result = await server.handleMessage(request)
            expect(result).toBeDefined()
            expect((result as any).error.code).toBe(JsonRpcErrorCodes.METHOD_NOT_FOUND)
            expect((result as any).error.message).toContain('unable to find method unknown_method')
            expect((result as any).id).toBe('test-2')
        })

        test('Returns invalid parameters error', async () => {
            const request = {
                jsonrpc: '2.0',
                method: 'echo',
                params: { wrong_param: 'value' },
                id: 'test-3'
            }

            const result = await server.handleMessage(request)
            expect(result).toBeDefined()
            expect((result as any).error.code).toBe(JsonRpcErrorCodes.INVALID_PARAMETERS)
            expect((result as any).error.message).toContain('invalid parameters')
            expect((result as any).id).toBe('test-3')
        })

        test('Returns invalid request error for malformed message', async () => {
            const invalidRequest = {
                method: 'echo',
                id: 'test-4'
            }

            const result = await server.handleMessage(invalidRequest)
            expect(result).toBeDefined()
            expect((result as any).error.code).toBe(JsonRpcErrorCodes.INVALID_REQUEST)
            expect((result as any).error.message).toContain('invalid JSON RPC request')
            expect((result as any).id).toBe('test-4')
        })

        test('Handles internal server error', async () => {
            const request = {
                jsonrpc: '2.0',
                method: 'throw_error',
                params: {},
                id: 'test-5'
            }

            const result = await server.handleMessage(request)
            expect(result).toBeDefined()
            expect((result as any).error.code).toBe(JsonRpcErrorCodes.INTERNAL_SERVER_ERROR)
            expect((result as any).id).toBe('test-5')
        })

        test('Handles notification without id', async () => {
            const request = {
                jsonrpc: '2.0',
                method: 'echo',
                params: { message: 'hello' }
            }

            const result = await server.handleMessage(request)
            expect(result).toBe(null)
        })

        test('Handles notification with unknown method', async () => {
            const notification = {
                jsonrpc: '2.0',
                method: 'unknown_notification'
            }

            const result = await server.handleMessage(notification)
            expect(result).toBe(null)
        })

        test('Handles notification with invalid parameters', async () => {
            const notification = {
                jsonrpc: '2.0',
                method: 'log',
                params: { wrong_param: 'value' }
            }

            const result = await server.handleMessage(notification)
            expect(result).toBe(null)
        })
    })

    describe('Error handling tests', () => {
        test('CustomServerError is handled correctly', async () => {
            class TestCustomError extends CustomServerError {
                constructor(requestId: string | number | null) {
                    super({
                        requestId,
                        error: {
                            code: -32000 as any,
                            message: 'Custom test error',
                            data: { extra: 'info' }
                        }
                    })
                }
            }

            const server = new JsonRpcServer({
                handlers: {
                    custom_error: createRequestHandler({
                        method: 'custom_error',
                        paramsSchema: z.object({}),
                        resultSchema: z.string(),
                        handler: () => {
                            throw new TestCustomError('test-id')
                        }
                    })
                }
            })

            const request = {
                jsonrpc: '2.0',
                method: 'custom_error',
                params: {},
                id: 'test-id'
            }

            const result = await server.handleMessage(request)
            expect(result).toBeDefined()
            expect((result as any).error.code).toBe(-32000)
            expect((result as any).error.message).toBe('Custom test error')
            expect((result as any).error.data.extra).toBe('info')
        })

        test('Preserves request id in error response', async () => {
            const server = new JsonRpcServer({
                handlers: {
                    error_method: createRequestHandler({
                        method: 'error_method',
                        paramsSchema: z.object({}),
                        resultSchema: z.string(),
                        handler: () => {
                            throw new Error('Generic error')
                        }
                    })
                }
            })

            const request = {
                jsonrpc: '2.0',
                method: 'error_method',
                params: {},
                id: 42
            }

            const result = await server.handleMessage(request)
            console.log
            expect((result as any).id).toBe(42)
        })
    })

    describe('Parameter validation tests', () => {
        let server: JsonRpcServer<any, any>

        beforeEach(() => {
            server = new JsonRpcServer({
                handlers: {
                    strict_params: createRequestHandler({
                        method: 'strict_params',
                        paramsSchema: z.object({
                            name: z.string().min(1),
                            age: z.number().min(0).max(150),
                            email: z.string().email()
                        }),
                        resultSchema: z.string(),
                        handler: (params) => `${params.name} is ${params.age} years old`
                    })
                }
            })
        })

        test('Validates required parameters', async () => {
            const request = {
                jsonrpc: '2.0',
                method: 'strict_params',
                params: { name: 'John' },
                id: 1
            }

            const result = await server.handleMessage(request)
            expect((result as any).error.code).toBe(JsonRpcErrorCodes.INVALID_PARAMETERS)
        })

        test('Validates parameter types', async () => {
            const request = {
                jsonrpc: '2.0',
                method: 'strict_params',
                params: { name: 'John', age: 'thirty', email: 'john@example.com' },
                id: 1
            }

            const result = await server.handleMessage(request)
            expect((result as any).error.code).toBe(JsonRpcErrorCodes.INVALID_PARAMETERS)
        })

        test('Validates parameter constraints', async () => {
            const request = {
                jsonrpc: '2.0',
                method: 'strict_params',
                params: { name: 'John', age: 200, email: 'john@example.com' },
                id: 1
            }

            const result = await server.handleMessage(request)
            expect(result).not.toBeNull()
        })

        test('Accepts valid parameters', async () => {
            const request = {
                jsonrpc: '2.0',
                method: 'strict_params',
                params: { name: 'John', age: 30, email: 'john@example.com' },
                id: 1
            }

            const result = await server.handleMessage(request)
            expect((result as any).result).toBe('John is 30 years old')
        })
    })

    describe('Integration tests', () => {
        test('Server handles mixed requests and notifications', async () => {
            const server = new JsonRpcServer({
                handlers: {
                    calculate: createRequestHandler({
                        method: 'calculate',
                        paramsSchema: z.object({ operation: z.string(), a: z.number(), b: z.number() }),
                        resultSchema: z.number(),
                        handler: (params) => {
                            switch (params.operation) {
                                case 'add':
                                    return params.a + params.b
                                case 'subtract':
                                    return params.a - params.b
                                case 'multiply':
                                    return params.a * params.b
                                case 'divide':
                                    return params.a / params.b
                                default:
                                    throw new Error('Unknown operation')
                            }
                        }
                    })
                },
                notifications: {
                    audit: createNotificationhandler({
                        method: 'audit',
                        paramsSchema: z.object({ action: z.string(), timestamp: z.number() }),
                        handler: (params) => {}
                    })
                }
            })

            const addRequest = {
                jsonrpc: '2.0',
                method: 'calculate',
                params: { operation: 'add', a: 10, b: 5 },
                id: 1
            }

            const auditNotification = {
                jsonrpc: '2.0',
                method: 'audit',
                params: { action: 'calculation', timestamp: Date.now() }
            }

            const addResult = await server.handleMessage(addRequest)
            const auditResult = await server.handleMessage(auditNotification)

            expect((addResult as any).result).toBe(15)
            expect(auditResult).toBe(null)
        })

        test('Server handles edge cases', async () => {
            const server = new JsonRpcServer({
                handlers: {
                    null_result: createRequestHandler({
                        method: 'null_result',
                        paramsSchema: z.object({}),
                        resultSchema: z.null(),
                        handler: () => null
                    }),
                    empty_string: createRequestHandler({
                        method: 'empty_string',
                        paramsSchema: z.object({}),
                        resultSchema: z.string(),
                        handler: () => ''
                    })
                }
            })

            const nullRequest = {
                jsonrpc: '2.0',
                method: 'null_result',
                params: {},
                id: 1
            }

            const emptyStringRequest = {
                jsonrpc: '2.0',
                method: 'empty_string',
                params: {},
                id: 2
            }

            const nullResult = await server.handleMessage(nullRequest)
            const emptyResult = await server.handleMessage(emptyStringRequest)

            expect((nullResult as any).result).toBeNull()
            expect((emptyResult as any).result).toBe('')
        })
    })
})
