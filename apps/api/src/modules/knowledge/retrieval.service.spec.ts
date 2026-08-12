import type { DrizzleClient } from '../../database/drizzle.client';
import type { EmbeddingClient } from '../embeddings/embedding.client';
import { TurnMetricsService } from '../metrics/turn-metrics';

import { RetrievalService } from './retrieval.service';

interface FakeLexicalRow {
  chunkId: string;
  text: string;
  docId: string;
  docName: string;
  version: number;
  rank: number;
}

interface FakeSemanticRow {
  chunkId: string;
  text: string;
  docId: string;
  docName: string;
  version: number;
  distance: number;
}

function makeChain(rows: unknown[]) {
  return {
    from: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue(rows),
  };
}

/** Rama léxica sola: un único chain reutilizado, como antes de SPEC 09. */
function makeLexicalOnlyDbMock(rows: FakeLexicalRow[]) {
  const chain = makeChain(rows);
  return { select: jest.fn().mockReturnValue(chain), ...chain };
}

/** Rama léxica + semántica: primer select() devuelve léxico, segundo semántico —
 * coincide con el orden real de ejecución (léxico se dispara antes que el await del embedding). */
function makeHybridDbMock(lexicalRows: FakeLexicalRow[], semanticRows: FakeSemanticRow[]) {
  const chains = [makeChain(lexicalRows), makeChain(semanticRows)];
  let call = 0;
  return {
    select: jest.fn(() => chains[Math.min(call++, chains.length - 1)]),
  };
}

function fakeEmbeddingClient(overrides: Partial<EmbeddingClient> = {}) {
  return {
    isAvailable: false,
    embedOne: jest.fn(),
    embedBatch: jest.fn(),
    ...overrides,
  } as unknown as EmbeddingClient & { embedOne: jest.Mock };
}

