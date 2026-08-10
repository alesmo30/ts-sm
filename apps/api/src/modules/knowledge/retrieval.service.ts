import { Inject, Injectable } from '@nestjs/common';
import type { Citation } from '@ts-sm/shared';
import { and, desc, eq, sql } from 'drizzle-orm';

import { DRIZZLE_CLIENT } from '../../database/database.module';
import type { DrizzleClient } from '../../database/drizzle.client';
import { referenceChunks, references } from '../../database/schema';

const DEFAULT_TOP_K = 4;
const SNIPPET_CHARS = 300;

/**
 * Score aislado a propósito: hoy es solo la rama léxica (ts_rank). SPEC 09
 * le suma el término denso (similitud de embedding) en esta única función.
 */
function computeScore(lexicalRank: number): number {
  return lexicalRank;
}

@Injectable()
export class RetrievalService {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleClient) {}

  async search(query: string, k: number = DEFAULT_TOP_K): Promise<Citation[]> {
    // plainto_tsquery une los términos con AND: con la consulta enriquecida
    // (turno del asistente + texto del paciente, ver conversation.service.ts)
    // eso exige que TODOS los términos aparezcan en un mismo chunk, lo que en
    // la práctica nunca matchea nada más allá de la primera pregunta corta.
    // Se reescribe el AND (' & ') a OR (' | ') conservando el stemming en
    // español que ya hizo plainto_tsquery.
    const tsQuery = sql`regexp_replace(plainto_tsquery('spanish', ${query})::text, ' & ', ' | ', 'g')::tsquery`;
    // Normalización 2: divide el rank por la longitud del chunk (en lexemas).
    // Sin esto, ts_rank puro favorece PDFs largos que repiten un término común
    // de la consulta (p. ej. "rodilla") muchas veces sobre un chunk corto y
    // preciso que sí contiene el término específico que responde la pregunta
    // (p. ej. "hielo") — el chunk correcto queda opacado por chunks solo
    // tangencialmente relacionados. Dividir por longitud premia la densidad
    // de coincidencia, no el volumen bruto de menciones.
    const rank = sql<number>`ts_rank(${referenceChunks.tsv}, ${tsQuery}, 2)`;

    const rows = await this.db
      .select({
        chunkId: referenceChunks.id,
        text: referenceChunks.text,
        docId: references.id,
        docName: references.name,
        version: references.version,
        rank,
      })
      .from(referenceChunks)
      .innerJoin(references, eq(references.id, referenceChunks.referenceId))
      .where(and(eq(references.active, true), sql`${referenceChunks.tsv} @@ ${tsQuery}`))
      .orderBy(desc(rank))
      .limit(k);

    return rows.map((row) => ({
      docId: row.docId,
      docName: row.docName,
      chunkId: row.chunkId,
      version: row.version,
      score: computeScore(Number(row.rank)),
      snippet: row.text.slice(0, SNIPPET_CHARS),
    }));
  }
}
