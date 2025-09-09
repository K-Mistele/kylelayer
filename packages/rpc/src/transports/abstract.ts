import { IsoEventEmitter } from '../event-emitter'
import type { JsonRpcMessage } from '../json-rpc'
import type { JsonRpcServer } from '../server'

export abstract class AbstractRpcServerTransport<
    const T_METHODS extends Record<string, any>,
    const T_NOTIFICATIONS extends Record<string, any>
> {
    protected rpcServer: JsonRpcServer<T_METHODS, T_NOTIFICATIONS>

    protected constructor(rpcServer: JsonRpcServer<T_METHODS, T_NOTIFICATIONS>) {
        this.rpcServer = rpcServer
    }
}

export type RpcClientTransportEventMap = { message: [string] }

export abstract class AbstractRpcClientTransport<
    const T_METHODS extends Record<string, any>,
    const T_NOTIFICATIONS extends Record<string, any>
> {
    public abstract send(message: JsonRpcMessage): Promise<unknown>
    public receiver: IsoEventEmitter<{ message: [string] }>

    public disconnect?: () => Promise<void>

    protected constructor() {
        this.receiver = new IsoEventEmitter<{ message: [string] }>()
    }
}

export class RpcClientEvent extends Event {
    constructor(public message: string) {
        super('message')
    }
}
