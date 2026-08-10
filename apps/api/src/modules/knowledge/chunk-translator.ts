import { createHash } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { appendCache, readCache } from '../../database/kb-cache';
import { LlmPort } from '../llm/llm.port';

export const TRANSLATION_CONCURRENCY = 4;
const HASH_PREFIX_CHARS = 512;
const MAX_RETRIES = 4;
const BASE_DELAY_MS = 1000;

const TRANSLATION_SYSTEM_PROMPT = `Eres un traductor médico literal de inglés a español (es-CO).
Traduce el texto del usuario al español de Colombia, preservando terminología clínica exacta.
No agregues comentarios, notas ni explicaciones. No resumas ni omitas contenido.
Responde únicamente con el texto traducido, sin encabezados ni comillas.`;

export function slugify(name: string): string {
  return name
    .replace(/\.pdf$/i, '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function hashOriginal(text: string): string {
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

export async function runWithConcurrency<T>(
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

/**
 * Traduce un chunk consultando primero el caché en disco por hash del texto
 * original. Único punto que llama a LlmPort para traducción — kb-translate.ts
 * (script bulk) y el pipeline de ingesta (SPEC 08) comparten esta misma
 * implementación en vez de mantener dos copias del mismo prompt.
 */
@Injectable()
export class ChunkTranslator {
  constructor(private readonly llmPort: LlmPort) {}

  async translate(docSlug: string, seq: number, text: string): Promise<{ translation: string; fromCache: boolean }> {
    const hash = hashOriginal(text);
    const cache = await readCache(docSlug);
    const cached = cache.get(hash);

    if (cached !== undefined) {
      return { translation: cached, fromCache: true };
    }

    const translation = await this.translateWithRetry(text);
    await appendCache(docSlug, { seq, hash, original: text, translation });
    return { translation, fromCache: false };
  }

  private async translateWithRetry(text: string): Promise<string> {
    let attempt = 0;
    for (;;) {
      try {
        const completion = await this.llmPort.complete(
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
        await delay(backoffMs);
      }
    }
  }
}
