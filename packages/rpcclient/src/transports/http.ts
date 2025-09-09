import { AbstractRpcClientTransport, type JsonRpcMessage } from '@kylelayer/rpc'
export class HttpRpcClientTransport<
    const T_METHODS extends Record<string, any>,
    const T_NOTIFICATIONS extends Record<string, any>
> extends AbstractRpcClientTransport<T_METHODS, T_NOTIFICATIONS> {
    public readonly url: string
    public readonly fetch: typeof fetch = fetch
    constructor(options: {
        url: string
        requestTimeout?: number
    }) {
        super()
        this.url = options.url
    }

    public async send(message: JsonRpcMessage): Promise<void> {
        try {
            const response = await this.fetch(this.url, {
                body: JSON.stringify(message),
                headers: {
                    'Content-Type': 'application/json'
                }
            })
            this.receiver.emit('message', await response.text())
        } catch (error: any) {
            console.error(error)
        }
    }
}
