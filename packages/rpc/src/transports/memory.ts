import type { JsonRpcMessage } from '../json-rpc'
import type { JsonRpcServer } from '../server'
import { AbstractRpcClientTransport, AbstractRpcServerTransport } from './abstract'

// no direct server listener - it's in memory so the client just wraps it.
export class InMemoryRpcServerTransport<
    const T_METHODS extends Record<string, any>,
    const T_NOTIFICATIONS extends Record<string, any>
> extends AbstractRpcServerTransport<T_METHODS, T_NOTIFICATIONS> {
    public override rpcServer: JsonRpcServer<T_METHODS, T_NOTIFICATIONS>
    constructor(server: JsonRpcServer<T_METHODS, T_NOTIFICATIONS>) {
        super(server)
        this.rpcServer = server
    }
}

export class InMemoryRpcClientTransport<
    const T_METHODS extends Record<string, any>,
    const T_NOTIFICATIONS extends Record<string, any>
> extends AbstractRpcClientTransport<T_METHODS, T_NOTIFICATIONS> {
    private server: InMemoryRpcServerTransport<T_METHODS, T_NOTIFICATIONS>
    constructor(server: InMemoryRpcServerTransport<T_METHODS, T_NOTIFICATIONS>) {
        super()
        this.server = server
    }

    public async send(message: JsonRpcMessage): Promise<void> {
        const response = await this.server.rpcServer.handleRawMessage(JSON.stringify(message))

        // if response === null then it's a notification so there is no response emitted
        if (response) this.receiver.emit('message', JSON.stringify(response))
    }
}
