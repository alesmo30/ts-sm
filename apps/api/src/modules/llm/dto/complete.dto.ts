import { z } from 'zod';

const LlmToolCallSchema = z.object({
  id: z.string(),
  name: z.string(),
  arguments: z.record(z.unknown()),
});

const LlmMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant', 'tool']),
  content: z.string(),
  toolCallId: z.string().optional(),
  toolCalls: z.array(LlmToolCallSchema).optional(),
});

const LlmOptionsSchema = z.object({
  temperature: z.number().optional(),
  maxTokens: z.number().int().positive().optional(),
});

export const CompleteRequestSchema = z.object({
  messages: z.array(LlmMessageSchema).min(1),
  options: LlmOptionsSchema.optional(),
});

export type CompleteRequest = z.infer<typeof CompleteRequestSchema>;
