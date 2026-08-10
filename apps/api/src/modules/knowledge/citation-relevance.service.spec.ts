import { Test } from '@nestjs/testing';
import type { Citation } from '@ts-sm/shared';

import { EmbeddingClient } from '../embeddings/embedding.client';

import { CitationRelevanceService } from './citation-relevance.service';
import { CITATION_RELEVANCE_CONFIG } from './citation-relevance.tokens';

function makeCitation(overrides: Partial<Citation> = {}): Citation {
  return {
    docId: '11111111-1111-1111-1111-111111111111',
    docName: 'guia.pdf',
    chunkId: '22222222-2222-2222-2222-222222222222',
    version: 1,
    score: 0.001,
    snippet: 'Fragmento del documento.',
    ...overrides,
  };
}

function fakeEmbeddingClient(overrides: Partial<EmbeddingClient> = {}) {
  return {
    isAvailable: true,
    embedBatch: jest.fn(),
    embedOne: jest.fn(),
    ...overrides,
  } as unknown as EmbeddingClient & { embedBatch: jest.Mock };
}

async function setup(embeddingClient: EmbeddingClient, threshold = 0.7) {
  const moduleRef = await Test.createTestingModule({
    providers: [
      CitationRelevanceService,
      { provide: CITATION_RELEVANCE_CONFIG, useValue: { threshold } },
      { provide: EmbeddingClient, useValue: embeddingClient },
    ],
  }).compile();

  return moduleRef.get(CitationRelevanceService);
}

describe('CitationRelevanceService', () => {
  it('sin citas, no llama a embeddings y devuelve arreglo vacío', async () => {
    const embeddingClient = fakeEmbeddingClient();
    const service = await setup(embeddingClient);

    const result = await service.filterRelevant('alguna pregunta', []);

    expect(embeddingClient.embedBatch).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it('sin GEMINI_API_KEY (EmbeddingClient no disponible), devuelve las citas sin filtrar', async () => {
    const embeddingClient = fakeEmbeddingClient({ isAvailable: false });
    const service = await setup(embeddingClient);
    const citations = [makeCitation()];

    const result = await service.filterRelevant('alguna pregunta', citations);

    expect(embeddingClient.embedBatch).not.toHaveBeenCalled();
    expect(result).toBe(citations);
  });

  it('filtra las citas cuya similitud con la pregunta queda por debajo del umbral', async () => {
    const embeddingClient = fakeEmbeddingClient();
    // [query, snippet-relevante, snippet-ruido]
    embeddingClient.embedBatch.mockResolvedValue([
      [1, 0],
      [0.99, 0.14], // similitud alta con la query
      [0, 1], // ortogonal, similitud 0
    ]);
    const service = await setup(embeddingClient);

    const relevant = makeCitation({ docName: 'relevante.pdf' });
    const noise = makeCitation({ docName: 'ruido.pdf' });

    const result = await service.filterRelevant('puedo ducharme despues de la cirugia', [relevant, noise]);

    expect(result).toEqual([relevant]);
  });

  it('si Gemini falla, cae a devolver las citas sin filtrar', async () => {
    const embeddingClient = fakeEmbeddingClient();
    embeddingClient.embedBatch.mockRejectedValue(new Error('network error'));
    const service = await setup(embeddingClient);
    const citations = [makeCitation()];

    const result = await service.filterRelevant('alguna pregunta', citations);

    expect(result).toBe(citations);
  });
});
