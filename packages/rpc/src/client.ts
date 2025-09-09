import type { z } from 'zod'
import { JsonRpcError } from './errors'
import type { JsonRpcErrorResponse, JsonRpcNotification, JsonRpcRequest, JsonRpcSuccessResponse } from './json-rpc'
import { JsonRpcResponseSchema } from './json-rpc'
import type { AbstractRpcClientTransport, RpcClientEvent } from './transports/abstract'
import { isJsonRpcErrorResponse, isJsonRpcSuccessResponse } from './types'

type RequestId = string | number

interface PendingRequest<T = any> {
    resolve: (value: T) => void
    reject: (error: Error) => void
    method: string
    timestamp: number
    timeout?: NodeJS.Timeout
}

export function createClientMethod<
    T_METHOD extends string,
    T_PARAMS extends z.ZodType,
    T_RESULT extends z.ZodType
>(options: {
    method: T_METHOD
    paramsSchema: T_PARAMS
    resultSchema: T_RESULT
}) {
    return {
        method: options.method,
        paramsSchema: options.paramsSchema,
        resultSchema: options.resultSchema
    } as const
}

export function createClientNotification<T_METHOD extends string, T_PARAMS extends z.ZodType>(options: {
    method: T_METHOD
    paramsSchema: T_PARAMS
}) {
    return {
        method: options.method,
        paramsSchema: options.paramsSchema
    } as const
}

export interface JsonRpcClientOptions {
    requestTimeout?: number
    shutdownTimeout?: number
    generateId?: () => RequestId
}

export class JsonRpcClient<
    const T_METHODS extends Record<string, any>,
    const T_NOTIFICATIONS extends Record<string, any>
