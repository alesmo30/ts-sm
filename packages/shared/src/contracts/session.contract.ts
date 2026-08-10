import { z } from 'zod';

import { SessionSummarySchema } from './summary.contract';

export const SessionStatus = z.enum(['ok', 'attn', 'fail']);
export type SessionStatus = z.infer<typeof SessionStatus>;

export const CitationSchema = z.object({
  docId: z.string().uuid(),
  docName: z.string(),
  chunkId: z.string(),
  version: z.number().int(),
  score: z.number(),
  snippet: z.string(),
});
export type Citation = z.infer<typeof CitationSchema>;

export const TranscriptTurnSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  seq: z.number().int(),
  who: z.enum(['patient', 'assistant', 'system']),
  text: z.string(),
  isVoice: z.boolean(),
  at: z.coerce.date(),
  citations: z.array(CitationSchema).default([]),
  kbVersion: z.number().int(),
});
export type TranscriptTurn = z.infer<typeof TranscriptTurnSchema>;

export const SessionSchema = z.object({
  id: z.string().uuid(),
  code: z.string().regex(/^SES-\d{4}$/),
  date: z.string(),
  time: z.string(),
  patientName: z.string(),
  procedure: z.string(),
  status: SessionStatus,
  kbVersion: z.number().int(),
  summary: z.string().nullable(),
  structuredSummary: SessionSummarySchema.nullable(),
  createdAt: z.coerce.date(),
  email: z.string(),
  phone: z.string(),
  closedAt: z.coerce.date().nullable(),
  lastActivityAt: z.coerce.date(),
});
export type Session = z.infer<typeof SessionSchema>;

export const SessionDetailSchema = SessionSchema.extend({
  turns: z.array(TranscriptTurnSchema),
});
export type SessionDetail = z.infer<typeof SessionDetailSchema>;

export const CreateSessionSchema = z.object({
  patientName: z.string().min(1).max(120),
  procedure: z.string().min(1).max(160),
  email: z.string().email(),
  phone: z.string().min(7).max(20),
});
export type CreateSessionInput = z.infer<typeof CreateSessionSchema>;

export const CreateTranscriptTurnSchema = TranscriptTurnSchema.omit({
  id: true,
  seq: true,
  kbVersion: true,
});
export type CreateTranscriptTurnInput = z.infer<typeof CreateTranscriptTurnSchema>;

export const UpdateSessionSchema = z.object({
  status: SessionStatus.optional(),
  summary: z.string().nullable().optional(),
  closedAt: z.coerce.date().nullable().optional(),
  structuredSummary: SessionSummarySchema.nullable().optional(),
});
export type UpdateSessionInput = z.infer<typeof UpdateSessionSchema>;
