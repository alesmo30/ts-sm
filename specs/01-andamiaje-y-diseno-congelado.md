# SPEC 01 — Andamiaje ejecutable y sistema de diseño congelado

> **Estado:** Aprobado
> **Depende de:** ninguna (es la primera)
> **Fecha:** 2026-08-06
> **Objetivo:** Levantar el monorepo `ts-sm` con `docker compose up` funcionando en tres servicios (`db`/`api`/`web`), rutas vacías y los tokens de `DESIGN.md` aplicados, sin una sola línea de lógica de negocio.

---

## Contexto — por qué existe este spec

El reto anuncia el **LLM obligatorio el 7 de agosto** y la entrega es el **10 de agosto**. Quedan tres días de build real. La ventaja competitiva es llegar al 7 con el andamiaje terminado: cuando llegue el modelo y el dataset, el tiempo se gasta en RAG y voz, no en configurar Docker.

Dos compuertas eliminatorias se aseguran **hoy**, no en D5:

- **R0.3** — la solución corre en ≤15 minutos siguiendo el README. Si `docker compose up` no funciona desde limpio el día cero, no va a funcionar mágicamente el día 5.
- **R0.6 / R1.5** — `LICENSE` MIT en la raíz y repo público. Cuesta 2 minutos y su ausencia descalifica.

Además `DESIGN.md` es un contrato visual cerrado. Si el tema de shadcn/ui no se sobreescribe **antes** de construir componentes, en D1 habrá 30 componentes con la paleta gris azulada por defecto y rehacerlos costará horas.

**Estado actual verificado:** el directorio solo contiene `DESIGN.md`, `REGLAS.md`, `TECH-SPHERE-CHALLENGE.md` y `plan/`. No hay git, no hay código.

**Bloqueadores de entorno detectados (se resuelven en el paso 1):**

| Bloqueador | Estado | Resolución |
|---|---|---|
| `pnpm` | no instalado | `npm i -g pnpm@10` — `corepack` no existe en Node v26 |
| Daemon de Docker | **apagado** | el usuario abre Docker Desktop; sin eso los pasos 3–5 no se verifican |
| Docker / Compose | 20.10.22 / v2.15.1 | suficiente; `docker compose` v2 responde |
| `gh` CLI | autenticado como `alesmo30` | el repo público se crea hoy |

---

## Alcance

**Dentro:**

- Repo git + remoto público en GitHub + `LICENSE` MIT + `.gitignore` estricto.
- Monorepo pnpm workspaces: `apps/api`, `apps/web`, `packages/shared`.
- `docker-compose.yml` con `db` (pgvector/pg16), `api` (NestJS), `web` (Vite) y **healthcheck en los tres**.
- `docker/db/init.sql` que habilita la extensión `vector`.
- `.env.example` completo (anexo del plan D0) + validación de entorno con Zod al arrancar la API.
- `apps/api`: `modules/health` funcional, `modules/llm` con solo el contrato `LLMPort` (sin driver), `common/` y `config/`.
- Capa de datos con **Drizzle ORM**: cliente, primera migración y chequeo real de conexión en `/health`.
- `apps/web`: Vite + React 19 + TS, arquitectura **feature-first + shared**, Tailwind con tokens de `DESIGN.md`, shadcn/ui retematizado, fuentes **autohospedadas**.
- Rutas `/medico` y `/paciente` con topbar, sidenav de 4 ítems y stage de pre-sesión — **estructura y estilo, sin datos**.
- ESLint 9 + Prettier en la raíz, Vitest en web, Jest en api, un test humo por app.
- `README.md` embrionario con el quick start real.

**Fuera de alcance (para specs posteriores):**

- Cualquier lógica de negocio, incluso con datos mock (es SPEC 02 / D1).
- Tablas con filas, aunque sean falsas. Hoy los contenedores de tabla quedan en estado vacío.
- Micrófono, STT, TTS, WebSockets.
- Vector store real, embeddings, ingesta, chunking.
- El **driver** del `LLMPort` — hoy solo el contrato TypeScript, ni siquiera el `mock`.
- Esquema de base de datos más allá de habilitar `vector` y una tabla de metadatos de migración.
- Autenticación, roles, RLS.
- Hooks de git (husky, lint-staged, commitlint) — descartado por fricción durante el sprint.

---

## Modelo de datos

Este spec **no introduce entidades de dominio**. Solo tres artefactos de datos:

