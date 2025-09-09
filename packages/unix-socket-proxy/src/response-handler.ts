export interface ResponseTemplate {
  id: string
  template: string
  variables?: Record<string, any>
}

export interface ResponseHandlerOptions {
  responses?: Map<string, ResponseTemplate>
  defaultResponse?: string
  enableEcho?: boolean
  enableStatus?: boolean
  enableHealth?: boolean
  logger?: {
    info: (message: string, ...args: any[]) => void
    error: (message: string, ...args: any[]) => void
    debug: (message: string, ...args: any[]) => void
  }
}

export interface ResponseContext {
  message: string
  clientId: string
  timestamp: Date
  messageCount?: number
}

export class ResponseHandler {
  private options: ResponseHandlerOptions
  private responseCache = new Map<string, string>()
  private messageCount = 0

  constructor(options: ResponseHandlerOptions = {}) {
    this.options = {
      responses: new Map(),
      enableEcho: true,
      enableStatus: true,
      enableHealth: true,
      logger: {
        info: () => {},
        error: () => {},
        debug: () => {}
      },
      ...options
    }

    // Set up built-in responses if enabled
    if (this.options.enableEcho) {
      this.addBuiltInEchoHandler()
    }
    if (this.options.enableStatus) {
      this.addBuiltInStatusHandler()
    }
    if (this.options.enableHealth) {
      this.addBuiltInHealthHandler()
    }
  }

  /**
   * Generate a response for the given message
   * @param message The incoming message
   * @param clientId The client ID that sent the message
   * @returns The response string or null if no response should be sent
   */
  generateResponse(message: string, clientId: string): string | null {
    this.messageCount++
    
    const context: ResponseContext = {
      message,
      clientId,
      timestamp: new Date(),
      messageCount: this.messageCount
    }

    this.options.logger?.debug(`Generating response for message from ${clientId}: ${message}`)

    // Check for built-in commands first
    const builtInResponse = this.handleBuiltInCommands(message, context)
    if (builtInResponse) {
      return builtInResponse
    }

    // Check configured responses
    const configuredResponse = this.handleConfiguredResponse(message, context)
    if (configuredResponse) {
      return configuredResponse
    }

    // Use default response if configured
    if (this.options.defaultResponse) {
      return this.substituteVariables(this.options.defaultResponse, context)
    }

    return null
  }

  /**
   * Add a response template
   * @param id Unique identifier for the response
   * @param template Response template with optional variable substitution
   * @param variables Optional variables for template substitution
   */
  addResponse(id: string, template: string, variables?: Record<string, any>): void {
    this.options.responses!.set(id, { id, template, variables })
    // Clear cache when responses change
    this.responseCache.clear()
  }

  /**
   * Remove a response template
   * @param id The response ID to remove
   */
  removeResponse(id: string): void {
    this.options.responses!.delete(id)
    this.responseCache.clear()
  }

  /**
   * Get all configured response IDs
   */
  getResponseIds(): string[] {
    return Array.from(this.options.responses!.keys())
  }

  private handleBuiltInCommands(message: string, context: ResponseContext): string | null {
    const trimmedMessage = message.trim().toLowerCase()

    // Echo command - returns the original message
    if (this.options.enableEcho && (trimmedMessage === 'echo' || trimmedMessage.startsWith('echo '))) {
      const echoText = trimmedMessage === 'echo' ? 'echo' : message.substring(5)
      return `ECHO: ${echoText}`
    }

    // Status command - returns proxy status information
    if (this.options.enableStatus && (trimmedMessage === 'status' || trimmedMessage === 'proxy-status')) {
      return this.generateStatusResponse(context)
    }

    // Health check command
    if (this.options.enableHealth && (trimmedMessage === 'health' || trimmedMessage === 'ping')) {
      return this.generateHealthResponse(context)
    }

    return null
  }

  private handleConfiguredResponse(message: string, context: ResponseContext): string | null {
    // Check cache first
    const cacheKey = message
    if (this.responseCache.has(cacheKey)) {
      const cachedTemplate = this.responseCache.get(cacheKey)!
      return this.substituteVariables(cachedTemplate, context)
    }

    // Look for matching response templates
    for (const [id, response] of this.options.responses!) {
      if (this.messageMatches(message, id)) {
        const substituted = this.substituteVariables(response.template, context, response.variables)
        // Cache the template (not the substituted version)
        this.responseCache.set(cacheKey, response.template)
        return substituted
      }
    }

    return null
  }

  private messageMatches(message: string, responseId: string): boolean {
    // Simple matching strategy - exact match or starts with response ID
    const trimmedMessage = message.trim().toLowerCase()
    const lowerId = responseId.toLowerCase()
    
    return trimmedMessage === lowerId || trimmedMessage.startsWith(lowerId + ' ')
  }

  private substituteVariables(template: string, context: ResponseContext, additionalVars?: Record<string, any>): string {
    let result = template

    // Built-in variables
    const variables = {
      message: context.message,
      clientId: context.clientId,
      timestamp: context.timestamp.toISOString(),
      messageCount: context.messageCount,
      date: context.timestamp.toDateString(),
      time: context.timestamp.toTimeString(),
      ...additionalVars
    }

    // Replace variables in the format ${variableName}
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\$\\{${key}\\}`, 'g')
      result = result.replace(regex, String(value))
    }

    return result
  }

  private generateStatusResponse(context: ResponseContext): string {
    return JSON.stringify({
      status: 'active',
      timestamp: context.timestamp.toISOString(),
      messageCount: context.messageCount,
      clientId: context.clientId,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage()
    }, null, 2)
  }

  private generateHealthResponse(context: ResponseContext): string {
    return JSON.stringify({
      status: 'healthy',
      timestamp: context.timestamp.toISOString(),
      version: '0.1.0'
    })
  }

  private addBuiltInEchoHandler(): void {
    // Echo is handled in handleBuiltInCommands, no template needed
  }

  private addBuiltInStatusHandler(): void {
    // Status is handled in handleBuiltInCommands, no template needed
  }

  private addBuiltInHealthHandler(): void {
    // Health is handled in handleBuiltInCommands, no template needed
  }

  /**
   * Clear the response cache
   */
  clearCache(): void {
    this.responseCache.clear()
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.responseCache.size,
      keys: Array.from(this.responseCache.keys())
    }
  }
}

// Predefined response templates for common use cases
export class ResponseTemplates {
  static echo(message?: string): ResponseTemplate {
    return {
      id: 'echo',
      template: message ? `ECHO: ${message}` : 'ECHO: ${message}'
    }
  }

  static error(errorMessage: string): ResponseTemplate {
    return {
      id: 'error',
      template: JSON.stringify({
        error: errorMessage,
        timestamp: '${timestamp}',
        clientId: '${clientId}'
      }, null, 2)
    }
  }

  static jsonRpcError(code: number, message: string, id?: string | number): ResponseTemplate {
    return {
      id: 'jsonrpc-error',
      template: JSON.stringify({
        jsonrpc: '2.0',
        error: {
          code,
          message
        },
        id: id || null
      })
    }
  }

  static jsonRpcSuccess(result: any, id?: string | number): ResponseTemplate {
    return {
      id: 'jsonrpc-success',
      template: JSON.stringify({
        jsonrpc: '2.0',
        result,
        id: id || null
      })
    }
  }

  static customJson(data: any): ResponseTemplate {
    return {
      id: 'custom-json',
      template: JSON.stringify(data, null, 2)
    }
  }

  static timestamp(): ResponseTemplate {
    return {
      id: 'timestamp',
      template: 'Current time: ${timestamp}'
    }
  }
}