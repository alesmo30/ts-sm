import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import path from 'node:path';

import { appendCache, readCache } from './kb-cache';
import { resolveFromRepoRoot } from './repo-root';

describe('kb-cache', () => {
  const docSlug = `test-doc-${randomUUID()}`;

  afterEach(async () => {
    await rm(path.join(resolveFromRepoRoot('apps/api/src/database/kb-cache'), `${docSlug}.md`), {
      force: true,
    });
  });

  it('devuelve mapa vacío si el documento no tiene caché aún', async () => {
    const cache = await readCache(docSlug);
    expect(cache.size).toBe(0);
  });

  it('escribe y relee una traducción por hash (round-trip)', async () => {
    await appendCache(docSlug, {
      seq: 0,
      hash: 'hash-uno',
      original: 'Original text one.',
      translation: 'Texto original uno traducido.',
    });

    const cache = await readCache(docSlug);

    expect(cache.get('hash-uno')).toBe('Texto original uno traducido.');
  });

  it('acumula varias entradas sin pisar las anteriores', async () => {
    await appendCache(docSlug, {
      seq: 0,
      hash: 'hash-a',
      original: 'A',
      translation: 'Traducción A',
    });
    await appendCache(docSlug, {
      seq: 1,
      hash: 'hash-b',
      original: 'B',
      translation: 'Traducción B',
    });

    const cache = await readCache(docSlug);

    expect(cache.get('hash-a')).toBe('Traducción A');
    expect(cache.get('hash-b')).toBe('Traducción B');
    expect(cache.size).toBe(2);
  });

  it('conserva traducciones multilínea', async () => {
    await appendCache(docSlug, {
      seq: 0,
      hash: 'hash-multi',
      original: 'Línea uno.\nLínea dos.',
      translation: 'Primera línea traducida.\nSegunda línea traducida.',
    });

    const cache = await readCache(docSlug);

    expect(cache.get('hash-multi')).toBe('Primera línea traducida.\nSegunda línea traducida.');
  });
});
