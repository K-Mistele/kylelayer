import { z } from 'zod'

export const modelSchema = z.object({
    modelId: z.string(),
    providerId: z.string()
})

export const sessionSchema = z.object({
    id: z.string(),
    title: z.string(),
    model: modelSchema
})
