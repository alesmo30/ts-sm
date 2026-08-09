import { createHash } from 'node:crypto';

import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import { validateLlmConfig } from '../modules/llm/llm.config';
import type { LlmPort } from '../modules/llm/llm.port';
import { createLlmDriver } from '../modules/llm/registry';

import { appendCache, readCache } from './kb-cache';
import { referenceChunks, references } from './schema';

const CONCURRENCY = 4;
const HASH_PREFIX_CHARS = 512;
const MAX_RETRIES = 4;
const BASE_DELAY_MS = 1000;

const TRANSLATION_SYSTEM_PROMPT = `Eres un traductor médico literal de inglés a español (es-CO).
Traduce el texto del usuario al español de Colombia, preservando terminología clínica exacta.
No agregues comentarios, notas ni explicaciones. No resumas ni omitas contenido.
Responde únicamente con el texto traducido, sin encabezados ni comillas.`;

function slugify(name: string): string {
  return name
    .replace(/\.pdf$/i, '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function hashOriginal(text: string): string {
  return createHash('sha1').update(text.slice(0, HASH_PREFIX_CHARS)).digest('hex');
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryable(error: unknown): boolean {
  const status = (error as { status?: number })?.status;
  const code = (error as { code?: string })?.code;
  if (status === 429 || (typeof status === 'number' && status >= 500)) {
    return true;
  }
  return code === 'ECONNRESET' || code === 'ETIMEDOUT' || code === 'ECONNREFUSED';
}

async function translateWithRetry(llm: LlmPort, text: string): Promise<string> {
  let attempt = 0;
  for (;;) {
    try {
      const completion = await llm.complete(
        [
          { role: 'system', content: TRANSLATION_SYSTEM_PROMPT },
          { role: 'user', content: text },
        ],
        { temperature: 0 },
      );
      return completion.text.trim();
    } catch (error) {
      attempt += 1;
      if (attempt > MAX_RETRIES || !isRetryable(error)) {
        throw error;
      }
      const backoffMs = BASE_DELAY_MS * 2 ** (attempt - 1);
      console.log(`  reintento ${attempt}/${MAX_RETRIES} en ${backoffMs}ms tras error: ${String(error)}`);
      await delay(backoffMs);
    }
  }
}

interface PendingChunk {
  id: string;
  seq: number;
  text: string;
  docSlug: string;
}

async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let cursor = 0;

  async function runNext(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      await worker(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => runNext()));
}

async function translate(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL debe estar definida para correr kb:translate');
  }

  const llm = createLlmDriver(validateLlmConfig(process.env));
  console.log(`Traductor usando proveedor=${llm.providerName} modelo=${llm.modelId}`);

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

  const cacheByDoc = new Map<string, Map<string, string>>();

  async function getCacheForDoc(docSlug: string): Promise<Map<string, string>> {
    const existing = cacheByDoc.get(docSlug);
    if (existing) {
      return existing;
    }
    const loaded = await readCache(docSlug);
    cacheByDoc.set(docSlug, loaded);
    return loaded;
  }

  await runWithConcurrency(pending, CONCURRENCY, async (chunk) => {
    const hash = hashOriginal(chunk.text);
    const cache = await getCacheForDoc(chunk.docSlug);
    const cached = cache.get(hash);

    let translation: string;
    if (cached !== undefined) {
      translation = cached;
      cacheHits += 1;
    } else {
      translation = await translateWithRetry(llm, chunk.text);
      llmCalls += 1;

      await appendCache(chunk.docSlug, {
        seq: chunk.seq,
        hash,
        original: chunk.text,
        translation,
      });
      cache.set(hash, translation);
    }

    await db
      .update(referenceChunks)
      .set({ sourceText: chunk.text, text: translation, translated: true })
      .where(eq(referenceChunks.id, chunk.id));

    done += 1;
    const source = cached !== undefined ? 'caché' : 'LLM';
    console.log(`[${done}/${total}] (${source}) ${chunk.docSlug} #${chunk.seq}`);
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
