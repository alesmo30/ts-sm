import { ServiceUnavailableException } from '@nestjs/common';
import type { PriorityPatient } from '@ts-sm/shared';

import { LlmPort } from '../llm/llm.port';
import { PatientsService } from '../patients/patients.service';

import type { OutreachConfig } from './outreach.config';
import { OutreachService } from './outreach.service';
import * as resendClient from './resend.client';
import * as twilioClient from './twilio.client';

jest.mock('./twilio.client', () => ({
  ...jest.requireActual('./twilio.client'),
  startCall: jest.fn(),
}));
jest.mock('./resend.client', () => ({
  ...jest.requireActual('./resend.client'),
  sendEmail: jest.fn(),
}));

function makePatient(overrides: Partial<PriorityPatient> = {}): PriorityPatient {
  return {
    id: '33333333-3333-3333-3333-333333333333',
    sessionId: '11111111-1111-1111-1111-111111111111',
    patientName: 'Jorge Restrepo',
    procedure: 'Seguimiento post-operatorio',
    requestedBy: 'Asistente de voz',
    status: 'attn',
    llmSummary: 'Resumen del LLM',
    outcome: 'Escalado a atención humana',
    durationSeconds: 372,
    caseNotes: 'Dolor intenso y pus en la herida.',
    sessionDate: '2026-08-10',
    email: 'jorge.restrepo@example.com',
    phone: '+573001234567',
    ...overrides,
  };
}

function baseConfig(overrides: Partial<OutreachConfig> = {}): OutreachConfig {
  return {
    twilioVoiceLanguage: 'es-MX',
    resendFrom: 'Equipo médico <onboarding@resend.dev>',
    ...overrides,
  };
}

function setup(config: OutreachConfig, patient: PriorityPatient = makePatient()) {
  const patientsService = { getById: jest.fn().mockResolvedValue(patient) } as unknown as PatientsService;
  const llmPort = {
    structured: jest.fn(),
    providerName: 'mock',
    modelId: 'mock',
  } as unknown as LlmPort;

  const service = new OutreachService(patientsService, llmPort, config);
  return { service, patientsService, llmPort };
}

describe('OutreachService', () => {
  afterEach(() => jest.clearAllMocks());

  describe('generateDraft', () => {
    it('pasa llmSummary y caseNotes al mensaje user y devuelve los contactos sugeridos', async () => {
      const patient = makePatient();
      const { service, llmPort } = setup(baseConfig(), patient);
      (llmPort.structured as jest.Mock).mockResolvedValue({
        data: { severity: 'grave', subject: 'Asunto', emailBody: 'Cuerpo', callScript: 'Guion' },
      });

      const draft = await service.generateDraft(patient.id);

      const userMessage = (llmPort.structured as jest.Mock).mock.calls[0][0][1].content as string;
      expect(userMessage).toContain(patient.llmSummary);
      expect(userMessage).toContain(patient.caseNotes);
      expect(draft).toEqual({
        severity: 'grave',
        subject: 'Asunto',
        emailBody: 'Cuerpo',
        callScript: 'Guion',
        suggestedEmail: patient.email,
        suggestedPhone: patient.phone,
      });
    });
  });

  describe('startCall', () => {
    it('lanza 503 con las variables faltantes si no hay credenciales de Twilio', async () => {
      const { service } = setup(baseConfig());

      await expect(
        service.startCall({ patientId: '33333333-3333-3333-3333-333333333333', to: '+573000000000', script: 'Hola' }),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it('marca al número de override cuando está configurado y lo reporta en overridden', async () => {
      const config = baseConfig({
        twilioAccountSid: 'AC123',
        twilioAuthToken: 'token',
        twilioFromNumber: '+15550000000',
        twilioToOverride: '+573009999999',
      });
      const { service } = setup(config);
      (twilioClient.startCall as jest.Mock).mockResolvedValue('CA123');

      const result = await service.startCall({
        patientId: '33333333-3333-3333-3333-333333333333',
        to: '+573001234567',
        script: 'Hola',
      });

      expect(twilioClient.startCall).toHaveBeenCalledWith(expect.objectContaining({ to: '+573009999999' }));
      expect(result).toEqual({ channel: 'call', providerId: 'CA123', to: '+573009999999', overridden: true });
    });

    it('sin override, llama al teléfono real del paciente normalizado a E.164 (cuenta pay-as-you-go)', async () => {
      const config = baseConfig({
        twilioAccountSid: 'AC123',
        twilioAuthToken: 'token',
        twilioFromNumber: '+15550000000',
        // twilioToOverride ausente — regresión: un '' del .env no debe colarse aquí.
      });
      const { service } = setup(config);
      (twilioClient.startCall as jest.Mock).mockResolvedValue('CA456');

      const result = await service.startCall({
        patientId: '33333333-3333-3333-3333-333333333333',
        to: '3001234567',
        script: 'Hola',
      });

      expect(twilioClient.startCall).toHaveBeenCalledWith(expect.objectContaining({ to: '+573001234567' }));
      expect(result).toEqual({ channel: 'call', providerId: 'CA456', to: '+573001234567', overridden: false });
    });
  });

  describe('sendEmail', () => {
    it('lanza 503 si no hay RESEND_API_KEY', async () => {
      const { service } = setup(baseConfig());

      await expect(
        service.sendEmail({
          patientId: '33333333-3333-3333-3333-333333333333',
          to: 'paciente@example.com',
          subject: 'Asunto',
          message: 'Mensaje',
        }),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it('envía sin override cuando no hay RESEND_TO_OVERRIDE', async () => {
      const config = baseConfig({ resendApiKey: 're_123' });
      const { service } = setup(config);
      (resendClient.sendEmail as jest.Mock).mockResolvedValue('em_123');

      const result = await service.sendEmail({
        patientId: '33333333-3333-3333-3333-333333333333',
        to: 'paciente@example.com',
        subject: 'Asunto',
        message: 'Mensaje',
      });

      expect(result).toEqual({ channel: 'email', providerId: 'em_123', to: 'paciente@example.com', overridden: false });
    });
  });
});
