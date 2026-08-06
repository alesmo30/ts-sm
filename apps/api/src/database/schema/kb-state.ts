import { sql } from 'drizzle-orm';
import { check, integer, smallint } from 'drizzle-orm/pg-core';

import { appSchema } from './pg-schema';

export const kbState = appSchema.table(
  'kb_state',
  {
    id: smallint('id').primaryKey().default(1),
    version: integer('version').notNull().default(1),
  },
  (table) => [check('kb_state_singleton_check', sql`${table.id} = 1`)],
);
