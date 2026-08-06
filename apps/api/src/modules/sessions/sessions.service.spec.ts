import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { SessionsRepository, type SessionRow, type TranscriptTurnRow } from './sessions.repository';
import { SessionsService } from './sessions.service';

function makeSessionRow(overrides: Partial<SessionRow> = {}): SessionRow {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    code: 'SES-4821',
    date: '2026-08-04',
    time: '09:12',
    patientName: 'Marcela Ortiz',
    procedure: 'Consulta preoperatoria',
    status: 'ok',
    kbVersion: 1,
    summary: 'Resumen',
    structuredSummary: null,
    createdAt: new Date('2026-08-04T09:12:00Z'),
    ...overrides,
  };
}

function makeTurnRow(overrides: Partial<TranscriptTurnRow> = {}): TranscriptTurnRow {
  return {
    id: '22222222-2222-2222-2222-222222222222',
    sessionId: '11111111-1111-1111-1111-111111111111',
    seq: 0,
    who: 'patient',
    text: 'Hola',
    isVoice: false,
    at: new Date('2026-08-04T09:12:00Z'),
    citations: [],
    kbVersion: 1,
    ...overrides,
  };
}

describe('SessionsService', () => {
  async function setup() {
    const repository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findTurnsBySessionId: jest.fn(),
      create: jest.fn(),
      createTurn: jest.fn(),
      update: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        SessionsService,
        { provide: SessionsRepository, useValue: repository },
      ],
    }).compile();

    return { service: moduleRef.get(SessionsService), repository };
  }

  it('busca sesiones delegando el filtro q al repository', async () => {
    const { service, repository } = await setup();
    repository.findAll.mockResolvedValue([makeSessionRow()]);

    const result = await service.list('marcela');

    expect(repository.findAll).toHaveBeenCalledWith('marcela');
    expect(result).toHaveLength(1);
    expect(result[0].code).toBe('SES-4821');
  });

  it('arma el detalle de sesión con turnos ordenados', async () => {
    const { service, repository } = await setup();
    repository.findById.mockResolvedValue(makeSessionRow());
    repository.findTurnsBySessionId.mockResolvedValue([
      makeTurnRow({ seq: 0 }),
      makeTurnRow({ seq: 1, who: 'assistant', text: 'Respuesta' }),
    ]);

    const detail = await service.getDetail('11111111-1111-1111-1111-111111111111');

    expect(detail.turns.map((t) => t.seq)).toEqual([0, 1]);
    expect(detail.turns[1].who).toBe('assistant');
  });

  it('lanza NotFoundException si la sesión no existe', async () => {
    const { service, repository } = await setup();
    repository.findById.mockResolvedValue(undefined);

    await expect(service.getDetail('no-existe')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('crea un turno delegando la asignación de seq y kbVersion al repository', async () => {
    const { service, repository } = await setup();
    repository.findById.mockResolvedValue(makeSessionRow());
    repository.createTurn.mockResolvedValue(makeTurnRow({ seq: 2, kbVersion: 2 }));

    const turn = await service.addTurn('11111111-1111-1111-1111-111111111111', {
      sessionId: '11111111-1111-1111-1111-111111111111',
      who: 'patient',
      text: 'Otra pregunta',
      isVoice: true,
      at: new Date(),
      citations: [],
    });

    expect(turn.seq).toBe(2);
    expect(turn.kbVersion).toBe(2);
  });

  it('rechaza agregar un turno a una sesión inexistente', async () => {
    const { service, repository } = await setup();
    repository.findById.mockResolvedValue(undefined);

    await expect(
      service.addTurn('no-existe', {
        sessionId: 'no-existe',
        who: 'patient',
        text: 'x',
        isVoice: false,
        at: new Date(),
        citations: [],
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
