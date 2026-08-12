import { BadGatewayException } from '@nestjs/common';

interface SendEmailInput {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  text: string;
}

interface ResendResponseBody {
  id?: string;
  message?: string;
}

export async function sendEmail(input: SendEmailInput): Promise<string> {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: input.from, to: [input.to], subject: input.subject, text: input.text }),
    signal: AbortSignal.timeout(15_000),
  });

  const body = (await response.json().catch(() => ({}))) as ResendResponseBody;

  if (!response.ok) {
    throw new BadGatewayException(`Resend rechazó el envío (${response.status}): ${body.message ?? 'error desconocido'}`);
  }

  if (!body.id) {
    throw new BadGatewayException('Resend no devolvió un id de envío.');
  }

  return body.id;
}
