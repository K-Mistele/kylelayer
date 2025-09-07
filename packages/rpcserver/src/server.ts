import { sessionSchema } from '@kylelayer/protocol'
import { z } from 'zod'
import {
    CustomServerError,
    InvalidParametersError,
    JsonRpcError,
    JsonRpcErrorCodes as JsonRpcErrorCode,
    MethodNotFoundError
} from './errors'
import {
    type JsonRpcErrorResponse,
    type JsonRpcNotification,
    JsonRpcNotificationSchema,
    type JsonRpcRequest,
    JsonRpcRequestSchema,
    type JsonRpcResponse,
    type JsonRpcSuccessResponse
} from './json-rpc'
import type { Fallbackhandler as FallbackHandler } from './types'

/**
 * Strongly-typed way to create a method
 * @param method
 * @param params
 * @param result
 * @returns
 */
export function createRequestHandler<
    T_METHOD extends string,
    T_PARAMS extends z.ZodType,
    T_RESULT extends z.ZodType
>(options: {
    method: T_METHOD
    paramsSchema: T_PARAMS
    resultSchema: T_RESULT
    handler: (params: z.infer<T_PARAMS>) => z.infer<T_RESULT> | Promise<z.infer<T_RESULT>>
}) {
    const { method, paramsSchema, resultSchema } = options
    return {
        method,
        paramsSchema,
        resultSchema,
        handler: options.handler
    } as const
}

export function createNotificationhandler<T_METHOD extends string, T_PARAMS extends z.ZodType>(options: {
    method: T_METHOD
    paramsSchema: T_PARAMS
    handler: (params: any) => void | Promise<void>
}) {
    const { method, paramsSchema, handler } = options
    return {
        method,
        paramsSchema,
        handler
    } as const
}

export class JsonRpcServer<
    const T_HANDLERS extends Record<string, any>,
    const T_NOTIFICATIONS extends Record<string, any>
> {
    public readonly handlers: T_HANDLERS
    public readonly notifications?: T_NOTIFICATIONS
    private fallback?: FallbackHandler
    public readonly methods: Array<keyof T_HANDLERS>

    constructor(args: {
        handlers: T_HANDLERS
        unknownMethodHandler?: FallbackHandler
        notifications?: T_NOTIFICATIONS
    }) {
        this.handlers = args.handlers
        this.fallback = args.unknownMethodHandler
        this.methods = []
        this.notifications = args.notifications
        for (const key in this.handlers) {
            this.methods.push(key)
        }
    }

    /**
     * Handle a raw string received e.g. from a UNIX domain socket. returns the RPC response or null
     * @param message
     * @returns
     */
    public async handleRawMessage(message: string): Promise<JsonRpcResponse | null> {
        // Try to parse the string if not return a parse error
        let requestObject: any
        try {
            requestObject = JSON.parse(message)
        } catch (error: any) {
            return {
                jsonrpc: '2.0',
                error: {
                    code: JsonRpcErrorCode.PARSE_ERROR,
                    message: 'invalid JSON payload structure'
                },
                id: null
            } satisfies JsonRpcResponse
        }
        return await this.handleMessage(requestObject)
    }

    /**
     * Handle a JSON RPC server message - either a request or a notification. returns the response or null
     * @param serverMessage
     * @returns
     */
    public async handleMessage(
        serverMessage: any
    ): Promise<JsonRpcResponse<z.infer<T_HANDLERS[keyof T_HANDLERS]['resultSchema']>> | null> {
        console.log('parsing message:', serverMessage)
        // Validate it as a JSON RPC request / notification; throwing the correct error if appropriate
        const { data, error } =
            'id' in serverMessage
                ? JsonRpcRequestSchema.safeParse(serverMessage)
                : JsonRpcNotificationSchema.safeParse(serverMessage)

        if (error) {
            return {
                jsonrpc: '2.0',
                id: serverMessage && 'id' in serverMessage && serverMessage?.id ? serverMessage.id : null,
                error: {
                    code: JsonRpcErrorCode.INVALID_REQUEST,
                    message: `invalid JSON RPC request: ${error.message}`
                }
            } satisfies JsonRpcErrorResponse
        }
        try {
            if ('id' in data) return await this.handleRpcRequest(data)
            await this.handleRpcNotification(data)
            return null
        } catch (error: unknown) {
            if (error instanceof JsonRpcError && error.requestId) {
                return {
                    jsonrpc: '2.0',
                    id: error.requestId,
                    error: {
                        code: error.code,
                        message: error.message,
                        data: error.data
                    }
                }
            }
            // If it's a custom server error use its' internal error information
            if (error instanceof CustomServerError && error.requestId) {
                return {
                    jsonrpc: '2.0',
                    id: error.requestId,
                    error: {
                        code: error.code,
                        message: error.message,
                        data: error.data
                    }
                } satisfies JsonRpcErrorResponse
            }

            // Otherwise return a standard internal server error
            if (error && 'id' in data && (typeof data.id === 'string' || typeof data.id === 'number')) {
                return {
                    jsonrpc: '2.0',
                    id: data.id,
                    error: {
                        code: JsonRpcErrorCode.INTERNAL_SERVER_ERROR,
                        message: (error as any)?.message ?? 'an unknown error occurred'
                    }
                } satisfies JsonRpcErrorResponse
            }
            return null
        }
    }

    private async handleRpcRequest(
        request: JsonRpcRequest<
            T_HANDLERS[keyof T_HANDLERS]['method'],
            z.infer<T_HANDLERS[keyof T_HANDLERS]['paramsSchema']>
        >
    ): Promise<JsonRpcSuccessResponse> {
        console.log('handling request:', request)
        // validate the method
        const method = this.handlers[request.method]
        if (!method) throw new MethodNotFoundError({ requestId: request.id, method: request.method })

        // validate the parameters
        let params: z.infer<typeof method.paramsSchema>
        try {
            params = method.paramsSchema.parse(request.params)
        } catch (error: unknown) {
            console.error('Invalid parameters error', error)
            throw new InvalidParametersError({ requestId: request.id, zodError: error as z.ZodError })
        }

        // execute the result; this will be caught if it throws to get a server error
        const result: z.infer<typeof method.resultSchema> = await Promise.resolve(method.handler(params))
        return {
            id: request.id,
            jsonrpc: '2.0',
            result: result
        } satisfies JsonRpcSuccessResponse
    }

    private async handleRpcNotification(notification: JsonRpcNotification): Promise<void> {
        const method = this.notifications?.[notification.method]
        if (!method) throw new MethodNotFoundError({ requestId: null, method: notification.method })

        // validate the parameters
        let params: z.infer<typeof method.paramsSchema>
        try {
            params = method.paramsSchema.parse(notification.params)
        } catch (error: unknown) {
            throw new InvalidParametersError({ requestId: null, zodError: error as z.ZodError })
        }

        // execute the result; this will be caught if it throws to get a server error
        await Promise.resolve(method.handler(params))
    }
}

const handler = new JsonRpcServer({
    handlers: {
        list_sessions: createRequestHandler({
            method: 'list_sessions',
            paramsSchema: z.object({ test: z.string().optional() }),
            resultSchema: z.array(sessionSchema),
            handler: (params) => {
                return []
            }
        })
    },
    notifications: {},
    unknownMethodHandler: (method: string, params: any) => {
        console.warn(`Invalid method ${method} (`, params, ')')
    }
})
