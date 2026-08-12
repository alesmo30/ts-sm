import { z } from 'zod';

export const OutreachSeverity = z.enum(['leve', 'moderado', 'grave']);
export type OutreachSeverity = z.infer<typeof OutreachSeverity>;

// Body de POST /outreach/draft
export const GenerateOutreachDraftSchema = z.object({
  patientId: z.string().uuid(),
});
export type GenerateOutreachDraftInput = z.infer<typeof GenerateOutreachDraftSchema>;

// Respuesta de POST /outreach/draft. Un solo borrador sirve a los dos canales.
export const OutreachDraftSchema = z.object({
  severity: OutreachSeverity,
  subject: z.string(),
  emailBody: z.string(),
  callScript: z.string(),
  // Destinos sugeridos, tomados de la sesión vinculada. '' cuando no hay sesión.
  suggestedEmail: z.string(),
  suggestedPhone: z.string(),
});
export type OutreachDraft = z.infer<typeof OutreachDraftSchema>;

// Body de POST /outreach/email
export const SendOutreachEmailSchema = z.object({
  patientId: z.string().uuid(),
  to: z.string().email(),
  subject: z.string().min(1).max(200),
  message: z.string().min(1).max(5000),
});
export type SendOutreachEmailInput = z.infer<typeof SendOutreachEmailSchema>;

// Body de POST /outreach/call
export const StartOutreachCallSchema = z.object({
  patientId: z.string().uuid(),
  to: z.string().min(7).max(20),
  script: z.string().min(1).max(1200),
});
export type StartOutreachCallInput = z.infer<typeof StartOutreachCallSchema>;

// Respuesta de los dos endpoints de envío. Sin persistencia: solo el eco del proveedor.
export const OutreachSendResultSchema = z.object({
  channel: z.enum(['email', 'call']),
  // SID de Twilio o id de Resend.
  providerId: z.string(),
  // Destino real usado (puede diferir del pedido si hay override de demo).
  to: z.string(),
  // true cuando se usó TWILIO_TO_OVERRIDE / RESEND_TO_OVERRIDE.
  overridden: z.boolean(),
});
export type OutreachSendResult = z.infer<typeof OutreachSendResultSchema>;
