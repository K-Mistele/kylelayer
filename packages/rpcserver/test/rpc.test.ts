import { describe, expect, test } from 'bun:test'
import {
    JsonRpcBatchRequestSchema,
    JsonRpcErrorResponseSchema,
    JsonRpcNotificationSchema,
    JsonRpcRequestSchema,
    JsonRpcResponseSchema,
    JsonRpcServerMessageSchema,
    JsonRpcSuccessResponseSchema
} from '../src/json-rpc'

describe('RPC schema tests', () => {
    describe('JsonRpcRequestSchema tests', () => {
        test('Well-formed request with string id should validate', () => {
            const validRequest = {
                jsonrpc: '2.0',
                method: 'test_method',
                params: { key: 'value' },
                id: 'test-id'
            }
            const result = JsonRpcRequestSchema.safeParse(validRequest)
            expect(result.success).toBe(true)
        })

        test('Well-formed request with number id should validate', () => {
            const validRequest = {
                jsonrpc: '2.0',
                method: 'test_method',
                params: [1, 2, 3],
                id: 123
            }
            const result = JsonRpcRequestSchema.safeParse(validRequest)
            expect(result.success).toBe(true)
        })

        test('Request without params should validate', () => {
            const validRequest = {
                jsonrpc: '2.0',
                method: 'test_method',
                id: 'test-id'
            }
            const result = JsonRpcRequestSchema.safeParse(validRequest)
            expect(result.success).toBe(true)
        })

        test('Request with null params should fail', () => {
            const validRequest = {
                jsonrpc: '2.0',
                method: 'test_method',
                params: null,
                id: 'test-id'
            }
            const result = JsonRpcRequestSchema.safeParse(validRequest)
            expect(result.success).toBe(false)
        })

        test('Request with wrong jsonrpc version should fail', () => {
            const invalidRequest = {
                jsonrpc: '1.0',
                method: 'test_method',
                id: 'test-id'
            }
            const result = JsonRpcRequestSchema.safeParse(invalidRequest)
            expect(result.success).toBe(false)
        })

        test('Request without jsonrpc should fail', () => {
            const invalidRequest = {
                method: 'test_method',
                id: 'test-id'
            }
            const result = JsonRpcRequestSchema.safeParse(invalidRequest)
            expect(result.success).toBe(false)
        })

        test('Request without method should fail', () => {
            const invalidRequest = {
                jsonrpc: '2.0',
                id: 'test-id'
            }
            const result = JsonRpcRequestSchema.safeParse(invalidRequest)
            expect(result.success).toBe(false)
        })

        test('Request without id should fail', () => {
            const invalidRequest = {
                jsonrpc: '2.0',
                method: 'test_method'
            }
            const result = JsonRpcRequestSchema.safeParse(invalidRequest)
            expect(result.success).toBe(false)
        })

        test('Request with empty method should fail', () => {
            const invalidRequest = {
                jsonrpc: '2.0',
                method: '',
                id: 'test-id'
            }
            const result = JsonRpcRequestSchema.safeParse(invalidRequest)
            expect(result.success).toBe(false)
        })

        test('Request with boolean id should fail', () => {
            const invalidRequest = {
                jsonrpc: '2.0',
                method: 'test_method',
                id: true
            }
            const result = JsonRpcRequestSchema.safeParse(invalidRequest)
            expect(result.success).toBe(false)
        })
    })

    describe('JsonRpcSuccessResponseSchema tests', () => {
        test('Well-formed success response with string id should validate', () => {
            const validResponse = {
                jsonrpc: '2.0',
                result: { data: 'success' },
                id: 'test-id'
            }
            const result = JsonRpcSuccessResponseSchema.safeParse(validResponse)
            expect(result.success).toBe(true)
        })

        test('Well-formed success response with number id should validate', () => {
            const validResponse = {
                jsonrpc: '2.0',
                result: [1, 2, 3],
                id: 123
            }
            const result = JsonRpcSuccessResponseSchema.safeParse(validResponse)
            expect(result.success).toBe(true)
        })

        test('Success response with null result should validate', () => {
            const validResponse = {
                jsonrpc: '2.0',
                result: null,
                id: 'test-id'
            }
            const result = JsonRpcSuccessResponseSchema.safeParse(validResponse)
            expect(result.success).toBe(true)
        })

        test('Success response without result should fail', () => {
            const invalidResponse = {
                jsonrpc: '2.0',
                id: 'test-id'
            }
            const result = JsonRpcSuccessResponseSchema.safeParse(invalidResponse)
            expect(result.success).toBe(false)
        })

        test('Success response without id should fail', () => {
            const invalidResponse = {
                jsonrpc: '2.0',
                result: 'success'
            }
            const result = JsonRpcSuccessResponseSchema.safeParse(invalidResponse)
            expect(result.success).toBe(false)
        })

        test('Success response with wrong jsonrpc version should fail', () => {
            const invalidResponse = {
                jsonrpc: '1.0',
                result: 'success',
                id: 'test-id'
            }
            const result = JsonRpcSuccessResponseSchema.safeParse(invalidResponse)
            expect(result.success).toBe(false)
        })
    })

    describe('JsonRpcErrorResponseSchema tests', () => {
        test('Well-formed error response should validate', () => {
            const validResponse = {
                jsonrpc: '2.0',
                id: 'test-id',
                error: {
                    code: -32600,
                    message: 'Invalid Request',
                    data: { details: 'more info' }
                }
            }
            const result = JsonRpcErrorResponseSchema.safeParse(validResponse)
            expect(result.success).toBe(true)
        })

        test('Error response with null id should validate', () => {
            const validResponse = {
                jsonrpc: '2.0',
                id: null,
                error: {
                    code: -32700,
                    message: 'Parse error'
                }
            }
            const result = JsonRpcErrorResponseSchema.safeParse(validResponse)
            expect(result.success).toBe(true)
        })

        test('Error response without data should validate', () => {
            const validResponse = {
                jsonrpc: '2.0',
                id: 'test-id',
                error: {
                    code: -32601,
                    message: 'Method not found'
                }
            }
            const result = JsonRpcErrorResponseSchema.safeParse(validResponse)
            expect(result.success).toBe(true)
        })

        test('Error response without error should fail', () => {
            const invalidResponse = {
                jsonrpc: '2.0',
                id: 'test-id'
            }
            const result = JsonRpcErrorResponseSchema.safeParse(invalidResponse)
            expect(result.success).toBe(false)
        })

        test('Error response with incomplete error object should fail', () => {
            const invalidResponse = {
                jsonrpc: '2.0',
                id: 'test-id',
                error: {
                    code: -32600
                }
            }
            const result = JsonRpcErrorResponseSchema.safeParse(invalidResponse)
            expect(result.success).toBe(false)
        })

        test('Error response with string code should fail', () => {
            const invalidResponse = {
                jsonrpc: '2.0',
                id: 'test-id',
                error: {
                    code: 'invalid',
                    message: 'Invalid Request'
                }
            }
            const result = JsonRpcErrorResponseSchema.safeParse(invalidResponse)
            expect(result.success).toBe(false)
        })

        test('Error response with number message should fail', () => {
            const invalidResponse = {
                jsonrpc: '2.0',
                id: 'test-id',
                error: {
                    code: -32600,
                    message: 123
                }
            }
            const result = JsonRpcErrorResponseSchema.safeParse(invalidResponse)
            expect(result.success).toBe(false)
        })
    })

    describe('JsonRpcResponseSchema tests', () => {
        test('Valid success response should validate', () => {
            const successResponse = {
                jsonrpc: '2.0',
                result: 'success',
                id: 'test-id'
            }
            const result = JsonRpcResponseSchema.safeParse(successResponse)
            expect(result.success).toBe(true)
        })

        test('Valid error response should validate', () => {
            const errorResponse = {
                jsonrpc: '2.0',
                id: 'test-id',
                error: {
                    code: -32600,
                    message: 'Invalid Request'
                }
            }
            const result = JsonRpcResponseSchema.safeParse(errorResponse)
            expect(result.success).toBe(true)
        })

        test('Response with both result and error should fail', () => {
            const invalidResponse = {
                jsonrpc: '2.0',
                result: 'success',
                id: 'test-id',
                error: {
                    code: -32600,
                    message: 'Invalid Request'
                }
            }
            const result = JsonRpcResponseSchema.safeParse(invalidResponse)
            expect(result.success).toBe(false)
        })
    })

    describe('JsonRpcNotificationSchema tests', () => {
        test('Well-formed notification should validate', () => {
            const validNotification = {
                jsonrpc: '2.0',
                method: 'notify_method',
                params: { key: 'value' }
            }
            const result = JsonRpcNotificationSchema.safeParse(validNotification)
            expect(result.success).toBe(true)
        })

        test('Notification without params should validate', () => {
            const validNotification = {
                jsonrpc: '2.0',
                method: 'notify_method'
            }
            const result = JsonRpcNotificationSchema.safeParse(validNotification)
            expect(result.success).toBe(true)
        })

        test('Notification with array params should validate', () => {
            const validNotification = {
                jsonrpc: '2.0',
                method: 'notify_method',
                params: [1, 2, 3]
            }
            const result = JsonRpcNotificationSchema.safeParse(validNotification)
            expect(result.success).toBe(true)
        })

        test('Notification with id should fail (strict mode)', () => {
            const invalidNotification = {
                jsonrpc: '2.0',
                method: 'notify_method',
                id: 'test-id'
            }
            const result = JsonRpcNotificationSchema.safeParse(invalidNotification)
            expect(result.success).toBe(false)
        })

        test('Notification without method should fail', () => {
            const invalidNotification = {
                jsonrpc: '2.0',
                params: { key: 'value' }
            }
            const result = JsonRpcNotificationSchema.safeParse(invalidNotification)
            expect(result.success).toBe(false)
        })

        test('Notification with wrong jsonrpc version should fail', () => {
            const invalidNotification = {
                jsonrpc: '1.0',
                method: 'notify_method'
            }
            const result = JsonRpcNotificationSchema.safeParse(invalidNotification)
            expect(result.success).toBe(false)
        })

        test('Notification with empty method should fail', () => {
            const invalidNotification = {
                jsonrpc: '2.0',
                method: ''
            }
            const result = JsonRpcNotificationSchema.safeParse(invalidNotification)
            expect(result.success).toBe(false)
        })
    })

    describe('JsonRpcBatchRequestSchema tests', () => {
        test('Valid batch request should validate', () => {
            const validBatch = [
                {
                    jsonrpc: '2.0',
                    method: 'method1',
                    id: 1
                },
                {
                    jsonrpc: '2.0',
                    method: 'method2',
                    params: { key: 'value' },
                    id: 2
                }
            ]
            const result = JsonRpcBatchRequestSchema.safeParse(validBatch)
            expect(result.success).toBe(true)
        })

        test('Empty batch should fail', () => {
            const emptyBatch: any[] = []
            const result = JsonRpcBatchRequestSchema.safeParse(emptyBatch)
            expect(result.success).toBe(false)
        })

        test('Batch with invalid request should fail', () => {
            const invalidBatch = [
                {
                    jsonrpc: '2.0',
                    method: 'method1',
                    id: 1
                },
                {
                    jsonrpc: '2.0',
                    id: 2
                }
            ]
            const result = JsonRpcBatchRequestSchema.safeParse(invalidBatch)
            expect(result.success).toBe(false)
        })

        test('Single item batch should validate', () => {
            const singleBatch = [
                {
                    jsonrpc: '2.0',
                    method: 'method1',
                    id: 1
                }
            ]
            const result = JsonRpcBatchRequestSchema.safeParse(singleBatch)
            expect(result.success).toBe(true)
        })
    })

    describe('JsonRpcServerMessageSchema tests', () => {
        test('Valid request should validate', () => {
            const validRequest = {
                jsonrpc: '2.0',
                method: 'test_method',
                id: 'test-id'
            }
            const result = JsonRpcServerMessageSchema.safeParse(validRequest)
            expect(result.success).toBe(true)
        })

        test('Valid notification should validate', () => {
            const validNotification = {
                jsonrpc: '2.0',
                method: 'notify_method'
            }
            const result = JsonRpcServerMessageSchema.safeParse(validNotification)
            expect(result.success).toBe(true)
        })
        test('Response should fail', () => {
            const response = {
                jsonrpc: '2.0',
                result: 'success',
                id: 'test-id'
            }
            const result = JsonRpcServerMessageSchema.safeParse(response)
            expect(result.success).toBe(false)
        })

        test('Invalid message should fail', () => {
            const invalidMessage = {
                method: 'test_method'
            }
            const result = JsonRpcServerMessageSchema.safeParse(invalidMessage)
            expect(result.success).toBe(false)
        })
    })
})
