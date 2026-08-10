import { z } from 'zod';

export const SessionSummarySchema = z.object({
  recommendations: z.array(z.string()),
  alerts: z.array(z.string()),
  escalated: z.boolean(),
  coverage: z.object({
    covered: z.array(z.string()),
    pending: z.array(z.string()),
    grouped: z.boolean(),
  }),
  metrics: z.object({
    turns: z.number().int(),
    durationSeconds: z.number().int(),
    ttftMs: z.number().int().nullable(),
    inputTokens: z.number().int(),
    outputTokens: z.number().int(),
    costUsd: z.number(),
  }),
});

export type SessionSummary = z.infer<typeof SessionSummarySchema>;
