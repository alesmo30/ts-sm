import { Test } from '@nestjs/testing';
import type { SessionDetail } from '@ts-sm/shared';

import { LlmPort } from '../llm/llm.port';
import { SessionsService } from '../sessions/sessions.service';

import { EscalationRepository, type PriorityPatientRow } from './escalation.repository';
import { detectEscalationReason, EscalationService } from './escalation.service';

function makeDetail(overrides: Partial<SessionDetail> = {}): SessionDetail {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    code: 'SES-4821',
    date: '2026-08-09',
    time: '09:12',
    patientName: 'Marcela Ortiz',
    procedure: 'Consulta preoperatoria',
    status: 'ok',
    kbVersion: 1,
    summary: null,
    structuredSummary: null,
    createdAt: new Date(),
    email: 'marcela@example.com',
    phone: '3001234567',
    closedAt: null,
    lastActivityAt: new Date(),
    turns: [],
    ...overrides,
  };
}

function makeRow(overrides: Partial<PriorityPatientRow> = {}): PriorityPatientRow {
  return {
    id: '22222222-2222-2222-2222-222222222222',
    sessionId: '11111111-1111-1111-1111-111111111111',
    patientName: 'Marcela Ortiz',
    procedure: 'Consulta preoperatoria',
    requestedBy: 'Agente de voz',
    status: 'attn',
    llmSummary: '',
    outcome: 'Escalada en curso: el paciente todavía no decide si continuar o cerrar.',
    durationSeconds: 0,
    caseNotes: 'motivo',
    ...overrides,
  };
}

describe('detectEscalationReason', () => {
  it('detecta petición explícita del paciente', () => {
    expect(detectEscalationReason('Quiero hablar con un médico ya')).toBe('patient_request');
  });

  it('cae en bandera roja cuando no hay petición explícita', () => {
    expect(detectEscalationReason('Tengo mucho dolor y sangrado')).toBe('red_flag');
  });
});

describe('EscalationService', () => {
  async function setup() {
    const repository = {
      create: jest.fn(),
      findBySessionId: jest.fn(),
      updateBySessionId: jest.fn(),
    };
    const sessionsService = { getDetail: jest.fn() };
    const llmPort = { structured: jest.fn() } as unknown as LlmPort;

    const moduleRef = await Test.createTestingModule({
      providers: [
        EscalationService,
        { provide: EscalationRepository, useValue: repository },
        { provide: SessionsService, useValue: sessionsService },
        { provide: LlmPort, useValue: llmPort },
      ],
    }).compile();

    return { service: moduleRef.get(EscalationService), repository, sessionsService, llmPort };
  }

  it('crea el registro una sola vez por sesión', async () => {
    const { service, repository, sessionsService, llmPort } = await setup();
    sessionsService.getDetail.mockResolvedValue(makeDetail());
    repository.create.mockResolvedValueOnce(makeRow()).mockResolvedValueOnce(undefined);
    repository.findBySessionId.mockResolvedValue(makeRow());
    (llmPort.structured as jest.Mock).mockResolvedValue({
      data: { summary: 'resumen', caseNotes: 'notas' },
      model: 'mock',
      usage: { inputTokens: 0, outputTokens: 0, costUsd: 0 },
      latencyMs: 0,
      usedFallbackParser: false,
    });

    const first = await service.escalate('11111111-1111-1111-1111-111111111111', 'red_flag');
    const second = await service.escalate('11111111-1111-1111-1111-111111111111', 'red_flag');

    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(repository.create).toHaveBeenCalledTimes(2);
  });

  it('refresh regenera resumen y notas vía LlmPort sin tocar outcome', async () => {
    const { service, repository, sessionsService, llmPort } = await setup();
    repository.findBySessionId.mockResolvedValue(makeRow());
    sessionsService.getDetail.mockResolvedValue(
      makeDetail({
        turns: [
          {
            id: 'a',
            sessionId: '1',
            seq: 0,
            who: 'patient',
            text: 'Tengo dolor',
            isVoice: false,
            at: new Date(),
            citations: [],
            kbVersion: 1,
          },
        ],
      }),
    );
    (llmPort.structured as jest.Mock).mockResolvedValue({
      data: { summary: 'resumen nuevo', caseNotes: 'notas nuevas' },
      model: 'mock',
      usage: { inputTokens: 0, outputTokens: 0, costUsd: 0 },
      latencyMs: 0,
      usedFallbackParser: false,
    });

    await service.refresh('11111111-1111-1111-1111-111111111111');

    expect(repository.updateBySessionId).toHaveBeenCalledWith(
      '11111111-1111-1111-1111-111111111111',
      expect.objectContaining({ llmSummary: 'resumen nuevo', caseNotes: 'notas nuevas' }),
    );
  });

  it('cancel actualiza el outcome sin borrar el registro', async () => {
    const { service, repository } = await setup();
    repository.findBySessionId.mockResolvedValue(makeRow());

    await service.cancel('11111111-1111-1111-1111-111111111111');

    expect(repository.updateBySessionId).toHaveBeenCalledWith(
      '11111111-1111-1111-1111-111111111111',
      expect.objectContaining({ outcome: expect.stringContaining('cancelada') }),
    );
  });

  it('onSessionClosed es no-op si la sesión nunca escaló', async () => {
    const { service, repository } = await setup();
    repository.findBySessionId.mockResolvedValue(undefined);

    await service.onSessionClosed('sin-escalar');

    expect(repository.updateBySessionId).not.toHaveBeenCalled();
  });
});
