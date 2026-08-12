import { BadGatewayException } from '@nestjs/common';

// Twilio exige E.164 (+<indicativo><número>). Los teléfonos del seed/formulario
// se guardan como el paciente los escribe (p.ej. "3005553333", sin indicativo) —
// el producto es exclusivo para Colombia (REGLAS.md), así que se asume +57
// cuando el número no trae ya un '+'.
export function toE164Colombia(rawPhone: string): string {
  const digits = rawPhone.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return digits;
  if (digits.startsWith('57')) return `+${digits}`;
  return `+57${digits}`;
}

// Twilio TwiML es XML: el guion generado por el LLM entra como texto dentro
// de <Say>, así que hay que escaparlo o un '&' o '<' del texto rompería el documento.
export function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// <Pause> tras el <Say>: sin él, Twilio cuelga en el instante que termina la
// última palabra — se siente como un corte abrupto en vez de un cierre natural.
export function buildTwiml(script: string, language: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Say language="${language}">${escapeXml(script)}</Say><Pause length="2"/></Response>`;
}

interface StartCallInput {
  accountSid: string;
  authToken: string;
  from: string;
  to: string;
  twiml: string;
}

interface TwilioErrorBody {
  code?: number;
  message?: string;
}

const TWILIO_ERROR_HINTS: Record<number, string> = {
  21608: 'número no verificado en la cuenta trial de Twilio (Console > Verified Caller IDs).',
  21215: 'permisos geográficos deshabilitados para este país (Console > Voice > Geographic Permissions).',
};

export async function startCall(input: StartCallInput): Promise<string> {
  const credentials = Buffer.from(`${input.accountSid}:${input.authToken}`).toString('base64');

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${input.accountSid}/Calls.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: input.to, From: input.from, Twiml: input.twiml }),
    signal: AbortSignal.timeout(15_000),
  });

  const body = (await response.json().catch(() => ({}))) as TwilioErrorBody & { sid?: string };

  if (!response.ok) {
    const hint = body.code ? TWILIO_ERROR_HINTS[body.code] : undefined;
    const detail = [body.message, hint].filter(Boolean).join(' — ');
    throw new BadGatewayException(`Twilio rechazó la llamada (${response.status}): ${detail || 'error desconocido'}`);
  }

  if (!body.sid) {
    throw new BadGatewayException('Twilio no devolvió un SID de llamada.');
  }

  return body.sid;
}
