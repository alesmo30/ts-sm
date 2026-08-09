import type { DrizzleClient } from '../../database/drizzle.client';

import { RetrievalService } from './retrieval.service';

interface FakeRow {
  chunkId: string;
  text: string;
  docId: string;
  docName: string;
  version: number;
  rank: number;
}

function makeDbMock(rows: FakeRow[]) {
  const chain = {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue(rows),
  };
  return chain;
}

describe('RetrievalService', () => {
  function makeRow(overrides: Partial<FakeRow> = {}): FakeRow {
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

  it('devuelve citas mapeadas desde las filas del retrieval léxico', async () => {
    const db = makeDbMock([makeRow()]);

    const service = new RetrievalService(db as unknown as DrizzleClient);
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
  });

  it('recorta el snippet a un techo de caracteres', async () => {
    const longText = 'x'.repeat(500);
    const db = makeDbMock([makeRow({ text: longText })]);

    const service = new RetrievalService(db as unknown as DrizzleClient);
    const [citation] = await service.search('consulta');

    expect(citation.snippet.length).toBeLessThan(longText.length);
  });

  it('usa el límite k pedido', async () => {
    const db = makeDbMock([]);

    const service = new RetrievalService(db as unknown as DrizzleClient);
    await service.search('consulta', 7);

    expect(db.limit).toHaveBeenCalledWith(7);
  });

  it('usa el default de k=4 cuando no se especifica', async () => {
    const db = makeDbMock([]);

    const service = new RetrievalService(db as unknown as DrizzleClient);
    await service.search('consulta');

    expect(db.limit).toHaveBeenCalledWith(4);
  });

  it('devuelve arreglo vacío sin resultados', async () => {
    const db = makeDbMock([]);

    const service = new RetrievalService(db as unknown as DrizzleClient);
    const citations = await service.search('nada relacionado');

    expect(citations).toEqual([]);
  });
});
