import { z } from 'zod'

export const ProxyConfigSchema = z.object({
    localPort: z.number().int().min(1).max(65535).default(3000),
    targetHost: z.string().min(1),
    targetPort: z.number().int().min(1).max(65535),
    timeoutMs: z.number().int().min(1).default(30000),
    customHeaders: z.record(z.string(), z.string()).optional(),
    removeHeaders: z.array(z.string()).optional(),
    enableLogging: z.boolean().default(true),
    logLevel: z.enum(['error', 'warn', 'info', 'debug']).default('info')
})

export type ProxyConfig = z.infer<typeof ProxyConfigSchema>

export const createConfigFromEnv = (): Partial<ProxyConfig> => {
    return {
        localPort: process.env.PROXY_LOCAL_PORT ? Number.parseInt(process.env.PROXY_LOCAL_PORT) : undefined,
        targetHost: process.env.PROXY_TARGET_HOST,
        targetPort: process.env.PROXY_TARGET_PORT ? Number.parseInt(process.env.PROXY_TARGET_PORT) : undefined,
        timeoutMs: process.env.PROXY_TIMEOUT_MS ? Number.parseInt(process.env.PROXY_TIMEOUT_MS) : undefined,
        enableLogging: process.env.PROXY_ENABLE_LOGGING ? process.env.PROXY_ENABLE_LOGGING === 'true' : undefined,
        logLevel: process.env.PROXY_LOG_LEVEL as 'error' | 'warn' | 'info' | 'debug' | undefined
    }
}

export const validateConfig = (config: unknown): ProxyConfig => {
    return ProxyConfigSchema.parse(config)
}

export const mergeConfigs = (...configs: Partial<ProxyConfig>[]): ProxyConfig => {
    const merged = Object.assign({}, ...configs)
    return validateConfig(merged)
}
