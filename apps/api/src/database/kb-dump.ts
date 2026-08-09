import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import { referenceChunks, references } from './schema';

const OUTPUT_PATH = path.join(__dirname, 'seed-data', 'kb-corpus.json.gz');

export interface KbCorpusDump {
  references: (typeof references.$inferSelect)[];
  referenceChunks: (typeof referenceChunks.$inferSelect)[];
}

async function dump(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL debe estar definida para correr kb:dump');
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool);

  const referenceRows = await db.select().from(references);
  const chunkRows = await db.select().from(referenceChunks);

  await pool.end();

  const payload: KbCorpusDump = { references: referenceRows, referenceChunks: chunkRows };
  const gzipped = gzipSync(Buffer.from(JSON.stringify(payload)), { level: 9 });

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, gzipped);

  console.log(`Volcado: ${referenceRows.length} referencias, ${chunkRows.length} chunks`);
  console.log(`Escrito en ${OUTPUT_PATH} (${(gzipped.byteLength / 1024 / 1024).toFixed(2)} MB)`);
}

dump().catch((error) => {
  console.error('Falló kb:dump:', error);
  process.exit(1);
});
