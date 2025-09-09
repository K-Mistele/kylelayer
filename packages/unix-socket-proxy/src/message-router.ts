export type RoutingRule = (message: string) => boolean

export interface RoutingDecision {
  shouldForward: boolean
  internalResponse?: string
}

export interface MessageRouterOptions {
  rules?: RoutingRule[]
  defaultAction?: 'forward' | 'internal'
  logger?: {
    info: (message: string, ...args: any[]) => void
    error: (message: string, ...args: any[]) => void
    debug: (message: string, ...args: any[]) => void
  }
}

export class MessageRouter {
  private options: MessageRouterOptions

  constructor(options: MessageRouterOptions = {}) {
    this.options = {
      rules: [],
      defaultAction: 'forward',
      logger: {
        info: () => {},
        error: () => {},
        debug: () => {}
      },
      ...options
    }
  }

  /**
   * Determine whether a message should be forwarded or handled internally
   * @param message The message to route
   * @returns Routing decision
   */
  routeMessage(message: string): RoutingDecision {
    this.options.logger?.debug(`Routing message: ${message}`)

    // Check each rule to see if any match
    for (const rule of this.options.rules || []) {
      try {
        if (rule(message)) {
          this.options.logger?.debug(`Message matched rule, using internal handling`)
          return { shouldForward: false }
        }
      } catch (error) {
        this.options.logger?.error(`Error evaluating routing rule:`, error)
        // Continue to next rule on error
      }
    }

    // Use default action if no rules match
    const shouldForward = this.options.defaultAction === 'forward'
    this.options.logger?.debug(`No rules matched, using default action: ${this.options.defaultAction}`)
    
    return { shouldForward }
  }

  /**
   * Add a routing rule to the router
   * @param rule Function that returns true if message should be handled internally
   */
  addRule(rule: RoutingRule): void {
    this.options.rules = this.options.rules || []
    this.options.rules.push(rule)
  }

  /**
   * Remove all routing rules
   */
  clearRules(): void {
    this.options.rules = []
  }

  /**
   * Get the current rules
   */
  getRules(): RoutingRule[] {
    return [...(this.options.rules || [])]
  }

  /**
   * Set the default action when no rules match
   * @param action Either 'forward' to forward messages or 'internal' to handle internally
   */
  setDefaultAction(action: 'forward' | 'internal'): void {
    this.options.defaultAction = action
  }
}

// Predefined routing rules for common use cases
export class RoutingRules {
  /**
   * Match messages containing specific text
   */
  static containsText(text: string): RoutingRule {
    return (message: string) => message.includes(text)
  }

  /**
   * Match messages matching a regular expression
   */
  static matchesRegex(regex: RegExp): RoutingRule {
    return (message: string) => regex.test(message)
  }

  /**
   * Match messages starting with specific text
   */
  static startsWith(prefix: string): RoutingRule {
    return (message: string) => message.startsWith(prefix)
  }

  /**
   * Match messages ending with specific text
   */
  static endsWith(suffix: string): RoutingRule {
    return (message: string) => message.endsWith(suffix)
  }

  /**
   * Match JSON-RPC messages with specific methods
   */
  static jsonRpcMethod(method: string): RoutingRule {
    return (message: string) => {
      try {
        const parsed = JSON.parse(message)
        return parsed.method === method
      } catch {
        return false
      }
    }
  }

  /**
   * Match JSON-RPC messages (any method)
   */
  static isJsonRpc(): RoutingRule {
    return (message: string) => {
      try {
        const parsed = JSON.parse(message)
        return typeof parsed === 'object' && 
               parsed !== null && 
               ('method' in parsed || 'result' in parsed || 'error' in parsed) &&
               'jsonrpc' in parsed
      } catch {
        return false
      }
    }
  }

  /**
   * Match messages by length
   */
  static byLength(minLength: number, maxLength: number = Infinity): RoutingRule {
    return (message: string) => message.length >= minLength && message.length <= maxLength
  }

  /**
   * Match all messages (useful for debugging)
   */
  static matchAll(): RoutingRule {
    return () => true
  }

  /**
   * Match no messages (useful for pass-through mode)
   */
  static matchNone(): RoutingRule {
    return () => false
  }

  /**
   * Combine multiple rules with OR logic
   */
  static or(...rules: RoutingRule[]): RoutingRule {
    return (message: string) => rules.some(rule => rule(message))
  }

  /**
   * Combine multiple rules with AND logic
   */
  static and(...rules: RoutingRule[]): RoutingRule {
    return (message: string) => rules.every(rule => rule(message))
  }

  /**
   * Invert a rule
   */
  static not(rule: RoutingRule): RoutingRule {
    return (message: string) => !rule(message)
  }
}