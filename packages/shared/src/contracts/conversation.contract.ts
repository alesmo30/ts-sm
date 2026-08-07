import { z } from 'zod';

import { TranscriptTurnSchema } from './session.contract';

export const ClientEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('user_message'),
    sessionId: z.string().uuid(),
    text: z.string().min(1),
  }),
]);
export type ClientEvent = z.infer<typeof ClientEventSchema>;

export const ServerEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('turn_saved'),
    turn: TranscriptTurnSchema,
  }),
  z.object({
    type: z.literal('delta'),
    text: z.string(),
  }),
  z.object({
    type: z.literal('done'),
    turn: TranscriptTurnSchema,
  }),
  z.object({
    type: z.literal('error'),
    message: z.string(),
  }),
]);
export type ServerEvent = z.infer<typeof ServerEventSchema>;
