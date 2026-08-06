import { Test } from '@nestjs/testing';
import type { Pool } from 'pg';

import { PG_POOL } from '../../database/database.module';

import { HealthService } from './health.service';

describe('HealthService', () => {
  it('devuelve status ok cuando la query de la db resuelve', async () => {
    const mockPool = { query: jest.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] }) };

    const moduleRef = await Test.createTestingModule({
      providers: [HealthService, { provide: PG_POOL, useValue: mockPool as unknown as Pool }],
    }).compile();

    const service = moduleRef.get(HealthService);
    const result = await service.check();

    expect(result).toEqual({ status: 'ok', db: 'connected' });
    expect(mockPool.query).toHaveBeenCalledWith('SELECT 1');
  });

  it('devuelve status degraded cuando la db falla', async () => {
    const mockPool = { query: jest.fn().mockRejectedValue(new Error('conexión rechazada')) };

    const moduleRef = await Test.createTestingModule({
      providers: [HealthService, { provide: PG_POOL, useValue: mockPool as unknown as Pool }],
    }).compile();

    const service = moduleRef.get(HealthService);
    const result = await service.check();

    expect(result).toEqual({ status: 'degraded', db: 'disconnected' });
  });
});