> {
    private pendingRequests = new Map<RequestId, PendingRequest>()
    private nextRequestId = 1
    private defaultRequestTimeout: number
    private shutdownTimeout: number
    private generateId: () => RequestId
    private isShuttingDown = false
    public readonly supportedMethods: Array<keyof T_METHODS>
    public readonly methods: T_METHODS
    public readonly notifications: T_NOTIFICATIONS
    private transport: AbstractRpcClientTransport<T_METHODS, T_NOTIFICATIONS>

    private eventHandler = {
        handleEvent: async (event: RpcClientEvent) => this.handleResponse(event.message)
    }

    constructor(args: {
        methods: T_METHODS
        notifications: T_NOTIFICATIONS
        defaultRequestTimeout?: number
        shutdownTimeout?: number
        generateRequestId?: () => number | string
        transport: AbstractRpcClientTransport<T_METHODS, T_NOTIFICATIONS>
    }) {
        this.defaultRequestTimeout = args.defaultRequestTimeout ?? 30000
        this.shutdownTimeout = args.shutdownTimeout ?? 5000
        this.generateId = args.generateRequestId ?? (() => this.nextRequestId++)
        this.methods = args.methods
        this.supportedMethods = []
        for (const key in this.methods) {
            this.supportedMethods.push(key)
        }
        this.notifications = args.notifications
        this.transport = args.transport

        this.transport.receiver.subscribe('message', (message: string) => this.handleResponse(message))
    }

    async call<T_METHOD extends keyof T_METHODS>(
        method: T_METHOD,
        params: z.infer<T_METHODS[T_METHOD]['paramsSchema']>,
        options: { timeout: number } = { timeout: this.defaultRequestTimeout }
    ): Promise<z.infer<T_METHODS[T_METHOD]['resultSchema']>> {
        if (this.isShuttingDown) {
            throw new Error('Client is shutting down')
        }

        const methodDef = this.methods[method]
        if (!methodDef) {
            throw new Error(`Method ${String(method)} not found`)
        }

        const validatedParams = methodDef.paramsSchema.parse(params)
        const requestId = this.generateId()

        const request: JsonRpcRequest<string> = {
            jsonrpc: '2.0',
            method: method as string,
            params: validatedParams,
            id: requestId
        }

        return new Promise<z.infer<T_METHODS[T_METHOD]['resultSchema']>>((resolve, reject) => {
            const timeout = setTimeout(() => {
                const pendingRequest = this.pendingRequests.get(requestId)
                if (pendingRequest) {
                    this.pendingRequests.delete(requestId)
                    reject(new Error(`Request ${requestId} timed out after ${this.defaultRequestTimeout}ms`))
                }
            }, options.timeout ?? this.defaultRequestTimeout)

            this.pendingRequests.set(requestId, {
                resolve,
                reject,
                method: method as string,
                timestamp: Date.now(),
                timeout
            })

            this.transport.send(request)
        })
    }

    private async notify<T_METHOD extends keyof T_NOTIFICATIONS>(
        method: T_METHOD,
        params: z.infer<T_NOTIFICATIONS[T_METHOD]['paramsSchema']>
    ): Promise<void> {
        const notification: JsonRpcNotification = {
            method: method as string,
            jsonrpc: '2.0',
            params: params
        }
        try {
            await this.transport.send(notification)
        } catch (error) {
            console.error(error)
        }
    }

    public handleResponse(responseString: string): void {
        try {
            const responseObject = JSON.parse(responseString)
            const { data: response, error: parseError } = JsonRpcResponseSchema.safeParse(responseObject)

            if (parseError) {
                console.error('Failed to parse JSON-RPC response:', parseError)
                return
            }

            const requestId = response.id
            if (requestId === null) {
                console.warn('Received response with null ID')
                return
            }
            const pendingRequest = this.pendingRequests.get(requestId)

            if (!pendingRequest) {
                console.warn(`Received response for unknown request ID: ${requestId}`)
                return
            }

            this.pendingRequests.delete(requestId)
            if (pendingRequest.timeout) {
                clearTimeout(pendingRequest.timeout)
            }

            if (isJsonRpcSuccessResponse(response)) {
                const successResponse = response as JsonRpcSuccessResponse
                const methodDef = this.methods[pendingRequest.method as keyof T_METHODS]

                if (methodDef) {
                    try {
                        const validatedResult = methodDef.resultSchema.parse(successResponse.result)
                        pendingRequest.resolve(validatedResult)
                    } catch (validationError) {
                        pendingRequest.reject(new Error(`Invalid result format: ${validationError}`))
                    }
                } else {
                    pendingRequest.resolve(successResponse.result)
                }
            } else if (isJsonRpcErrorResponse(response)) {
                const errorResponse = response as JsonRpcErrorResponse
                const error = new JsonRpcError({
                    requestId: errorResponse.id,
                    error: {
                        code: errorResponse.error.code as any,
                        message: errorResponse.error.message,
                        data: errorResponse.error.data
                    }
                })
                pendingRequest.reject(
                    new JsonRpcError({
                        requestId: response.id,
                        error: response.error
                    })
                )
            } else {
                console.error('invalid message:')
            }
        } catch (error) {
            console.error('Failed to handle response:', error)
        }
    }

    async gracefulShutdown(): Promise<void> {
        this.isShuttingDown = true

        if (this.pendingRequests.size === 0) {
            if (this.transport?.disconnect) await this.transport.disconnect()
            return
        }

        const shutdownPromise = Promise.race([this.waitForPendingRequests(), this.waitForShutdownTimeout()])

        await shutdownPromise
        this.cancelPendingRequests()
        if (this.transport.disconnect) await this.transport.disconnect()
    }

    private async waitForPendingRequests(): Promise<void> {
        return new Promise<void>((resolve) => {
            const checkInterval = setInterval(() => {
                if (this.pendingRequests.size === 0) {
                    clearInterval(checkInterval)
                    resolve()
                }
            }, 100)
        })
    }

    private async waitForShutdownTimeout(): Promise<void> {
        return new Promise<void>((resolve) => {
            setTimeout(resolve, this.shutdownTimeout)
        })
    }

    private cancelPendingRequests(): void {
        for (const [requestId, pendingRequest] of this.pendingRequests) {
            if (pendingRequest.timeout) {
                clearTimeout(pendingRequest.timeout)
            }
            pendingRequest.reject(new Error('Client is shutting down'))
        }
        this.pendingRequests.clear()
    }

    getPendingRequestCount(): number {
        return this.pendingRequests.size
    }
}
