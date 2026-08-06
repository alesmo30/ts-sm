# ts-sm

Monorepo del asistente de voz post-operatorio. Andamiaje ejecutable: tres servicios dockerizados, sin lógica de negocio todavía (ver `specs/01-andamiaje-y-diseno-congelado.md`).

## Quick start

Requisitos: Docker + Docker Compose v2.

```bash
cp .env.example .env
docker compose up
```

Los tres servicios (`db`, `api`, `web`) levantan con healthcheck y arrancan en orden de dependencia. Primer arranque puede tardar unos minutos (descarga de imágenes + build de las dos imágenes propias).

Cuando los tres estén `healthy`:

| Servicio | URL |
|---|---|
| Web | http://localhost:5173 |
| API | http://localhost:3000 |
| Health check | http://localhost:3000/health |
| Postgres (pgvector) | `localhost:5432` |

```bash
curl localhost:3000/health
# {"status":"ok","db":"connected"}
```

Para bajar todo (incluyendo volúmenes de datos):

```bash
docker compose down -v
```

## Desarrollo local (sin Docker)

Requiere Node ≥22 y pnpm 10 (`npm i -g pnpm@10`; `corepack` no viene con Node v26).

```bash
pnpm install
pnpm dev          # levanta api y web en paralelo
pnpm lint
pnpm typecheck
pnpm test
```

La API necesita una Postgres accesible en `DATABASE_URL` (ver `.env.example`); sin ella falla al arrancar con un mensaje explícito.

## Estructura

```
apps/api/       NestJS por capas — controller → service → repository → drizzle
apps/web/       Vite + React 19, arquitectura feature-first + shared
packages/shared/ contratos TypeScript compartidos entre api y web
docker/db/      init.sql — habilita la extensión pgvector
```

Detalle completo de la arquitectura y las reglas de capas en `specs/01-andamiaje-y-diseno-congelado.md` y el contrato visual en `DESIGN.md`.

## Licencia

MIT — ver `LICENSE`.
