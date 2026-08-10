import { Test } from '@nestjs/testing';

import { StatsRepository, type StatsCountsRow } from './stats.repository';
import { StatsService } from './stats.service';

describe('StatsService', () => {
  async function setup() {
    const repository = { getCounts: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [StatsService, { provide: StatsRepository, useValue: repository }],
    }).compile();

    return { service: moduleRef.get(StatsService), repository };
  }

  it('devuelve los conteos del repositorio', async () => {
    const { service, repository } = await setup();
    const row: StatsCountsRow = { sessions: 12, priorityPatients: 3, references: 7, uploads: 4 };
    repository.getCounts.mockResolvedValue(row);

    const result = await service.getCounts();

    expect(result).toEqual(row);
  });
});
