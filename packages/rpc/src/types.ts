import {
    type JsonRpcErrorResponse,
    JsonRpcErrorResponseSchema,
    type JsonRpcNotification,
    JsonRpcNotificationSchema,
    type JsonRpcRequest,
    JsonRpcRequestSchema,
    type JsonRpcResponse,
    type JsonRpcSuccessResponse,
    JsonRpcSuccessResponseSchema
} from './json-rpc'

export type Fallbackhandler = (methodName: string, params: any) => any | Promise<any>

/**
 * Type guard to check if something is a notification
 * will FAIL if it's a message (has an ID)
 * @param message
 * @returns
 */
export function isJsonRpcNotification(message: any): message is JsonRpcNotification {
    const { data, success, error } = JsonRpcNotificationSchema.safeParse(message)
    return success && !Object.hasOwn(message, 'id')
}

/**
 * Type guard to check if something is a JSON RPC request
 * will FAIL if it's a notification (lacks an ID)
 * @param message
 * @returns
 */
export function isJsonRpcRequest(message: any): message is JsonRpcRequest<string, any> {
    const { success } = JsonRpcRequestSchema.safeParse(message)
    return success && Object.hasOwn(message, 'id')
}

export function isJsonRpcSuccessResponse(response: JsonRpcResponse): response is JsonRpcSuccessResponse {
    const { success } = JsonRpcSuccessResponseSchema.safeParse(response)
    return success && !Object.hasOwn(response, 'error')
}

export function isJsonRpcErrorResponse(response: JsonRpcResponse): response is JsonRpcErrorResponse {
    const { success } = JsonRpcErrorResponseSchema.safeParse(response)
    return success
}
