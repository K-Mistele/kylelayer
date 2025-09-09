import type z from 'zod'

export const JsonRpcErrorCodes = {
    PARSE_ERROR: -32700,
    INVALID_REQUEST: -32600,
    METHOD_NOT_FOUND: -32601,
    INVALID_PARAMETERS: -32606,
    INTERNAL_SERVER_ERROR: -32603,
    RESOURCE_NOT_FOUND: -32004
} as const

export const JsonRpcCustomErrorCodes = {} as const

export const standardErrorCodes: Array<(typeof JsonRpcErrorCodes)[keyof typeof JsonRpcErrorCodes]> =
    Object.values(JsonRpcErrorCodes)

export const customErrorCodes: Array<(typeof JsonRpcCustomErrorCodes)[keyof typeof JsonRpcCustomErrorCodes]> =
    Object.values(JsonRpcCustomErrorCodes)

export const allErrorCodes = [...standardErrorCodes, ...customErrorCodes]

export class JsonRpcError extends Error {
    public code: number
    public data?: any
    public requestId: number | string | null

    constructor(options: {
        requestId: number | string | null
        error: {
            code: number
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
