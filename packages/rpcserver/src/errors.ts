import type z from 'zod'

export const JsonRpcErrorCodes = {
    PARSE_ERROR: -32700,
    INVALID_REQUEST: -3600,
    METHOD_NOT_FOUND: -32601,
    INVALID_PARAMETERS: -32606,
    INTERNAL_SERVER_ERROR: -32603,
    RESOURCE_NOT_FOUND: -32004
} as const

export const JsonRpcCustomErrorCodes = {} as const

export class JsonRpcError extends Error {
    public code: (typeof JsonRpcErrorCodes)[keyof typeof JsonRpcErrorCodes]
    public data?: any
    public requestId: number | string | null
    public message: string

    constructor(options: {
        requestId: number | string | null
        error: {
            code: (typeof JsonRpcErrorCodes)[keyof typeof JsonRpcErrorCodes]
            message: string
            data?: any
        }
    }) {
        super(options.error.message)
        this.code = options.error.code
        this.data = options.error.data
        this.requestId = options.requestId
    }
}

export class MethodNotFoundError extends JsonRpcError {
    constructor(options: {
        requestId: string | number | null
        method: string
    }) {
        super({
            requestId: options.requestId,
            error: { code: JsonRpcErrorCodes.METHOD_NOT_FOUND, message: `unable to find method ${options.method}` }
        })
    }
}

export class InvalidParametersError extends JsonRpcError {
    constructor(options: {
        requestId: string | number | null
        zodError: z.ZodError
    }) {
        super({
            requestId: options.requestId,
            error: {
                code: JsonRpcErrorCodes.INVALID_PARAMETERS,
                message: `invalid parameters: ${options.zodError.message}`
            }
        })
    }
}

export abstract class CustomServerError extends JsonRpcError {
    constructor(options: {
        requestId: string | number | null
        error: {
            message: string
            code: (typeof JsonRpcCustomErrorCodes)[keyof typeof JsonRpcCustomErrorCodes]
            data?: any
        }
    }) {
        super({ requestId: options.requestId, error: options.error })
    }
}
