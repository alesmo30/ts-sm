import { eq, isNull } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import { EmbeddingClient } from '../modules/embeddings/embedding.client';
import { validateEmbeddingConfig } from '../modules/embeddings/embedding.config';
import { runWithConcurrency } from '../modules/knowledge/chunk-translator';

import { referenceChunks } from './schema';

// Concurrencia y backoff conservadores a propósito: una corrida inicial con
// concurrencia 4 y backoff corto agotó los reintentos contra un 429 sostenido
// de Gemini (rate limit real medido, no cuota diaria — una llamada suelta
// inmediatamente después sí respondió). Serial + backoff más largo evita
// repetir el mismo agotamiento en los ~4170 chunks del corpus.
const BACKFILL_CONCURRENCY = 1;
const SEMANTIC_EMBEDDING_DIM = 768;
const MAX_RETRIES = 6;
const BASE_DELAY_MS = 2000;
const INTER_REQUEST_DELAY_MS = 300;

interface PendingChunk {
  id: string;
  text: string;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isRetryable(error: unknown): boolean {
  const status = (error as { status?: number })?.status;
  const code = (error as { code?: string })?.code;
  if (status === 429 || (typeof status === 'number' && status >= 500)) {
    return true;
  }
  return code === 'ECONNRESET' || code === 'ETIMEDOUT' || code === 'ECONNREFUSED';
}

async function embedWithRetry(client: EmbeddingClient, text: string): Promise<number[]> {
  let attempt = 0;
  for (;;) {
    try {
      return await client.embedOne(text, { outputDimensionality: SEMANTIC_EMBEDDING_DIM });
    } catch (error) {
      attempt += 1;
      if (attempt > MAX_RETRIES || !isRetryable(error)) {
        throw error;
      }
      await delay(BASE_DELAY_MS * 2 ** (attempt - 1));
    }
  }
}

async function backfill(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL debe estar definida para correr backfill-embeddings');
  }

  const embeddingClient = new EmbeddingClient(validateEmbeddingConfig(process.env));
  if (!embeddingClient.isAvailable) {
    console.log('GEMINI_API_KEY no configurada — no hay nada que backfillear.');
    return;
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool);

  const rows = await db
    .select({ id: referenceChunks.id, text: referenceChunks.text })
    .from(referenceChunks)
    .where(isNull(referenceChunks.embedding));

  const pending: PendingChunk[] = rows;
  const total = pending.length;
  console.log(`Chunks pendientes de embedding: ${total}`);

  if (total === 0) {
    await pool.end();
    return;
  }

  let done = 0;
  let failed = 0;

  await runWithConcurrency(pending, BACKFILL_CONCURRENCY, async (chunk) => {
    try {
      const embedding = await embedWithRetry(embeddingClient, chunk.text);
      await db.update(referenceChunks).set({ embedding }).where(eq(referenceChunks.id, chunk.id));
      done += 1;
      console.log(`[${done + failed}/${total}] embebido ${chunk.id}`);
      await delay(INTER_REQUEST_DELAY_MS);
    } catch (error) {
      failed += 1;
      console.error(`Falló embedding de chunk ${chunk.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  await pool.end();

  console.log('--- Reporte de backfill de embeddings ---');
  console.log(`Total procesados: ${done}/${total}`);
  console.log(`Fallidos: ${failed}`);
}

// Guard de ejecución: permite importar isRetryable desde el spec sin disparar
// la conexión a la base de datos (patrón ausente en seed.ts/kb-translate.ts
// porque nada los importa — este script sí necesita ser importable).
if (require.main === module) {
  backfill().catch((error) => {
    console.error('Falló backfill-embeddings:', error);
    process.exit(1);
  });
}
