import path from 'node:path';

const REPO_ROOT = path.resolve(__dirname, '../../../..');

/**
 * Los scripts `kb:*` corren tanto desde la raíz (`pnpm kb:ingest`) como desde
 * `apps/api` (`pnpm --filter api kb:ingest`), y pnpm fija el cwd en `apps/api`
 * en ambos casos. Las rutas de `.env` (p. ej. `KNOWLEDGE_LOCAL_DIR`) están
 * escritas relativas a la raíz del repo, así que se resuelven contra ella y
 * no contra `process.cwd()`.
 */
export function resolveFromRepoRoot(relativeOrAbsolutePath: string): string {
  return path.isAbsolute(relativeOrAbsolutePath)
    ? relativeOrAbsolutePath
    : path.resolve(REPO_ROOT, relativeOrAbsolutePath);
}
