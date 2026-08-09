import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { resolveFromRepoRoot } from './repo-root';

export interface KbCacheEntry {
  seq: number;
  hash: string;
  original: string;
  translation: string;
}

const CACHE_DIR = resolveFromRepoRoot('apps/api/src/database/kb-cache');
const ORIGINAL_MARKER = '**Original:**';
const TRANSLATION_MARKER = '**Traducción:**';

function cacheFilePath(docSlug: string): string {
  return path.join(CACHE_DIR, `${docSlug}.md`);
}

function formatEntry(entry: KbCacheEntry): string {
  const seqLabel = String(entry.seq).padStart(4, '0');
  return [
    `## chunk ${seqLabel}`,
    `hash: ${entry.hash}`,
    '',
    ORIGINAL_MARKER,
    '',
    entry.original,
    '',
    TRANSLATION_MARKER,
    '',
    entry.translation,
    '',
  ].join('\n');
}

/**
 * Lee el caché en disco de un documento y lo indexa por hash del texto
 * original, que es la clave que usa kb:translate para decidir si ya existe
 * traducción sin llamar al LLM.
 */
export async function readCache(docSlug: string): Promise<Map<string, string>> {
  const filePath = cacheFilePath(docSlug);
  const byHash = new Map<string, string>();

  let content: string;
  try {
    content = await readFile(filePath, 'utf-8');
  } catch {
    return byHash;
  }

  const blocks = content.split(/\n(?=## chunk )/);

  for (const block of blocks) {
    const hashMatch = block.match(/^hash:\s*(\S+)/m);
    if (!hashMatch) {
      continue;
    }

    const translationStart = block.indexOf(TRANSLATION_MARKER);
    if (translationStart === -1) {
      continue;
    }

    const translation = block.slice(translationStart + TRANSLATION_MARKER.length).trim();
    byHash.set(hashMatch[1], translation);
  }

  return byHash;
}

/**
 * Escribe una traducción en el caché en disco, chunk a chunk. Se llama
 * siempre antes del UPDATE a la base — si el proceso muere entre medio, la
 * llamada al LLM ya pagada queda a salvo en disco.
 */
export async function appendCache(docSlug: string, entry: KbCacheEntry): Promise<void> {
  await mkdir(CACHE_DIR, { recursive: true });
  const filePath = cacheFilePath(docSlug);

  const section = formatEntry(entry);

  let exists = true;
  try {
    await readFile(filePath, 'utf-8');
  } catch {
    exists = false;
  }

  if (!exists) {
    await writeFile(filePath, `# ${docSlug}\n\n${section}`, 'utf-8');
    return;
  }

  await writeFile(filePath, section, { flag: 'a', encoding: 'utf-8' });
}
