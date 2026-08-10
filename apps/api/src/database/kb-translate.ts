import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import { ChunkTranslator, runWithConcurrency, slugify, TRANSLATION_CONCURRENCY } from '../modules/knowledge/chunk-translator';
import { validateLlmConfig } from '../modules/llm/llm.config';
import { createLlmDriver } from '../modules/llm/registry';

import { referenceChunks, references } from './schema';

interface PendingChunk {
  id: string;
  seq: number;
  text: string;
  docSlug: string;
}

async function translate(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL debe estar definida para correr kb:translate');
  }

  const llm = createLlmDriver(validateLlmConfig(process.env));
  console.log(`Traductor usando proveedor=${llm.providerName} modelo=${llm.modelId}`);
  const translator = new ChunkTranslator(llm);

  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool);

  const rows = await db
    .select({
      id: referenceChunks.id,
      seq: referenceChunks.seq,
      text: referenceChunks.text,
      refName: references.name,
    })
    .from(referenceChunks)
    .innerJoin(references, eq(references.id, referenceChunks.referenceId))
    .where(and(eq(referenceChunks.lang, 'english'), eq(referenceChunks.translated, false)));

  const pending: PendingChunk[] = rows.map((row) => ({
    id: row.id,
    seq: row.seq,
    text: row.text,
    docSlug: slugify(row.refName),
  }));

  const total = pending.length;
  console.log(`Chunks pendientes de traducción: ${total}`);

  let done = 0;
  let cacheHits = 0;
  let llmCalls = 0;

  await runWithConcurrency(pending, TRANSLATION_CONCURRENCY, async (chunk) => {
    const { translation, fromCache } = await translator.translate(chunk.docSlug, chunk.seq, chunk.text);

    if (fromCache) {
      cacheHits += 1;
    } else {
      llmCalls += 1;
    }

    await db
      .update(referenceChunks)
      .set({ sourceText: chunk.text, text: translation, translated: true })
      .where(eq(referenceChunks.id, chunk.id));

    done += 1;
    console.log(`[${done}/${total}] (${fromCache ? 'caché' : 'LLM'}) ${chunk.docSlug} #${chunk.seq}`);
  });

  await pool.end();

  console.log('--- Reporte de traducción ---');
  console.log(`Total procesados: ${done}/${total}`);
  console.log(`Aciertos de caché: ${cacheHits}`);
  console.log(`Llamadas al LLM: ${llmCalls}`);
  if (total > 0) {
    console.log(`% aciertos de caché: ${((cacheHits / total) * 100).toFixed(1)}%`);
  }
}

translate().catch((error) => {
  console.error('Falló kb:translate:', error);
  process.exit(1);
});
