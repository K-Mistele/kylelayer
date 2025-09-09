import chalk from 'chalk'
import type { ProxyConfig } from './config.js'

export interface ProcessingContext {
    request: Request
    config: ProxyConfig
    timestamp: Date
    requestId: string
}

export interface ProcessingResult {
    shouldForward: boolean
    modifiedRequest?: Request
    customResponse?: Response
    skipFurtherProcessing?: boolean
}

export interface ResponseContext {
    request: Request
    response: Response
    config: ProxyConfig
    timestamp: Date
    requestId: string
}

export interface MessageProcessor {
    name: string
    process(context: ProcessingContext): Promise<ProcessingResult> | ProcessingResult
    processResponse?(context: ResponseContext): Promise<void> | void
}

export class DefaultProcessor implements MessageProcessor {
    name = 'default'

    process(_context: ProcessingContext): ProcessingResult {
        return {
            shouldForward: true
        }
    }
}

export class LoggingProcessor implements MessageProcessor {
    name = 'logging'

    async process(context: ProcessingContext): Promise<ProcessingResult> {
        await this.logRequest(context.request, context.requestId)
        return {
            shouldForward: true
        }
    }

    async processResponse(context: ResponseContext): Promise<void> {
        await this.logResponse(context.response, context.request, context.requestId)
    }

    private async logRequest(request: Request, requestId: string): Promise<void> {
        const { method, url } = request
        const body = await this.getRequestBody(request)

        const urlObj = new URL(url)
        const pathWithQuery = urlObj.pathname + urlObj.search

        // Color code by HTTP method
        const methodColor = this.getMethodColor(method)
        const arrow = chalk.gray('→')

        console.log(
            `${chalk.gray(`[${requestId.slice(0, 8)}]`)} ${methodColor(method)} ${chalk.cyan(pathWithQuery)} ${arrow}`
        )

        if (body) {
            try {
                // Try to format as JSON for better readability
                const parsed = JSON.parse(body)
                console.log(
                    chalk.gray('    ') +
                        JSON.stringify(parsed, null, 4)
                            .split('\n')
                            .join('\n' + chalk.gray('    '))
                )
            } catch {
                // Fall back to plain text
                console.log(chalk.gray('    ') + body)
            }
        }
    }

    private async logResponse(response: Response, request: Request, requestId: string): Promise<void> {
        const { status, statusText } = response
        const responseBody = await this.getResponseBody(response)

        // Color code by status
        const statusColor = this.getStatusColor(status)
        const arrow = chalk.gray('←')

        console.log(`${chalk.gray(`[${requestId.slice(0, 8)}]`)} ${statusColor(`${status} ${statusText}`)} ${arrow}`)

        if (responseBody) {
            try {
                // Try to format as JSON for better readability
                const parsed = JSON.parse(responseBody)
                console.log(
                    chalk.gray('    ') +
                        JSON.stringify(parsed, null, 4)
                            .split('\n')
                            .join('\n' + chalk.gray('    '))
                )
            } catch {
                // Fall back to plain text, truncate if too long
                const truncated = responseBody.length > 500 ? responseBody.slice(0, 500) + '...' : responseBody
                console.log(chalk.gray('    ') + truncated)
            }
        }
        console.log() // Empty line between request/response pairs
    }

    private getMethodColor(method: string) {
        switch (method.toUpperCase()) {
            case 'GET':
                return chalk.green
            case 'POST':
                return chalk.blue
            case 'PUT':
                return chalk.yellow
            case 'DELETE':
                return chalk.red
            case 'PATCH':
                return chalk.magenta
            case 'HEAD':
                return chalk.cyan
            case 'OPTIONS':
                return chalk.gray
            default:
                return chalk.white
        }
    }

    private getStatusColor(status: number) {
        if (status >= 200 && status < 300) return chalk.green
        if (status >= 300 && status < 400) return chalk.yellow
        if (status >= 400 && status < 500) return chalk.red
        if (status >= 500) return chalk.magenta
        return chalk.gray
    }

    private async getRequestBody(request: Request): Promise<string | null> {
        try {
            if (!request.body || request.method === 'GET' || request.method === 'HEAD') {
                return null
            }

            const cloned = request.clone()
            const text = await cloned.text()
            return text || null
        } catch {
            return null
        }
    }

    private async getResponseBody(response: Response): Promise<string | null> {
        try {
            const cloned = response.clone()
            const text = await cloned.text()
            return text || null
        } catch {
            return null
        }
    }
}
