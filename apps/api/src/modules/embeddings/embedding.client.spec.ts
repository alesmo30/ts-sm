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
});
