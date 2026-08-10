import { boolean, customType, index, integer, text, uuid } from 'drizzle-orm/pg-core';

import { appSchema } from './pg-schema';
import { references } from './references';

const tsvector = customType<{ data: string }>({
  dataType() {
    return 'tsvector';
  },
});

const vector768 = customType<{ data: number[] }>({
  dataType() {
    return 'vector(768)';
  },
  // Sin esto, drizzle serializa number[] con la sintaxis de array nativo de
  // Postgres ("{1,2,3}"), que pgvector rechaza — el tipo espera su propio
  // formato de literal ("[1,2,3]"). Bug real encontrado en QA manual de SPEC 09:
  // toda ingesta con GEMINI_API_KEY configurada fallaba al insertar el chunk.
  toDriver(value: number[]): string {
    return `[${value.join(',')}]`;
  },
});

export const referenceChunks = appSchema.table(
  'reference_chunks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    referenceId: uuid('reference_id')
      .notNull()
      .references(() => references.id, { onDelete: 'cascade' }),
    seq: integer('seq').notNull(),
    text: text('text').notNull(),
    sourceText: text('source_text'),
    lang: text('lang', { enum: ['spanish', 'english'] }).notNull(),
    translated: boolean('translated').notNull().default(false),
    // Generado por Postgres (GENERATED ALWAYS AS ... STORED, ver migración 0002 editada a mano):
    // nunca se escribe desde el código, por eso no lleva .notNull() aquí.
    tsv: tsvector('tsv'),
    embedding: vector768('embedding'),
  },
  (table) => [
    index('reference_chunks_tsv_idx').using('gin', table.tsv),
    index('reference_chunks_ref_idx').on(table.referenceId, table.seq),
  ],
);
