# ts-sm

Monorepo del asistente de voz post-operatorio. Tres servicios dockerizados con datos reales: contratos Zod compartidos, persistencia en Postgres y una API REST poblada con la semilla del prototipo (ver `specs/01-andamiaje-y-diseno-congelado.md` y `specs/02-contratos-persistencia-y-api.md`).

## Quick start

Requisitos: Docker + Docker Compose v2.

```bash
cp .env.example .env
docker compose up
```

Los tres servicios (`db`, `api`, `web`) levantan con healthcheck y arrancan en orden de dependencia. Primer arranque puede tardar unos minutos (descarga de imágenes + build de las dos imágenes propias).

El contenedor `api` aplica las migraciones y siembra los datos del prototipo (5 sesiones, 3 pacientes prioritarios, 5 referencias) automáticamente al arrancar — no hace falta ningún comando manual, ni siquiera en el primer `docker compose up` contra un volumen vacío.

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

### Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/health` | estado de la API y de la conexión a la db |
| `GET` | `/sessions?q=` | lista de sesiones, `q` filtra por paciente, código o procedimiento |
| `GET` | `/sessions/:id` | detalle de una sesión con su hilo de turnos |
| `POST` | `/sessions` | crea una sesión (`patientName`, `procedure`) |
| `POST` | `/sessions/:id/turns` | agrega un turno al hilo de una sesión |
| `PATCH` | `/sessions/:id` | actualiza `status` y/o `summary` |
| `GET` | `/patients/priority` | pacientes con atención personalizada |
| `GET` | `/patients/priority/:id` | detalle de un paciente prioritario |
| `GET` | `/knowledge/references` | referencias activas de la base de conocimiento |
| `GET` | `/knowledge/state` | versión vigente de la base de conocimiento |

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

Fuera de Docker, migrar y sembrar es manual:

```bash
pnpm --filter shared build   # @ts-sm/shared necesita su dist/ para que api lo resuelva en runtime
pnpm --filter api db:migrate
pnpm seed                    # idempotente — correrlo dos veces no duplica datos
```

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
