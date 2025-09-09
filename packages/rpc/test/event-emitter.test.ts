import { beforeEach, describe, expect, test } from 'bun:test'
import { IsoEventEmitter } from '../src/event-emitter'

// Define test event maps for type safety
type TestEvents = {
    message: [string]
    data: [number, boolean]
    error: [Error]
    multiParam: [string, number, object]
    noParam: []
}

type SimpleEvents = {
    click: []
    change: [string]
}

describe('IsoEventEmitter', () => {
    let emitter: IsoEventEmitter<TestEvents>
    let simpleEmitter: IsoEventEmitter<SimpleEvents>

    // Track function calls for testing
    const callLog: Array<{ event: string; args: any[] }> = []

    beforeEach(() => {
        emitter = new IsoEventEmitter<TestEvents>()
        simpleEmitter = new IsoEventEmitter<SimpleEvents>()
        callLog.length = 0 // Clear the log
    })

    describe('subscribe and emit', () => {
        test('should subscribe and emit single parameter events', () => {
            const callback = (msg: string) => {
                callLog.push({ event: 'message', args: [msg] })
            }

            emitter.subscribe('message', callback)
            emitter.emit('message', 'hello world')

            expect(callLog).toHaveLength(1)
            expect(callLog[0]).toEqual({ event: 'message', args: ['hello world'] })
        })

        test('should subscribe and emit multi-parameter events', () => {
            const callback = (num: number, bool: boolean) => {
                callLog.push({ event: 'data', args: [num, bool] })
            }

            emitter.subscribe('data', callback)
            emitter.emit('data', 42, true)

            expect(callLog).toHaveLength(1)
            expect(callLog[0]).toEqual({ event: 'data', args: [42, true] })
        })

        test('should subscribe and emit no-parameter events', () => {
            const callback = () => {
                callLog.push({ event: 'noParam', args: [] })
            }

            emitter.subscribe('noParam', callback)
            emitter.emit('noParam')

            expect(callLog).toHaveLength(1)
            expect(callLog[0]).toEqual({ event: 'noParam', args: [] })
        })

        test('should handle multiple subscribers to the same event', () => {
            const callback1 = (msg: string) => {
                callLog.push({ event: 'message1', args: [msg] })
            }
            const callback2 = (msg: string) => {
                callLog.push({ event: 'message2', args: [msg] })
            }

            emitter.subscribe('message', callback1)
            emitter.subscribe('message', callback2)
            emitter.emit('message', 'test')

            expect(callLog).toHaveLength(2)
            expect(callLog[0]).toEqual({ event: 'message1', args: ['test'] })
            expect(callLog[1]).toEqual({ event: 'message2', args: ['test'] })
        })

        test('should handle multiple events with different parameters', () => {
            const messageCallback = (msg: string) => {
                callLog.push({ event: 'message', args: [msg] })
            }
            const dataCallback = (num: number, bool: boolean) => {
                callLog.push({ event: 'data', args: [num, bool] })
            }

            emitter.subscribe('message', messageCallback)
            emitter.subscribe('data', dataCallback)

            emitter.emit('message', 'hello')
            emitter.emit('data', 123, false)

            expect(callLog).toHaveLength(2)
            expect(callLog[0]).toEqual({ event: 'message', args: ['hello'] })
            expect(callLog[1]).toEqual({ event: 'data', args: [123, false] })
        })

        test('should emit events with no subscribers without error', () => {
            // This should not throw an error (tests the fix we made earlier)
            expect(() => {
                emitter.emit('message', 'no listeners')
                emitter.emit('data', 42, true)
                emitter.emit('noParam')
            }).not.toThrow()

            expect(callLog).toHaveLength(0)
        })
    })

    describe('unsubscribe', () => {
        test('should unsubscribe a specific callback', () => {
            const callback1 = (msg: string) => {
                callLog.push({ event: 'callback1', args: [msg] })
            }
            const callback2 = (msg: string) => {
                callLog.push({ event: 'callback2', args: [msg] })
            }

            emitter.subscribe('message', callback1)
            emitter.subscribe('message', callback2)

            // Emit before unsubscribe
            emitter.emit('message', 'test1')
            expect(callLog).toHaveLength(2)

            // Unsubscribe one callback
            emitter.unsubscribe('message', callback1)
            callLog.length = 0 // Clear log

            // Emit after unsubscribe
            emitter.emit('message', 'test2')
            expect(callLog).toHaveLength(1)
            expect(callLog[0]).toEqual({ event: 'callback2', args: ['test2'] })
        })

        test('should handle unsubscribing non-existent callback', () => {
            const callback1 = (msg: string) => {
                callLog.push({ event: 'callback1', args: [msg] })
            }
            const callback2 = (msg: string) => {
                callLog.push({ event: 'callback2', args: [msg] })
            }

            emitter.subscribe('message', callback1)

            // Try to unsubscribe a callback that was never subscribed
            expect(() => {
                emitter.unsubscribe('message', callback2)
            }).not.toThrow()

            // Original callback should still work
            emitter.emit('message', 'test')
            expect(callLog).toHaveLength(1)
            expect(callLog[0]).toEqual({ event: 'callback1', args: ['test'] })
        })

        test('should handle unsubscribing from non-existent event', () => {
            const callback = (msg: string) => {}

            // Should not throw when unsubscribing from event with no listeners
            expect(() => {
                emitter.unsubscribe('message', callback)
            }).not.toThrow()
        })
    })

    describe('unsubscribeAll', () => {
        test('should remove all subscribers from an event', () => {
            const callback1 = (msg: string) => {
                callLog.push({ event: 'callback1', args: [msg] })
            }
            const callback2 = (msg: string) => {
                callLog.push({ event: 'callback2', args: [msg] })
            }
            const callback3 = (msg: string) => {
                callLog.push({ event: 'callback3', args: [msg] })
            }

            emitter.subscribe('message', callback1)
            emitter.subscribe('message', callback2)
            emitter.subscribe('message', callback3)

            // Verify all callbacks are working
            emitter.emit('message', 'test1')
            expect(callLog).toHaveLength(3)

            // Unsubscribe all
            const removedCount = emitter.unsubscribeAll('message')
            expect(removedCount).toBe(3)

            callLog.length = 0 // Clear log

            // Emit after unsubscribe all
            emitter.emit('message', 'test2')
            expect(callLog).toHaveLength(0)
        })

        test('should return 0 when unsubscribing all from event with no listeners', () => {
            const removedCount = emitter.unsubscribeAll('message')
            expect(removedCount).toBe(0)
        })

        test('should not affect other events when unsubscribing all from one event', () => {
            const messageCallback = (msg: string) => {
                callLog.push({ event: 'message', args: [msg] })
            }
            const dataCallback = (num: number, bool: boolean) => {
                callLog.push({ event: 'data', args: [num, bool] })
            }

            emitter.subscribe('message', messageCallback)
            emitter.subscribe('data', dataCallback)

            // Unsubscribe all from message event
            emitter.unsubscribeAll('message')

            // Data event should still work
            emitter.emit('data', 42, true)
            expect(callLog).toHaveLength(1)
            expect(callLog[0]).toEqual({ event: 'data', args: [42, true] })

            // Message event should not work
            emitter.emit('message', 'test')
            expect(callLog).toHaveLength(1) // Should still be 1
        })
    })

    describe('listenerCount', () => {
        test('should return correct listener count', () => {
            expect(emitter.listenerCount('message')).toBe(0)

            const callback1 = (msg: string) => {}
            const callback2 = (msg: string) => {}
            const callback3 = (msg: string) => {}

            emitter.subscribe('message', callback1)
            expect(emitter.listenerCount('message')).toBe(1)

            emitter.subscribe('message', callback2)
            expect(emitter.listenerCount('message')).toBe(2)

            emitter.subscribe('message', callback3)
            expect(emitter.listenerCount('message')).toBe(3)

            emitter.unsubscribe('message', callback2)
            expect(emitter.listenerCount('message')).toBe(2)

            emitter.unsubscribeAll('message')
            expect(emitter.listenerCount('message')).toBe(0)
        })

        test('should return 0 for events with no listeners', () => {
            expect(emitter.listenerCount('message')).toBe(0)
            expect(emitter.listenerCount('data')).toBe(0)
            expect(emitter.listenerCount('error')).toBe(0)
        })
    })

    describe('edge cases and error handling', () => {
        test('should handle subscribing the same callback multiple times', () => {
            const callback = (msg: string) => {
                callLog.push({ event: 'message', args: [msg] })
            }

            emitter.subscribe('message', callback)
            emitter.subscribe('message', callback) // Subscribe same callback again

            emitter.emit('message', 'test')

            // Should be called twice since it was subscribed twice
            expect(callLog).toHaveLength(2)
            expect(callLog[0]).toEqual({ event: 'message', args: ['test'] })
            expect(callLog[1]).toEqual({ event: 'message', args: ['test'] })
        })

        test('should handle callbacks that throw errors', () => {
            const goodCallback = (msg: string) => {
                callLog.push({ event: 'good', args: [msg] })
            }
            const badCallback = (msg: string) => {
                throw new Error('Callback error')
            }
            const anotherGoodCallback = (msg: string) => {
                callLog.push({ event: 'good2', args: [msg] })
            }

            emitter.subscribe('message', goodCallback)
            emitter.subscribe('message', badCallback)
            emitter.subscribe('message', anotherGoodCallback)

            // The error should be thrown, but let's test that it doesn't prevent other callbacks
            expect(() => {
                emitter.emit('message', 'test')
            }).toThrow('Callback error')

            // Only the first callback should have been called before the error
            expect(callLog).toHaveLength(1)
            expect(callLog[0]).toEqual({ event: 'good', args: ['test'] })
        })

        test('should handle complex parameter types', () => {
            const obj = { foo: 'bar', nested: { value: 42 } }

            const callback = (str: string, num: number, object: object) => {
                callLog.push({ event: 'multiParam', args: [str, num, object] })
            }

            emitter.subscribe('multiParam', callback)
            emitter.emit('multiParam', 'test', 123, obj)

            expect(callLog).toHaveLength(1)
            expect(callLog[0]).toEqual({ event: 'multiParam', args: ['test', 123, obj] })
        })

        test('should work with different event emitter instances', () => {
            const callback1 = () => {
                callLog.push({ event: 'emitter1', args: [] })
            }
            const callback2 = (value: string) => {
                callLog.push({ event: 'emitter2', args: [value] })
            }

            emitter.subscribe('noParam', callback1)
            simpleEmitter.subscribe('change', callback2)

            emitter.emit('noParam')
            simpleEmitter.emit('change', 'test')

            expect(callLog).toHaveLength(2)
            expect(callLog[0]).toEqual({ event: 'emitter1', args: [] })
            expect(callLog[1]).toEqual({ event: 'emitter2', args: ['test'] })
        })
    })

    describe('type safety tests', () => {
        test('should work with strongly typed events', () => {
            // This test mainly verifies that TypeScript compilation works correctly
            // and that the event emitter maintains type safety

            const messageCallback = (msg: string) => {
                expect(typeof msg).toBe('string')
                callLog.push({ event: 'message', args: [msg] })
            }

            const dataCallback = (num: number, bool: boolean) => {
                expect(typeof num).toBe('number')
                expect(typeof bool).toBe('boolean')
                callLog.push({ event: 'data', args: [num, bool] })
            }

            const errorCallback = (err: Error) => {
                expect(err).toBeInstanceOf(Error)
                callLog.push({ event: 'error', args: [err] })
            }

            emitter.subscribe('message', messageCallback)
            emitter.subscribe('data', dataCallback)
            emitter.subscribe('error', errorCallback)

            emitter.emit('message', 'hello')
            emitter.emit('data', 42, true)
            emitter.emit('error', new Error('test error'))

            expect(callLog).toHaveLength(3)
            expect(callLog[0]).toEqual({ event: 'message', args: ['hello'] })
            expect(callLog[1]).toEqual({ event: 'data', args: [42, true] })
            expect(callLog[2]!.event).toBe('error')
            expect(callLog[2]!.args[0]).toBeInstanceOf(Error)
            expect((callLog[2]!.args[0] as Error).message).toBe('test error')
        })
    })
})
