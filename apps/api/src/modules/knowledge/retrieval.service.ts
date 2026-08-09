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
    const tsQuery = sql`plainto_tsquery('spanish', ${query})`;
    const rank = sql<number>`ts_rank(${referenceChunks.tsv}, ${tsQuery})`;

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
