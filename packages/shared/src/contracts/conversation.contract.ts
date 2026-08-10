import { z } from 'zod';

import { TranscriptTurnSchema } from './session.contract';

export const ClientEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('user_message'),
    sessionId: z.string().uuid(),
    text: z.string().min(1),
    // true si el mensaje incluye texto dictado por voz (acumulado en el
    // composer antes de enviar) — ver decisión de acumulación estilo
    // Wispr Flow en specs/06-capa-de-voz.md.
    isVoice: z.boolean().default(false),
  }),
  z.object({
    type: z.literal('audio_start'),
    sessionId: z.string().uuid(),
  }),
  z.object({
    type: z.literal('audio_end'),
    sessionId: z.string().uuid(),
  }),
  z.object({
    type: z.literal('start_conversation'),
    sessionId: z.string().uuid(),
  }),
  z.object({
    // Registra el socket contra una sesión ya existente (con turnos) sin
    // disparar el saludo del LLM — a diferencia de start_conversation, que
    // sí lo hace. Necesario para que una sesión resumida (F5, segunda
    // pestaña) reciba server-push como knowledge_updated o escalation_started.
    type: z.literal('join_session'),
    sessionId: z.string().uuid(),
  }),
  z.object({
    type: z.literal('escalation_cancelled'),
    sessionId: z.string().uuid(),
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
  z.object({
    type: z.literal('stt_status'),
    state: z.enum(['listening', 'transcribing', 'failed']),
    message: z.string().optional(),
  }),
  z.object({
    type: z.literal('stt_result'),
    text: z.string(),
  }),
  z.object({
    type: z.literal('tts_start'),
  }),
  z.object({
    type: z.literal('tts_end'),
  }),
  z.object({
    type: z.literal('greeting_start'),
  }),
  z.object({
    type: z.literal('knowledge_updated'),
    turn: TranscriptTurnSchema,
    kbVersion: z.number().int(),
  }),
  z.object({
    type: z.literal('escalation_started'),
    reason: z.enum(['red_flag', 'patient_request']),
    countdownSeconds: z.number().int(),
  }),
]);
export type ServerEvent = z.infer<typeof ServerEventSchema>;
