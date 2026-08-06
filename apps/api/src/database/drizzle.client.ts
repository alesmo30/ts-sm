import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import * as schema from './schema';

export type DrizzleClient = NodePgDatabase<typeof schema>;

export function createDrizzleClient(databaseUrl: string): { pool: Pool; db: DrizzleClient } {
  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool, { schema });
  return { pool, db };
}
