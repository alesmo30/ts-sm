import { Test } from '@nestjs/testing';

import { KnowledgeRepository, type ReferenceRow } from './knowledge.repository';
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
    ...overrides,
  };
}

describe('KnowledgeService', () => {
  async function setup() {
    const repository = { findActiveReferences: jest.fn(), getKbVersion: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [KnowledgeService, { provide: KnowledgeRepository, useValue: repository }],
    }).compile();

    return { service: moduleRef.get(KnowledgeService), repository };
  }

  it('lista solo referencias activas', async () => {
    const { service, repository } = await setup();
    repository.findActiveReferences.mockResolvedValue([makeReferenceRow()]);

    const result = await service.listActiveReferences();

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('PDF');
  });

  it('devuelve la versión vigente de la KB', async () => {
    const { service, repository } = await setup();
    repository.getKbVersion.mockResolvedValue(1);

    const state = await service.getState();

    expect(state).toEqual({ version: 1 });
  });
});
