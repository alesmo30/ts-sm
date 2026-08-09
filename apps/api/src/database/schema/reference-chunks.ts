import { boolean, customType, index, integer, text, uuid } from 'drizzle-orm/pg-core';

import { references } from './references';
import { appSchema } from './pg-schema';

const tsvector = customType<{ data: string }>({
  dataType() {
    return 'tsvector';
  },
});

const vector768 = customType<{ data: number[] }>({
  dataType() {
    return 'vector(768)';
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
