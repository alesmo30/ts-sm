import { index, integer, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { appSchema } from './pg-schema';
import { references } from './references';

export const ingestJobs = appSchema.table(
  'ingest_jobs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    referenceId: uuid('reference_id').references(() => references.id, { onDelete: 'set null' }),
    fileName: text('file_name').notNull(),
    stage: text('stage', {
      enum: ['Recibido', 'Extrayendo texto', 'Fragmentando', 'Generando embeddings', 'Indexado'],
    }).notNull(),
    pct: integer('pct').notNull().default(0),
    error: text('error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('ingest_jobs_created_idx').on(table.createdAt.desc())],
);
