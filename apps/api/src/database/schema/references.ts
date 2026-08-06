import { boolean, index, integer, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { appSchema } from './pg-schema';

export const references = appSchema.table(
  'references',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull().unique(),
    type: text('type', { enum: ['PDF', 'MD', 'TXT', 'JSON', 'NOTA'] }).notNull(),
    addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
    sizeBytes: integer('size_bytes'),
    active: boolean('active').notNull().default(true),
    version: integer('version').notNull().default(1),
    chunks: integer('chunks').notNull().default(0),
    body: text('body').notNull(),
  },
  (table) => [index('references_active_idx').on(table.active)],
);
