import { z } from 'zod'

export const JsonRpcRequestSchema = z
    .object({
        jsonrpc: z.literal('2.0'),
        method: z.string(),
        params: z.any().optional(),
        id: z.union([z.number(), z.string()])
    })
    .refine((obj) => obj.method !== null)

export const JsonRpcSuccessResponseSchema = z.object({
    jsonrpc: z.literal('2.0'),
    result: z.any(),
    id: z.union([z.number(), z.string()])
})

export const JsonRpcErrorResponseSchema = z.object({
    jsonrpc: z.literal('2.0'),
    id: z.union([z.number(), z.string(), z.null()]),
    error: z.object({
        code: z.number(),
        message: z.string(),
        data: z.any().optional()
    })
})
export type JsonRpcErrorResponse = z.infer<typeof JsonRpcErrorResponseSchema>
export type JsonRpcSuccessResponse = z.infer<typeof JsonRpcSuccessResponseSchema>

export const JsonRpcResponseSchema = JsonRpcSuccessResponseSchema.or(JsonRpcErrorResponseSchema)

export type JsonRpcRequest<T_METHOD extends string, T_PARAMS = any> = z.infer<typeof JsonRpcRequestSchema>

export type JsonRpcResponse<T_RESULT = any> = z.infer<typeof JsonRpcResponseSchema>
export const JsonRpcBatchRequestSchema = z.array(JsonRpcRequestSchema).min(1)
export type JsonRpcBatchRequest = z.infer<typeof JsonRpcBatchRequestSchema>

/**
 * in JSON-RPC a notification does not specify an `id` and a response SHOULD NOT be sent
 */
export const JsonRpcNotificationSchema = z
    .object({
        jsonrpc: z.literal('2.0'),
        method: z.string(),
        params: z.any().optional()
    })
    .refine((o) => o.params !== null)
    .strict()

export type JsonRpcNotification = z.infer<typeof JsonRpcNotificationSchema>

export const JsonRpcServerMessageSchema = z.union([JsonRpcRequestSchema, JsonRpcNotificationSchema])
export type JsonRpcServerMessage = z.infer<typeof JsonRpcServerMessageSchema>
