import { Test } from '@nestjs/testing';

import { LlmPort } from './llm.port';
import { LlmService } from './llm.service';
import type { LlmCompletion, LlmDelta, LlmStructured } from './llm.types';
import { LlmMetricsService } from './metrics';

class FakePort implements LlmPort {
  readonly providerName = 'mock' as const;
  readonly modelId = 'mock';

  complete(): Promise<LlmCompletion> {
    return Promise.resolve({
      text: 'respuesta fija',
      model: 'mock',
      usage: { inputTokens: 5, outputTokens: 3, costUsd: 0 },
      latencyMs: 10,
    });
  }

  async *stream(): AsyncIterable<LlmDelta> {
    yield { type: 'done', completion: await this.complete() };
  }

  structured<T>(): Promise<LlmStructured<T>> {
    throw new Error('no usado en este test');
  }
}

describe('LlmService', () => {
  it('delega en el puerto, registra la métrica y devuelve el completion', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [LlmService, LlmMetricsService, { provide: LlmPort, useClass: FakePort }],
    }).compile();

    const service = moduleRef.get(LlmService);
    const metrics = moduleRef.get(LlmMetricsService);

    const result = await service.complete([{ role: 'user', content: 'hola' }]);

    expect(result.text).toBe('respuesta fija');
    expect(metrics.getSnapshot().totalCalls).toBe(1);
    expect(metrics.getSnapshot().recent[0].ok).toBe(true);
  });

  it('health() refleja providerName y modelId del puerto', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [LlmService, LlmMetricsService, { provide: LlmPort, useClass: FakePort }],
    }).compile();

    const service = moduleRef.get(LlmService);
    expect(service.health()).toEqual({ provider: 'mock', model: 'mock', ready: true });
  });
});
