import { defineConfig } from 'drizzle-kit';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL debe estar definida para correr drizzle-kit');
}

export default defineConfig({
  schema: './src/database/schema/index.ts',
  out: './src/database/migrations',
  dialect: 'postgresql',
  schemaFilter: ['app'],
  dbCredentials: { url: databaseUrl },
});
