import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type { Citation } from '@ts-sm/shared';
import { and, asc, desc, eq, isNotNull, sql } from 'drizzle-orm';

import { DRIZZLE_CLIENT } from '../../database/database.module';
import type { DrizzleClient } from '../../database/drizzle.client';
import { referenceChunks, references } from '../../database/schema';
import { EmbeddingClient } from '../embeddings/embedding.client';
import { TurnMetricsService } from '../metrics/turn-metrics';

const DEFAULT_TOP_K = 4; // léxico, sin cambios
const SEMANTIC_TOP_K = 6; // candidatos de la rama semántica antes de fusionar
const SEMANTIC_EMBEDDING_DIM = 768;
const SNIPPET_CHARS = 300;

interface ScoredRow {
  chunkId: string;
  text: string;
  docId: string;
  docName: string;
  version: number;
  lexicalRank?: number;
  semanticDistance?: number;
}

/**
 * Score aislado a propósito: cuando el chunk viene del corte léxico se usa
 * ts_rank tal cual (comportamiento previo, sin cambios); cuando solo lo trajo
 * la rama semántica nueva (SPEC 09) se usa 1 - distancia coseno (`<=>` de
 * pgvector es distancia, no similitud). Un chunk que aparece en las dos ramas
 * conserva el score léxico — CitationRelevanceService decide relevancia por
 * su cuenta re-embebiendo la query contra el snippet, este score es solo
 * informativo.
 */
function computeScore(row: ScoredRow): number {
  if (row.lexicalRank !== undefined) return row.lexicalRank;
  if (row.semanticDistance !== undefined) return 1 - row.semanticDistance;
  return 0;
}

function toCitation(row: ScoredRow): Citation {
  return {
    docId: row.docId,
    docName: row.docName,
    chunkId: row.chunkId,
    version: row.version,
    score: computeScore(row),
    snippet: row.text.slice(0, SNIPPET_CHARS),
  };
}

@Injectable()
export class RetrievalService {
  private readonly logger = new Logger(RetrievalService.name);

  constructor(
    @Inject(DRIZZLE_CLIENT) private readonly db: DrizzleClient,
    private readonly embeddingClient: EmbeddingClient,
    @Optional() private readonly turnMetrics?: TurnMetricsService,
  ) {}

  async search(query: string, k: number = DEFAULT_TOP_K): Promise<Citation[]> {
    // SPEC 13 — cuenta la consulta al RAG apenas se invoca, sin condicionar al
    // resultado: un turno con multi-query (SPEC 09) llama search() 4 veces, y
    // las cuatro deben contar. Una falla acá nunca puede tumbar el retrieval real.
    try {
      this.turnMetrics?.addRagQuery();
    } catch (error) {
      this.logger.debug(
        `No fue posible registrar la métrica de turno para esta consulta al RAG: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    const startedAt = Date.now();
    try {
      return await this.doSearch(query, k);
    } finally {
      // SPEC 14 — mide el método completo (rama léxica + semántica en
      // paralelo, incluido el embedOne de la consulta). Con multi-query, las
      // cuatro invocaciones suman sobre el mismo turno.
      try {
        this.turnMetrics?.addStageMs('rag', Date.now() - startedAt);
      } catch (error) {
        this.logger.debug(
          `No fue posible registrar la latencia de esta consulta al RAG: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  private async doSearch(query: string, k: number): Promise<Citation[]> {
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

    const lexicalPromise = this.db
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

    const semanticPromise = this.semanticCandidates(query, SEMANTIC_TOP_K);

    const [lexicalRows, semanticRows] = await Promise.all([lexicalPromise, semanticPromise]);

    // Unión + dedupe por chunkId: un chunk que gana en las dos ramas entra
    // una sola vez, con el score léxico (ver computeScore). El pool completo
    // (sin recortar a k) es lo que sigue a CitationRelevanceService.filterRelevant().
    const merged = new Map<string, Citation>();
    for (const row of lexicalRows) {
      merged.set(row.chunkId, toCitation({ ...row, lexicalRank: Number(row.rank) }));
    }
    for (const row of semanticRows) {
      if (merged.has(row.chunkId)) continue;
      merged.set(row.chunkId, toCitation({ ...row, semanticDistance: Number(row.distance) }));
    }

    return [...merged.values()];
  }

  /**
   * Rama semántica nueva de SPEC 09: embebe la consulta a 768 dim y busca por
   * distancia coseno (`<=>`) contra chunks pre-embebidos de referencias
   * activas. Fail-open: sin GEMINI_API_KEY, o si el embedding de la consulta
   * falla, devuelve sin candidatos semánticos — el retrieval sigue funcionando
   * solo con la rama léxica, igual que antes de este spec.
   */
  private async semanticCandidates(
    query: string,
    limit: number,
  ): Promise<{ chunkId: string; text: string; docId: string; docName: string; version: number; distance: number }[]> {
    if (!this.embeddingClient.isAvailable) {
      return [];
    }

    let queryVector: number[];
    try {
      queryVector = await this.embeddingClient.embedOne(query, { outputDimensionality: SEMANTIC_EMBEDDING_DIM });
    } catch (error) {
      this.logger.error(
        `Embedding de la consulta falló, se sigue solo con retrieval léxico: ${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    }

    const queryVectorLiteral = `[${queryVector.join(',')}]`;
    const distance = sql<number>`${referenceChunks.embedding} <=> ${queryVectorLiteral}::vector`;

    return this.db
      .select({
        chunkId: referenceChunks.id,
        text: referenceChunks.text,
        docId: references.id,
        docName: references.name,
        version: references.version,
        distance,
      })
      .from(referenceChunks)
      .innerJoin(references, eq(references.id, referenceChunks.referenceId))
      .where(and(eq(references.active, true), isNotNull(referenceChunks.embedding)))
      .orderBy(asc(distance))
      .limit(limit);
  }
}
