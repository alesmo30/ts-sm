import { ServiceUnavailableException } from '@nestjs/common';
import { z } from 'zod';

const rawSchema = z.object({
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_FROM_NUMBER: z.string().optional(),
  // DEMO: si está definida, todas las llamadas se marcan a este número e
  // ignoran el teléfono del paciente. Una cuenta trial de Twilio solo puede
  // llamar a números verificados, y los teléfonos del seed son ficticios.
  TWILIO_TO_OVERRIDE: z.string().optional(),
  TWILIO_VOICE_LANGUAGE: z.string().default('es-MX'),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM: z.string().default('Equipo médico <onboarding@resend.dev>'),
  // DEMO: si está definida, todos los correos van a esta dirección.
  RESEND_TO_OVERRIDE: z.string().optional(),
});

export interface OutreachConfig {
  twilioAccountSid?: string;
  twilioAuthToken?: string;
  twilioFromNumber?: string;
  twilioToOverride?: string;
  twilioVoiceLanguage: string;
  resendApiKey?: string;
  resendFrom: string;
  resendToOverride?: string;
}

// .env deja las variables sin usar como "KEY=" — Node las expone como '' (no
// undefined), y '' ?? fallback nunca cae al fallback. Sin esto, un
// TWILIO_TO_OVERRIDE vacío se leía como override activo hacia un teléfono vacío.
function emptyToUndefined(value: string | undefined): string | undefined {
  return value === '' ? undefined : value;
}

export function validateOutreachConfig(env: Record<string, unknown>): OutreachConfig {
  const parsed = rawSchema.safeParse(env);

  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`).join('\n');
    throw new Error(`Configuración de outreach inválida:\n${issues}`);
  }

  const data = parsed.data;

  return {
    twilioAccountSid: emptyToUndefined(data.TWILIO_ACCOUNT_SID),
    twilioAuthToken: emptyToUndefined(data.TWILIO_AUTH_TOKEN),
    twilioFromNumber: emptyToUndefined(data.TWILIO_FROM_NUMBER),
    twilioToOverride: emptyToUndefined(data.TWILIO_TO_OVERRIDE),
    twilioVoiceLanguage: data.TWILIO_VOICE_LANGUAGE,
    resendApiKey: emptyToUndefined(data.RESEND_API_KEY),
    resendFrom: data.RESEND_FROM,
    resendToOverride: emptyToUndefined(data.RESEND_TO_OVERRIDE),
  };
}

// Faltan credenciales: falla la petición (503), no el arranque de la API —
// docker compose up debe seguir levantando sin cuentas externas de Twilio/Resend.
export function assertTwilioReady(
  config: OutreachConfig,
): asserts config is OutreachConfig & { twilioAccountSid: string; twilioAuthToken: string; twilioFromNumber: string } {
  const missing = [
    !config.twilioAccountSid && 'TWILIO_ACCOUNT_SID',
    !config.twilioAuthToken && 'TWILIO_AUTH_TOKEN',
    !config.twilioFromNumber && 'TWILIO_FROM_NUMBER',
  ].filter((value): value is string => Boolean(value));

  if (missing.length > 0) {
    throw new ServiceUnavailableException(`La llamada no está configurada: faltan ${missing.join(', ')}.`);
  }
}

export function assertResendReady(config: OutreachConfig): asserts config is OutreachConfig & { resendApiKey: string } {
  if (!config.resendApiKey) {
    throw new ServiceUnavailableException('El correo no está configurado: falta RESEND_API_KEY.');
  }
}
