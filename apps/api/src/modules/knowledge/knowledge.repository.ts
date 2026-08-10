import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq, isNull, ne, sql } from 'drizzle-orm';

import { DRIZZLE_CLIENT } from '../../database/database.module';
import type { DrizzleClient } from '../../database/drizzle.client';
import { ingestJobs, kbState, referenceChunks, references } from '../../database/schema';
import { EmbeddingClient } from '../embeddings/embedding.client';

const SEMANTIC_EMBEDDING_DIM = 768;

export interface ReferenceRow {
  id: string;
  name: string;
  type: 'PDF' | 'MD' | 'TXT' | 'JSON' | 'NOTA';
  addedAt: Date;
  sizeBytes: number | null;
  active: boolean;
  version: number;
  chunks: number;
  body: string;
  origin: 'corpus' | 'upload';
}

export interface IngestJobRow {
  id: string;
  referenceId: string | null;
  fileName: string;
  stage: 'Recibido' | 'Extrayendo texto' | 'Fragmentando' | 'Generando embeddings' | 'Indexado';
  pct: number;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewChunk {
  text: string;
  sourceText: string | null;
  lang: 'spanish' | 'english';
  translated: boolean;
}

export interface CreateReferenceInput {
  name: string;
  type: 'PDF' | 'MD' | 'TXT' | 'JSON' | 'NOTA';
  sizeBytes: number | null;
  body: string;
  origin: 'corpus' | 'upload';
  chunks: NewChunk[];
}

export interface CreateReferenceResult {
  reference: ReferenceRow;
  kbVersion: number;
}

export interface FindReferencesOptions {
  origin?: 'corpus' | 'upload';
  includeInactive?: boolean;
}

@Injectable()
export class KnowledgeRepository {
  private readonly logger = new Logger(KnowledgeRepository.name);

  constructor(
    @Inject(DRIZZLE_CLIENT) private readonly db: DrizzleClient,
    private readonly embeddingClient: EmbeddingClient,
  ) {}

  async findReferences(options: FindReferencesOptions = {}): Promise<ReferenceRow[]> {
    const conditions = [
      options.origin ? eq(references.origin, options.origin) : undefined,
      options.includeInactive ? undefined : eq(references.active, true),
    ].filter((condition): condition is NonNullable<typeof condition> => condition !== undefined);

    return this.db
      .select()
      .from(references)
      .where(conditions.length > 0 ? and(...conditions) : undefined);
  }

  async findActiveReferences(): Promise<ReferenceRow[]> {
    return this.findReferences({ includeInactive: false });
  }

  async findReferenceByName(name: string): Promise<ReferenceRow | undefined> {
    const [row] = await this.db.select().from(references).where(eq(references.name, name));
    return row;
  }

  async getKbVersion(): Promise<number> {
    const [row] = await this.db.select({ version: kbState.version }).from(kbState);
    return row?.version ?? 1;
  }

  /**
   * Embebe cada chunk a 768 dim para la rama semántica de RetrievalService
   * (SPEC 09). Fail-open por chunk, no por lote: un solo timeout de Gemini no
   * debe tumbar la ingesta entera ni dejar sin embedding a los chunks que sí
   * respondieron — ese chunk queda sin `embedding` hasta el próximo backfill.
   */
  private async embedChunksFailOpen(chunks: NewChunk[]): Promise<(number[] | null)[]> {
    if (!this.embeddingClient.isAvailable) {
      return chunks.map(() => null);
    }

    return Promise.all(
      chunks.map(async (chunk) => {
        try {
          return await this.embeddingClient.embedOne(chunk.text, { outputDimensionality: SEMANTIC_EMBEDDING_DIM });
        } catch (error) {
          this.logger.error(
            `Embedding de chunk falló, se guarda sin embedding: ${error instanceof Error ? error.message : String(error)}`,
          );
          return null;
        }
      }),
    );
  }

  /** Inserta la referencia y sus chunks e incrementa kb_state.version en una sola transacción. */
  async createReferenceWithChunks(input: CreateReferenceInput): Promise<CreateReferenceResult> {
    const embeddings = await this.embedChunksFailOpen(input.chunks);

    return this.db.transaction(async (tx) => {
      const [reference] = await tx
        .insert(references)
        .values({
          name: input.name,
          type: input.type,
          sizeBytes: input.sizeBytes,
          active: true,
          version: 1,
          chunks: input.chunks.length,
          body: input.body,
          origin: input.origin,
        })
        .returning();

      for (const [seq, chunk] of input.chunks.entries()) {
        await tx.insert(referenceChunks).values({
          referenceId: reference.id,
          seq,
          text: chunk.text,
          sourceText: chunk.sourceText,
          lang: chunk.lang,
          translated: chunk.translated,
          embedding: embeddings[seq],
        });
      }

      const [{ version: kbVersion }] = await tx
        .update(kbState)
        .set({ version: sql`${kbState.version} + 1` })
        .where(eq(kbState.id, 1))
        .returning({ version: kbState.version });

      return { reference, kbVersion };
    });
  }

  /** Activa/desactiva una referencia e incrementa kb_state.version en la misma transacción. */
  async setReferenceActive(id: string, active: boolean): Promise<{ reference: ReferenceRow; kbVersion: number } | undefined> {
    return this.db.transaction(async (tx) => {
      const [reference] = await tx
        .update(references)
        .set({ active })
        .where(eq(references.id, id))
        .returning();

      if (!reference) {
        return undefined;
      }

      const [{ version: kbVersion }] = await tx
        .update(kbState)
        .set({ version: sql`${kbState.version} + 1` })
        .where(eq(kbState.id, 1))
        .returning({ version: kbState.version });

      return { reference, kbVersion };
    });
  }

  async createJob(fileName: string): Promise<IngestJobRow> {
    const [job] = await this.db
      .insert(ingestJobs)
      .values({ fileName, stage: 'Recibido', pct: 0 })
      .returning();
    return job;
  }

  async updateJobStage(
    id: string,
    patch: Partial<Pick<IngestJobRow, 'stage' | 'pct' | 'error' | 'referenceId'>>,
  ): Promise<IngestJobRow | undefined> {
    const [job] = await this.db
      .update(ingestJobs)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(ingestJobs.id, id))
      .returning();
    return job;
  }

  async findJob(id: string): Promise<IngestJobRow | undefined> {
    const [job] = await this.db.select().from(ingestJobs).where(eq(ingestJobs.id, id));
    return job;
  }

  /** Jobs no terminales: ni Indexado ni con error — lo que sondea una consola recién abierta. */
  async findOpenJobs(): Promise<IngestJobRow[]> {
    return this.db
      .select()
      .from(ingestJobs)
      .where(and(ne(ingestJobs.stage, 'Indexado'), isNull(ingestJobs.error)))
      .orderBy(ingestJobs.createdAt);
  }
}