**1. Extensión y schema base** — `docker/db/init.sql`:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE SCHEMA IF NOT EXISTS app;
```

**2. Contrato del health check** — vive en `packages/shared/src/contracts/health.contract.ts` para que web y api compartan el tipo:

```ts
export type HealthStatus = 'ok' | 'degraded';
export interface HealthResponse {
  status: HealthStatus;
  db: 'connected' | 'disconnected';
}
```

**3. Contrato del LLM** — `apps/api/src/modules/llm/llm.port.ts`. Solo tipos e interfaz abstracta; ninguna implementación:

```ts
export interface LlmUsage { inputTokens: number; outputTokens: number; costUsd: number; }
export interface LlmMessage { role: 'system' | 'user' | 'assistant'; content: string; }
export interface LlmCompletion { text: string; model: string; usage: LlmUsage; latencyMs: number; }
export abstract class LlmPort {
  abstract complete(messages: LlmMessage[], options?: LlmOptions): Promise<LlmCompletion>;
}
```

El campo `model` es obligatorio en la respuesta: es la evidencia auditable de R0.1.

---

## Estructura de carpetas

Contrato de arquitectura. Se respeta en todos los specs siguientes.

### Raíz

```
ts-sm/
├── LICENSE                    MIT (R0.6)
├── README.md                  quick start real
├── .env.example               todas las variables comentadas
├── .gitignore
├── pnpm-workspace.yaml        apps/* · packages/*
├── package.json               scripts: dev build test lint docker:up
├── tsconfig.base.json         strict:true + paths @ts-sm/shared
├── eslint.config.js           flat config compartida
├── .prettierrc
├── docker-compose.yml
├── docker/db/init.sql
├── apps/{api,web}/
└── packages/shared/
```

### `apps/api` — NestJS por capas

```
src/
├── main.ts                    bootstrap: ValidationPipe global, CORS, filtro global
├── app.module.ts              solo importa ConfigModule, DatabaseModule, HealthModule, LlmModule
├── config/
│   ├── env.schema.ts          Zod: falla al arrancar si falta una variable
│   ├── configuration.ts       objeto tipado derivado del schema
│   └── config.module.ts
├── common/
│   ├── filters/               AllExceptionsFilter
│   ├── interceptors/          LoggingInterceptor (base para métricas de RA.9)
│   ├── pipes/  guards/  decorators/
│   └── dto/                   DTOs base compartidos
├── database/
│   ├── database.module.ts     provee DRIZZLE_CLIENT
│   ├── drizzle.client.ts      pool de `pg` + drizzle()
│   ├── schema/index.ts        barrel; hoy vacío salvo el barrel
│   └── migrations/            generadas por drizzle-kit
├── modules/
│   ├── health/                controller · service · dto
│   └── llm/                   llm.port.ts · llm.types.ts · llm.module.ts
├── utils/                     puros y sin dependencias de Nest
└── helpers/                   con dependencias de infraestructura
```

**Regla de capas de la API (vinculante):** `controller` → `service` → `repository` → `drizzle`. Un controller nunca toca Drizzle. Un service nunca conoce `Request` ni `Response`.

### `apps/web` — feature-first + shared

```
src/
├── main.tsx
├── app/
│   ├── App.tsx  router.tsx  providers.tsx
├── features/
│   ├── medico/     components/ hooks/ api/ types/ index.ts
│   └── paciente/   components/ hooks/ api/ types/ index.ts
├── shared/
│   ├── components/ui/         shadcn RETEMATIZADO
│   ├── components/            StatusTag ChatBubble SystemDivider ...
│   ├── layouts/               AppLayout Topbar
│   ├── hooks/  lib/  utils/  helpers/  constants/  types/
├── styles/
│   ├── tokens.css             las variables de DESIGN.md §2, verbatim
│   ├── fonts.css              @font-face autohospedadas
│   └── index.css              Tailwind + mapeo de shadcn
└── public/fonts/              woff2 de las tres familias
```

**Regla de capas de web (vinculante):** una feature **nunca** importa de otra feature. Lo compartido sube a `shared/`. `shared/` nunca importa de `features/`.

**`utils` vs `helpers` vs `lib` — distinción explícita, sin ambigüedad:**

| Carpeta | Contenido | Ejemplo |
|---|---|---|
| `utils/` | funciones puras, sin dependencias, testeables aisladas | `formatSessionDate`, `truncateFilename` |
| `helpers/` | lógica con dependencias del dominio o de librerías | `buildCitationLabel`, `mapApiErrorToMessage` |
| `lib/` | clientes y configuración de terceros | `apiClient.ts`, `cn.ts`, `queryClient.ts` |

---

## Plan de implementación

Cada paso deja el sistema funcional y es commiteable por sí solo.

**1. Prerrequisitos y fundación del repo**
`npm i -g pnpm@10`. Verificar que el daemon de Docker responde. `git init`, `LICENSE` MIT, `.gitignore` (incluye `.env`, `node_modules/`, `models/`, `data/uploads/`, `.cache/`), `pnpm-workspace.yaml`, `package.json` raíz, `tsconfig.base.json` con `strict:true` y el path `@ts-sm/shared/*`. `gh repo create ts-sm --public --source=. --remote=origin`. Commit + push.
_Verificación:_ `ls LICENSE` y `git ls-files | grep -E "^\.env$|node_modules"` vacío.

**2. `packages/shared`**
Paquete `@ts-sm/shared` con `src/contracts/health.contract.ts` y su barrel `index.ts`. Sin build step: se consume por source vía los paths del tsconfig.
_Verificación:_ `pnpm -r exec tsc --noEmit` pasa.

**3. Tooling transversal**
`eslint.config.js` (flat, TS + react-hooks + import/order), `.prettierrc`, scripts raíz `lint`, `format`, `test`, `typecheck`.
_Verificación:_ `pnpm lint` corre sin errores de configuración.

**4. `apps/api` — Nest mínimo con Drizzle**
Scaffold Nest, `config/env.schema.ts` con Zod, `common/` (filtro global + interceptor de logging), `database/` con el cliente Drizzle, `modules/health` cuyo service hace `SELECT 1` real, `modules/llm` con solo `llm.port.ts`. Test Jest de humo sobre `HealthService` con el cliente mockeado.
_Verificación:_ `pnpm --filter api start:dev` + `curl localhost:3000/health` → `{"status":"ok","db":"connected"}` contra la `db` local.

**5. Docker de los tres servicios**
`docker/db/init.sql`, `apps/api/Dockerfile` (multi-stage, `node:22-alpine`, con el `RUN` de descarga de modelos preparado y comentado — RA.3), `apps/web/Dockerfile` (dev con Vite y HMR expuesto), `docker-compose.yml` con healthcheck en los tres y `depends_on: condition: service_healthy`. `.env.example` completo.
_Verificación:_ `docker compose up` desde limpio; `docker compose exec db psql -U postgres -d tssm -c "\dx"` lista `vector`.
_Timebox de 35 min:_ si no arranca, `db` en Docker y `api`/`web` en local; el compose se cierra al inicio de D1.

**6. `apps/web` — base y diseño congelado**
Vite + React 19 + TS. `styles/tokens.css` con las variables de `DESIGN.md` §2 verbatim. Tailwind con los tokens en `theme.extend` (`colors.bg/surface/surface-2/surface-3/fg/muted/accent/danger/warn`, `fontFamily.display/body/mono`, `borderRadius`). Fuentes descargadas a `public/fonts` + `fonts.css`. shadcn/ui instalado y sus variables (`--background`, `--foreground`, `--primary`, `--muted-foreground`, `--border`, `--ring`) mapeadas a los tokens propios.
_Verificación:_ el `<body>` computa `background-color: rgb(26, 28, 30)` en el inspector.

**7. Rutas y shells**
`react-router` con `/medico`, `/paciente` y redirección de `/` a `/medico`. `shared/layouts/Topbar.tsx` pixel-fiel: marca de 34px `radius:9px` sobre `--accent-soft`, título display 17–18px/600, subtítulo `--muted`, `switch-btn` pill a la derecha. `features/medico`: grid `minmax(260px,1fr) minmax(0,2fr)` + sidenav con los 4 ítems de `DESIGN.md` §4.2 y su numeración mono, el primero activo. `features/paciente`: stage centrado de 720px con la pre-sesión y su copy literal de `DESIGN.md` §8. Test Vitest de humo que renderiza la topbar.
_Verificación:_ ambas rutas renderizan con la paleta correcta y sin scroll horizontal a 360px.

**8. Cierre**
`README.md` con el quick start real (`.env.example` → `.env`, `docker compose up`, URLs). Commit + push. Anotar fricciones en `plan/01-jueves/D1-jue-06-ago.md`.

---

## Criterios de aceptación

- [ ] `docker compose up` desde limpio levanta los tres servicios sin intervención manual
- [ ] `curl localhost:3000/health` devuelve exactamente `{"status":"ok","db":"connected"}`
- [ ] `docker compose exec db psql -U postgres -d tssm -c "\dx"` lista la extensión `vector`
- [ ] `localhost:5173/` redirige a `/medico`
- [ ] `/medico` muestra topbar + sidenav de 4 ítems con el primero en estado activo (texto `--accent`, fondo `--accent-soft`)
- [ ] `/paciente` muestra topbar + pre-sesión centrada en un contenedor de 720px
- [ ] El `background-color` computado del `<body>` es `rgb(26, 28, 30)`, verificado en el inspector
- [ ] Los headings se renderizan en Space Grotesk cargada desde `/fonts`, sin petición a `fonts.googleapis.com` en la pestaña Network
- [ ] `ls LICENSE` existe y su primera línea dice MIT
- [ ] `git ls-files | grep -E "^\.env$|node_modules"` no devuelve nada
- [ ] La API falla al arrancar con mensaje explícito si falta una variable de entorno requerida
- [ ] `pnpm lint` y `pnpm typecheck` pasan en las tres workspaces
- [ ] `pnpm test` ejecuta al menos un test en `api` y uno en `web`, ambos verdes
- [ ] `grep -rn "anthropic\|openai\|@google" apps/api/src` no devuelve ningún SDK importado
- [ ] Ninguna carpeta de `features/` importa de otra `features/`
- [ ] Sin scroll horizontal en 360×800 y 1440×900

---

## Decisiones tomadas y descartadas

- **Sí:** Drizzle ORM + drizzle-kit. SQL-first, tipado estricto, migraciones en archivos versionados y soporte nativo de `vector()` para D3. Sin paso de `generate` que engorde el docker build (R0.3).
- **No:** TypeORM. Es el canónico en NestJS, pero sus migraciones son frágiles y pgvector queda como columna cruda.
- **No:** Prisma. Excelente DX, pero pgvector exige `Unsupported("vector")` + `$queryRaw`, y `prisma generate` suma tiempo al arranque.
- **No:** `pg` puro. Demasiado boilerplate para el volumen de D3.
- **Sí:** arquitectura feature-first en web con `shared/` transversal. En D3 habrá ~40 componentes; una carpeta `components/` plana sería inmanejable.
- **No:** capa `domain/` pura por feature. Ceremonia excesiva para un sprint de 5 días.
- **Sí:** distinción explícita `utils` / `helpers` / `lib` documentada en tabla. Sin la definición escrita, las tres carpetas se convierten en el mismo cajón de sastre.
- **Sí:** `modules/llm` se crea hoy pero **solo con el contrato**, sin driver. Traza la autopista de RA.1 sin adelantar D1.
- **No:** carpetas vacías de `sessions`, `patients`, `knowledge`, `voice`, `notify`. Directorios que no compilan nada ensucian el commit inicial.
- **Sí:** fuentes autohospedadas desde hoy. R0.3 no puede depender de `fonts.googleapis.com` y elimina una tarea de D5. Se desvía del plan D0 literal, que decía CDN.
- **Sí:** ESLint + Prettier + Vitest + Jest hoy. Son 15 puntos de la rúbrica que nunca se configuran después.
- **No:** husky + lint-staged + commitlint. Los hooks de pre-commit estorban en jornadas de 8 horas.
- **Sí:** pnpm workspaces con `npm i -g pnpm@10`. `corepack` no viene en Node v26.
- **Sí:** validación de entorno con Zod que **aborta el arranque**. Un fallo ruidoso en el minuto 0 es mejor que un `undefined` en el minuto 14 de la prueba cronometrada.
- **Sí:** repo público hoy con `gh`. R0.6 y R1.5 quedan cumplidas desde el primer commit.

---

## Riesgos

| Riesgo | Mitigación |
|---|---|
| El daemon de Docker está apagado y bloquea los pasos 3–5 | Es el primer prerrequisito del paso 1. Los pasos 1–4 y 6–7 se pueden completar sin Docker |
| Docker 20.10.22 es una versión antigua; puede fallar con la sintaxis moderna del compose | No usar `develop:`/`watch:`. Compose v2.15.1 soporta `healthcheck` y `depends_on: condition`, que es todo lo que se necesita |
| shadcn/ui pisa los tokens con su gris azulado por defecto | El paso 6 no se cierra sin verificar `rgb(26, 28, 30)` en el inspector. Es criterio de aceptación, no revisión a ojo |
| Se va el tiempo peleando con Docker | Timebox de 35 min. Plan B: `db` en Docker, `api`/`web` locales; se cierra en D1 |
| Tentación de construir features "de una vez" | El bloque "Fuera de alcance" es vinculante. Hoy solo andamiaje |
| El pin `node:22-alpine` no coincide con el Node v26 local | Docker es la fuente de verdad. `package.json` declara `engines.node: ">=22"` y el desarrollo local se hace contra los contenedores |

---

## Lo que **no** entra en este spec

- Cualquier lógica de negocio o dato mock.
- Micrófono, STT, TTS, WebSockets.
- RAG, embeddings, ingesta, vector store.
- El driver del `LLMPort` — hoy solo el contrato.
- Autenticación, roles, RLS.
- Tablas con filas y paneles de detalle poblados.

Cada uno, si aterriza, va en su propio spec.
