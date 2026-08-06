#!/bin/sh
set -e

cd /repo/apps/api

echo "Esperando conexión con Postgres..."
until node -e "
const { Client } = require('pg');
new Client({ connectionString: process.env.DATABASE_URL }).connect()
  .then((c) => c.end())
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
"; do
  echo "Postgres no disponible aún, reintentando en 1s..."
  sleep 1
done

echo "Aplicando migraciones..."
node_modules/.bin/drizzle-kit migrate

echo "Sembrando datos..."
node_modules/.bin/tsx src/database/seed.ts

echo "Arrancando API..."
exec node dist/apps/api/src/main.js
