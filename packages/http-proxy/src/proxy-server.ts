import type { ProxyConfig } from './config.js'
import type { MessageProcessor, ProcessingContext, ResponseContext } from './message-processor.js'
import { DefaultProcessor, LoggingProcessor } from './message-processor.js'

export class ProxyServer {
    private config: ProxyConfig
    private processors: MessageProcessor[] = []
    private server?: ReturnType<typeof Bun.serve>
    private isRunning = false

    constructor(config: ProxyConfig) {
        this.config = config

        if (config.enableLogging) {
            this.processors.push(new LoggingProcessor())
        }
        this.processors.push(new DefaultProcessor())
    }

    addProcessor(processor: MessageProcessor): void {
        this.processors.unshift(processor)
    }

    async start(): Promise<void> {
        if (this.isRunning) {
            throw new Error('Server is already running')
        }

        this.server = Bun.serve({
            port: this.config.localPort,
            fetch: this.handleRequest.bind(this)
        })

        this.isRunning = true
        console.log(`HTTP Proxy server listening on port ${this.config.localPort}`)
        console.log(`Forwarding to ${this.config.targetHost}:${this.config.targetPort}`)
    }

    async stop(): Promise<void> {
        if (!this.isRunning || !this.server) {
            return
        }

        this.server.stop()
        this.isRunning = false
        console.log('HTTP Proxy server stopped')
    }

    private async handleRequest(request: Request): Promise<Response> {
        const requestId = crypto.randomUUID()
        const context: ProcessingContext = {
            request,
            config: this.config,
            timestamp: new Date(),
            requestId
        }

        try {
            let currentRequest = request
            let shouldForward = true
            let customResponse: Response | undefined

            for (const processor of this.processors) {
                const result = await processor.process({
                    ...context,
                    request: currentRequest
                })

                if (result.modifiedRequest) {
                    currentRequest = result.modifiedRequest
                }

                if (result.customResponse) {
                    customResponse = result.customResponse
                    shouldForward = false
                    break
                }

                if (!result.shouldForward) {
                    shouldForward = false
                    break
                }

                if (result.skipFurtherProcessing) {
                    break
                }
            }

            if (customResponse) {
                await this.processResponse(customResponse, request, context.timestamp, requestId);
                return customResponse
            }

            if (!shouldForward) {
                const blockedResponse = new Response('Request blocked by processor', { status: 403 });
                await this.processResponse(blockedResponse, request, context.timestamp, requestId);
                return blockedResponse
            }

            const response = await this.forwardRequest(currentRequest);
            await this.processResponse(response, request, context.timestamp, requestId);
            return response
        } catch (error) {
            console.error('Error processing request:', error)
            return new Response('Internal server error', { status: 500 })
        }
    }

    private async forwardRequest(request: Request): Promise<Response> {
        const url = new URL(request.url)
        const targetUrl = new URL(
            url.pathname + url.search,
            `http://${this.config.targetHost}:${this.config.targetPort}`
        )

        const headers = new Headers(request.headers)

        if (this.config.removeHeaders) {
            for (const header of this.config.removeHeaders) {
                headers.delete(header)
            }
        }

        if (this.config.customHeaders) {
            for (const [key, value] of Object.entries(this.config.customHeaders)) {
                headers.set(key, value)
            }
        }

        try {
            const timeoutPromise = new Promise<never>((_, reject) => {
                setTimeout(() => reject(new Error('Request timeout')), this.config.timeoutMs)
            })

            const fetchPromise = fetch(targetUrl.toString(), {
                method: request.method,
                headers,
                body: request.body
            })

            const response = await Promise.race([fetchPromise, timeoutPromise])
            return response
        } catch (error) {
            if (error instanceof Error && error.message === 'Request timeout') {
                return new Response('Request timeout', { status: 504 })
            }

            console.error('Error forwarding request:', error)
            return new Response('Bad gateway', { status: 502 })
        }
    }

    private async processResponse(response: Response, request: Request, timestamp: Date, requestId: string): Promise<void> {
        const responseContext: ResponseContext = {
            response,
            request,
            config: this.config,
            timestamp,
            requestId,
        };

        for (const processor of this.processors) {
            if (processor.processResponse) {
                try {
                    await processor.processResponse(responseContext);
                } catch (error) {
                    console.error(`Error in processor ${processor.name} while processing response:`, error);
                }
            }
        }
    }
}
