import { TurnMetricsService } from '../metrics/turn-metrics';

import { EmbeddingClient } from './embedding.client';
import type { EmbeddingConfig } from './embedding.config';

function mockFetchOnce(embedding: number[]): jest.Mock {
  const fetchMock = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ embedding: { values: embedding } }),
  });
  (global as unknown as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

function requestBody(fetchMock: jest.Mock): Record<string, unknown> {
  const [, init] = fetchMock.mock.calls[0] as [string, { body: string }];
  return JSON.parse(init.body) as Record<string, unknown>;
}

function mockFetchFailureOnce(status: number): jest.Mock {
  const fetchMock = jest.fn().mockResolvedValue({
    ok: false,
    status,
    text: async () => 'error de Gemini',
  });
  (global as unknown as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

describe('EmbeddingClient', () => {
  const config: EmbeddingConfig = { apiKey: 'fake-key', model: 'gemini-embedding-001' };

  it('embedOne sin options no incluye outputDimensionality en el body', async () => {
    const fetchMock = mockFetchOnce([0.1, 0.2]);
    const client = new EmbeddingClient(config);

    await client.embedOne('texto');

    expect(requestBody(fetchMock)).not.toHaveProperty('outputDimensionality');
  });

  it('embedOne con options.outputDimensionality lo pasa en el body', async () => {
    const fetchMock = mockFetchOnce([0.1, 0.2]);
    const client = new EmbeddingClient(config);

    await client.embedOne('texto', { outputDimensionality: 768 });

    expect(requestBody(fetchMock)).toMatchObject({ outputDimensionality: 768 });
  });

  it('embedBatch propaga options a cada embedOne', async () => {
    const fetchMock = mockFetchOnce([0.1, 0.2]);
    const client = new EmbeddingClient(config);

    await client.embedBatch(['a', 'b'], { outputDimensionality: 768 });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(requestBody(fetchMock)).toMatchObject({ outputDimensionality: 768 });
  });

  it('SPEC 13 — embedOne cuenta embeddingCalls del turno activo, aparte de llmCalls', async () => {
    mockFetchOnce([0.1, 0.2]);
    const turnMetrics = new TurnMetricsService();
    const client = new EmbeddingClient(config, turnMetrics);

    await turnMetrics.runInTurn('session-1', async () => {
      await client.embedOne('texto 1');
      await client.embedOne('texto 2');
    });

    const metric = turnMetrics.getSnapshot().recentTurns[0];
    expect(metric.embeddingCalls).toBe(2);
    expect(metric.llmCalls.stream + metric.llmCalls.structured + metric.llmCalls.complete).toBe(0);
  });

  it('SPEC 13 — sin TurnMetricsService inyectado, embedOne sigue funcionando (es opcional)', async () => {
    mockFetchOnce([0.1, 0.2]);
    const client = new EmbeddingClient(config);

    await expect(client.embedOne('texto')).resolves.toEqual([0.1, 0.2]);
  });

  it('SPEC 14 — embedOne exitoso aporta su duración a stageMs.embedding', async () => {
    mockFetchOnce([0.1, 0.2]);
    const turnMetrics = new TurnMetricsService();
    const client = new EmbeddingClient(config, turnMetrics);

    await turnMetrics.runInTurn('session-1', async () => {
      await client.embedOne('texto');
    });

    const metric = turnMetrics.getSnapshot().recentTurns[0];
    expect(metric.stageMs.embedding).toBeGreaterThanOrEqual(0);
  });

  it('SPEC 14 — embedOne que falla (Gemini responde 500) igual aporta su duración a stageMs.embedding', async () => {
    mockFetchFailureOnce(500);
    const turnMetrics = new TurnMetricsService();
    const client = new EmbeddingClient(config, turnMetrics);

    await turnMetrics.runInTurn('session-1', async () => {
      await expect(client.embedOne('texto')).rejects.toThrow('Gemini embeddings respondió 500');
    });

    const metric = turnMetrics.getSnapshot().recentTurns[0];
    expect(metric.stageMs.embedding).toBeGreaterThanOrEqual(0);
    expect(metric.embeddingCalls).toBe(1);
  });
});
