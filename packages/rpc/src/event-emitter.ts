/**
 * This is a pure-javascript, zero-dependency, strongly-typed isomorophic event emitter that works for most simple purposes
 */
export type EventMap = Record<string, any[]>

export class IsoEventEmitter<const T_EVENTS extends EventMap, E extends keyof T_EVENTS = keyof T_EVENTS> {
    protected callbacks: Record<keyof T_EVENTS, Array<(...args: T_EVENTS[E]) => unknown>>
    constructor() {
        this.callbacks = {} as Record<keyof T_EVENTS, Array<(...args: T_EVENTS[E]) => unknown>>
    }

    public emit(event: E, ...args: T_EVENTS[E]) {
        const callbacks = this.callbacks[event]
        if (!callbacks) return
        for (const callback of callbacks) {
            callback(...args)
        }
    }

    public subscribe(event: E, callback: (...args: T_EVENTS[E]) => any) {
        if (!this.callbacks[event]) this.callbacks[event] = []
        this.callbacks[event].push(callback)
    }

    public unsubscribe(event: E, callback: (...args: T_EVENTS[E]) => any) {
        if (!this.callbacks[event]) this.callbacks[event] = []
        for (let i = this.callbacks[event].length - 1; i >= 0; i--) {
            if (this.callbacks[event][i] === callback) {
                this.callbacks[event].splice(i, 1)
            }
        }
    }

    public unsubscribeAll(event: E): number {
        let cbCount = 0
        if (this.callbacks[event]) {
            cbCount = this.callbacks[event].length
            this.callbacks[event] = []
        }
        return cbCount
    }

    public listenerCount(event: E): number {
        return this.callbacks[event]?.length ?? 0
    }
}
