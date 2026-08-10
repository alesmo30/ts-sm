import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { IngestionService } from './ingestion.service';
import { KnowledgeRepository, type IngestJobRow, type ReferenceRow } from './knowledge.repository';
import { KnowledgeService } from './knowledge.service';

function makeReferenceRow(overrides: Partial<ReferenceRow> = {}): ReferenceRow {
  return {
    id: '44444444-4444-4444-4444-444444444444',
    name: 'protocolo-preoperatorio.pdf',
    type: 'PDF',
    addedAt: new Date('2026-07-20'),
    sizeBytes: 340 * 1024,
    active: true,
    version: 1,
    chunks: 0,
    body: 'Documento PDF',
    origin: 'corpus',
    ...overrides,
  };
}

function makeJobRow(overrides: Partial<IngestJobRow> = {}): IngestJobRow {
  return {
    id: '55555555-5555-5555-5555-555555555555',
    referenceId: null,
    fileName: 'nota.txt',
    stage: 'Recibido',
    pct: 0,
    error: null,
    createdAt: new Date('2026-08-09'),
    updatedAt: new Date('2026-08-09'),
    ...overrides,
  };
}

describe('KnowledgeService', () => {
  async function setup() {
    const repository = {
      findReferences: jest.fn(),
      findActiveReferences: jest.fn(),
      getKbVersion: jest.fn(),
      setReferenceActive: jest.fn(),
      findJob: jest.fn(),
      findOpenJobs: jest.fn(),
    };
    const ingestionService = { ingest: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        KnowledgeService,
        { provide: KnowledgeRepository, useValue: repository },
        { provide: IngestionService, useValue: ingestionService },
      ],
    }).compile();

    return { service: moduleRef.get(KnowledgeService), repository, ingestionService };
  }

  it('lista solo referencias activas por defecto', async () => {
    const { service, repository } = await setup();
    repository.findReferences.mockResolvedValue([makeReferenceRow()]);

    const result = await service.listReferences();

    expect(repository.findReferences).toHaveBeenCalledWith({ origin: undefined, includeInactive: false });
    expect(result).toHaveLength(1);
  });

  it('devuelve la versión vigente de la KB', async () => {
    const { service, repository } = await setup();
    repository.getKbVersion.mockResolvedValue(1);

    const state = await service.getState();

    expect(state).toEqual({ version: 1 });
  });

  it('da de alta un documento pegado como texto vía el pipeline de ingesta', async () => {
    const { service, ingestionService } = await setup();
    ingestionService.ingest.mockResolvedValue(makeJobRow());

    const job = await service.createFromText({ name: 'nota.txt', body: 'contenido' });

    expect(ingestionService.ingest).toHaveBeenCalledWith({ kind: 'text', name: 'nota.txt', body: 'contenido' });
    expect(job.stage).toBe('Recibido');
  });

  it('rechaza un archivo con extensión no aceptada sin crear job', async () => {
    const { service, ingestionService } = await setup();

    await expect(
      service.createFromFile({ originalname: 'virus.exe', size: 10, buffer: Buffer.from('x') }),
    ).rejects.toThrow();
    expect(ingestionService.ingest).not.toHaveBeenCalled();
  });

  it('rechaza un archivo de más de 10 MB sin crear job', async () => {
    const { service, ingestionService } = await setup();

    await expect(
      service.createFromFile({
        originalname: 'grande.pdf',
        size: 11 * 1024 * 1024,
        buffer: Buffer.from('x'),
      }),
    ).rejects.toThrow();
    expect(ingestionService.ingest).not.toHaveBeenCalled();
  });

  it('deshabilita una referencia e incrementa la versión de la KB', async () => {
    const { service, repository } = await setup();
    repository.setReferenceActive.mockResolvedValue({
      reference: makeReferenceRow({ active: false }),
      kbVersion: 2,
    });

    const result = await service.setActive('44444444-4444-4444-4444-444444444444', false);

    expect(repository.setReferenceActive).toHaveBeenCalledWith('44444444-4444-4444-4444-444444444444', false);
    expect(result.active).toBe(false);
  });

  it('rehabilita una referencia e incrementa la versión de la KB', async () => {
    const { service, repository } = await setup();
    repository.setReferenceActive.mockResolvedValue({
      reference: makeReferenceRow({ active: true }),
      kbVersion: 3,
    });

    const result = await service.setActive('44444444-4444-4444-4444-444444444444', true);

    expect(result.active).toBe(true);
  });

  it('lanza NotFoundException si la referencia a activar no existe', async () => {
    const { service, repository } = await setup();
    repository.setReferenceActive.mockResolvedValue(undefined);

    await expect(service.setActive('no-existe', true)).rejects.toBeInstanceOf(NotFoundException);
  });
});
