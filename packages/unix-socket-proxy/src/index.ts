// Core components
export { ProxyServer, type ProxyServerOptions, type ClientConnection } from './proxy-server.ts'
export { TargetClient, type TargetClientOptions } from './target-client.ts'
export { MessageRouter, RoutingRules, type RoutingRule, type RoutingDecision, type MessageRouterOptions } from './message-router.ts'
export { ResponseHandler, ResponseTemplates, type ResponseTemplate, type ResponseHandlerOptions, type ResponseContext } from './response-handler.ts'

// Configuration
export { ConfigManager, ConfigExamples, type ProxyConfig, type LoggerConfig } from './config.ts'

// CLI
export { UnixSocketProxyCli } from './cli.ts'