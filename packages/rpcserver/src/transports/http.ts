import type { JsonRpcResponse, JsonRpcServer } from '@kylelayer/rpc'
import { AbstractRpcServerTransport } from '@kylelayer/rpc'
import { serve } from 'bun'

export class HttpRpcServerTransport<
    const T_METHODS extends Record<string, any>,
    const T_NOTIFICATIONS extends Record<string, any>
> extends AbstractRpcServerTransport<T_METHODS, T_NOTIFICATIONS> {
    protected server: ReturnType<typeof serve>
    constructor(
        server: JsonRpcServer<T_METHODS, T_NOTIFICATIONS>,
        options: {
            port: number
        }
    ) {
        super(server)

        this.server = serve({
            port: options.port ?? process.env?.PORT ?? 4000,
            fetch: async (request: Request): Promise<Response> => {
                const body = await request.text()
                const responseMessage: JsonRpcResponse | null = await this.rpcServer.handleRawMessage(body)

                // if there's a response send it
                if (responseMessage)
                    return new Response(JSON.stringify(responseMessage), {
                        status: 200,
                        headers: new Headers({
                            'Content-Type': 'application/json'
                        })
                    })

                // if not (valid - null responseMessage means it was a JSON RPC notification which does not require a response)
                // then send a HTTP 204
                return new Response(null, { status: 204 })
            }
        })
    }
}
