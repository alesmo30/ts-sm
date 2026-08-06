import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { PatientsRepository, type PriorityPatientRow } from './patients.repository';
import { PatientsService } from './patients.service';

function makePriorityPatientRow(overrides: Partial<PriorityPatientRow> = {}): PriorityPatientRow {
  return {
    id: '33333333-3333-3333-3333-333333333333',
    sessionId: null,
    patientName: 'Jorge Restrepo',
    procedure: 'Seguimiento post-operatorio',
    requestedBy: 'Asistente de voz',
    status: 'attn',
    llmSummary: 'Resumen del LLM',
    outcome: 'Escalado a atención humana',
    durationSeconds: 372,
    caseNotes: 'Notas del caso',
    ...overrides,
  };
}

describe('PatientsService', () => {
  async function setup() {
    const repository = { findAll: jest.fn(), findById: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [PatientsService, { provide: PatientsRepository, useValue: repository }],
    }).compile();

    return { service: moduleRef.get(PatientsService), repository };
  }

  it('lista los pacientes prioritarios', async () => {
    const { service, repository } = await setup();
    repository.findAll.mockResolvedValue([makePriorityPatientRow()]);

    const result = await service.list();

    expect(result).toHaveLength(1);
    expect(result[0].patientName).toBe('Jorge Restrepo');
  });

  it('lanza NotFoundException si el paciente prioritario no existe', async () => {
    const { service, repository } = await setup();
    repository.findById.mockResolvedValue(undefined);

    await expect(service.getById('no-existe')).rejects.toBeInstanceOf(NotFoundException);
  });
});