describe('RetrievalService', () => {
  function makeRow(overrides: Partial<FakeLexicalRow> = {}): FakeLexicalRow {
    return {
      chunkId: '11111111-1111-1111-1111-111111111111',
      text: 'Cuidados posteriores a la colecistectomía laparoscópica: reposo relativo por 48 horas.',
      docId: '22222222-2222-2222-2222-222222222222',
      docName: 'guia-colecistectomia.pdf',
      version: 1,
      rank: 0.42,
      ...overrides,
    };
  }

  it('devuelve citas mapeadas desde las filas del retrieval léxico (sin embeddings disponibles)', async () => {
    const db = makeLexicalOnlyDbMock([makeRow()]);
    const embeddingClient = fakeEmbeddingClient();

    const service = new RetrievalService(db as unknown as DrizzleClient, embeddingClient);
    const citations = await service.search('cuidados colecistectomía');

    expect(citations).toEqual([
      {
        docId: '22222222-2222-2222-2222-222222222222',
        docName: 'guia-colecistectomia.pdf',
        chunkId: '11111111-1111-1111-1111-111111111111',
        version: 1,
        score: 0.42,
        snippet: 'Cuidados posteriores a la colecistectomía laparoscópica: reposo relativo por 48 horas.',
      },
    ]);
    expect(embeddingClient.embedOne).not.toHaveBeenCalled();
  });

  it('recorta el snippet a un techo de caracteres', async () => {
    const longText = 'x'.repeat(500);
    const db = makeLexicalOnlyDbMock([makeRow({ text: longText })]);
    const service = new RetrievalService(db as unknown as DrizzleClient, fakeEmbeddingClient());

    const [citation] = await service.search('consulta');

    expect(citation.snippet.length).toBeLessThan(longText.length);
  });

  it('usa el límite k pedido en la rama léxica', async () => {
    const db = makeLexicalOnlyDbMock([]);
    const service = new RetrievalService(db as unknown as DrizzleClient, fakeEmbeddingClient());

    await service.search('consulta', 7);

    expect(db.limit).toHaveBeenCalledWith(7);
  });

  it('usa el default de k=4 cuando no se especifica', async () => {
    const db = makeLexicalOnlyDbMock([]);
    const service = new RetrievalService(db as unknown as DrizzleClient, fakeEmbeddingClient());

    await service.search('consulta');

    expect(db.limit).toHaveBeenCalledWith(4);
  });

  it('devuelve arreglo vacío sin resultados en ninguna rama', async () => {
    const db = makeLexicalOnlyDbMock([]);
    const service = new RetrievalService(db as unknown as DrizzleClient, fakeEmbeddingClient());

    const citations = await service.search('nada relacionado');

    expect(citations).toEqual([]);
  });

  it('no llama a embedOne ni a la rama semántica si EmbeddingClient no está disponible', async () => {
    const db = makeLexicalOnlyDbMock([makeRow()]);
    const embeddingClient = fakeEmbeddingClient({ isAvailable: false });
    const service = new RetrievalService(db as unknown as DrizzleClient, embeddingClient);

    await service.search('consulta');

    expect(embeddingClient.embedOne).not.toHaveBeenCalled();
    expect(db.select).toHaveBeenCalledTimes(1);
  });

  it('fusiona léxico y semántico sin duplicar un chunkId presente en las dos ramas', async () => {
    const sharedRow = makeRow({ chunkId: 'shared', rank: 0.5 });
    const db = makeHybridDbMock(
      [sharedRow],
      [{ chunkId: 'shared', text: sharedRow.text, docId: sharedRow.docId, docName: sharedRow.docName, version: 1, distance: 0.1 }],
    );
    const embeddingClient = fakeEmbeddingClient({ isAvailable: true });
    embeddingClient.embedOne.mockResolvedValue(new Array(768).fill(0.01));

    const service = new RetrievalService(db as unknown as DrizzleClient, embeddingClient);
    const citations = await service.search('herida cuidados');

    expect(citations).toHaveLength(1);
    expect(citations[0].chunkId).toBe('shared');
    // El chunk aparece en las dos ramas: conserva el score léxico (0.5), no el semántico.
    expect(citations[0].score).toBe(0.5);
  });

  it('incluye un chunk que solo trae la rama semántica (léxico no lo trae) — caso Daniela Zuluaga', async () => {
    const semanticOnlyRow: FakeSemanticRow = {
      chunkId: 'solo-semantico',
      text: 'Mantén la herida limpia y seca; cambia el apósito según indicación.',
      docId: 'doc-heridas',
      docName: 'heridas-generales.txt',
      version: 1,
      distance: 0.3,
    };
    const db = makeHybridDbMock([], [semanticOnlyRow]);
    const embeddingClient = fakeEmbeddingClient({ isAvailable: true });
    embeddingClient.embedOne.mockResolvedValue(new Array(768).fill(0.02));

    const service = new RetrievalService(db as unknown as DrizzleClient, embeddingClient);
    const citations = await service.search('¿cómo cuido la herida?');

    expect(citations).toEqual([
      {
        docId: 'doc-heridas',
        docName: 'heridas-generales.txt',
        chunkId: 'solo-semantico',
        version: 1,
        score: 0.7, // 1 - distancia (0.3)
        snippet: semanticOnlyRow.text,
      },
    ]);
    expect(embeddingClient.embedOne).toHaveBeenCalledWith('¿cómo cuido la herida?', { outputDimensionality: 768 });
  });

  it('rama semántica fail-open: si embedOne falla, sigue solo con lo que trajo el léxico', async () => {
    const db = makeHybridDbMock([makeRow()], []);
    const embeddingClient = fakeEmbeddingClient({ isAvailable: true });
    embeddingClient.embedOne.mockRejectedValue(new Error('Gemini no disponible'));

    const service = new RetrievalService(db as unknown as DrizzleClient, embeddingClient);
    const citations = await service.search('consulta');

    expect(citations).toHaveLength(1);
    expect(citations[0].chunkId).toBe(makeRow().chunkId);
  });

  it('SPEC 13 — cada llamada a search() cuenta como una consulta al RAG del turno activo (multi-query cuenta 4)', async () => {
    const db = makeLexicalOnlyDbMock([]);
    const turnMetrics = new TurnMetricsService();
    const service = new RetrievalService(db as unknown as DrizzleClient, fakeEmbeddingClient(), turnMetrics);

    await turnMetrics.runInTurn('session-1', async () => {
      // 1 intento original + 3 variaciones del respaldo de multi-query (SPEC 09).
      await service.search('consulta original');
      await service.search('variación 1');
      await service.search('variación 2');
      await service.search('variación 3');
    });

    expect(turnMetrics.getSnapshot().recentTurns[0].ragQueries).toBe(4);
  });

  it('SPEC 13 — sin TurnMetricsService inyectado, search() sigue funcionando (es opcional)', async () => {
    const db = makeLexicalOnlyDbMock([makeRow()]);
    const service = new RetrievalService(db as unknown as DrizzleClient, fakeEmbeddingClient());

    await expect(service.search('consulta')).resolves.toHaveLength(1);
  });

  it('SPEC 14 — un turno con multi-query (4 invocaciones de search()) suma en stageMs.rag', async () => {
    const db = makeLexicalOnlyDbMock([]);
    const turnMetrics = new TurnMetricsService();
    const service = new RetrievalService(db as unknown as DrizzleClient, fakeEmbeddingClient(), turnMetrics);

    await turnMetrics.runInTurn('session-1', async () => {
      await service.search('consulta original');
      await service.search('variación 1');
      await service.search('variación 2');
      await service.search('variación 3');
    });

    const metric = turnMetrics.getSnapshot().recentTurns[0];
    expect(metric.ragQueries).toBe(4);
    expect(metric.stageMs.rag).toBeGreaterThanOrEqual(0);
  });
});
