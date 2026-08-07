# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`ts-sm` is a post-operative voice-agent assistant built for the **Tech Sphere Challenge 2** (Source Meridian). Read `REGLAS.md` before any architectural decision — it is not background reading, it is the constraint set that invalidates the whole submission if violated. Key constraints that shape the codebase:

- **Only one LLM is allowed** (announced 2026-08-07). Every LLM call must go through `apps/api/src/modules/llm/llm.port.ts` (`LlmPort.complete()`) — no module may import an LLM SDK directly. This is why `LlmPort` exists today with zero drivers: it's the seam that lets the real model get swapped in later without touching call sites.
- STT/TTS/embeddings/rerankers are **not** considered "the LLM" and are free to choose (see REGLAS.md's "zona gris" table) — but a second *generative* LLM, even for trivial text normalization, is not allowed under any circumstance.
- The whole stack must run via `docker compose up` in ≤15 minutes on a clean machine, with no required external accounts besides the LLM.
- Repo is public; `.env` must never be committed (`.env.example` only).

## Spec-driven workflow

This repo is built spec-by-spec via the `/spec` and `/spec-impl` skills. Specs live in `specs/NN-slug.md` and each is self-contained: objective, scope (in/out), data model, numbered implementation plan, boolean acceptance criteria, decisions taken/discarded. **Read the relevant spec before touching code it governs** — architectural rationale for "why is X built this way" lives there, not in comments.

- A spec's `Estado` header must read `Aprobado` (or equivalent) before `/spec-impl` will implement it.
- Each numbered step in a spec's implementation plan is meant to leave the system in a runnable, commitable state.
- `specs/.spec-config.yml` controls whether `/spec-impl` auto-creates its `spec-NN-slug` branch (`AutoCreateBranch: true` by default).
- **Never merge a finished spec branch to `main` directly.** Push the branch and open a PR with `gh pr create` for human review/merge.
- When a spec branch turns up friction not worth reopening the spec for, it gets logged in the day's plan file under `plan/01-jueves/D1-jue-06-ago.md` (or the equivalent day file), not silently fixed and forgotten.

## Commands

Run from repo root unless noted. Requires Node ≥22 and pnpm 10 (`npm i -g pnpm@10` — `corepack` is not bundled with Node v26).

```bash
pnpm install
pnpm dev                    # api + web in parallel (pnpm -r --parallel run dev)
pnpm build                  # pnpm -r run build — builds packages/shared before apps that depend on it
pnpm lint                   # eslint . (flat config, root-level)
pnpm typecheck              # pnpm -r exec tsc --noEmit across all workspaces
pnpm test                   # pnpm -r run test — runs Jest (api) and Vitest (web)
pnpm seed                   # pnpm --filter api seed — idempotent, safe to rerun
```

Per-workspace, single-test invocations:

```bash
pnpm --filter api test -- sessions          # Jest, filter by filename/describe pattern
pnpm --filter web test -- useSessions       # Vitest run, same filtering
pnpm --filter api start:dev                 # nest start --watch, needs DATABASE_URL
pnpm --filter api db:generate               # drizzle-kit generate — after editing database/schema/*
pnpm --filter api db:migrate                # drizzle-kit migrate — apply against local db
pnpm --filter shared build                  # tsc → dist/ — required before api/web pick up contract changes
```

Docker (the canonical way to run the full stack):

```bash
cp .env.example .env
docker compose up               # db (pgvector/pg16), api (NestJS), web (Vite), all with healthchecks
docker compose down -v          # tear down including volumes — use before re-testing a clean boot
```

The `api` container's entrypoint (`apps/api/docker-entrypoint.sh`) waits for Postgres, runs `drizzle-kit migrate`, runs the seed script, then starts the app — every `docker compose up` from a clean volume ends up with a populated database, no manual step required.

## Architecture

### Monorepo layout

pnpm workspaces: `apps/api` (NestJS), `apps/web` (Vite + React 19), `packages/shared` (Zod contracts). `packages/shared` is a **real build dependency**, not a types-only package — see "packages/shared has a build step" below before assuming source-only consumption works.

### `apps/api` — layered NestJS

Strict layering, enforced by convention (not tooling): **controller → service → repository → drizzle**. A controller never touches Drizzle directly; a service never sees `Request`/`Response`. Each domain module (`modules/sessions`, `modules/patients`, `modules/knowledge`) follows the same four-file shape: `*.controller.ts`, `*.service.ts`, `*.repository.ts`, `*.module.ts`, plus a `*.service.spec.ts` that mocks the repository.

- **Validation**: `common/pipes/zod-validation.pipe.ts` (`ZodValidationPipe`) wraps a Zod schema and is applied per-route via `@Body(new ZodValidationPipe(SomeSchema))` — there is deliberately no global validation pipe, because different routes need different schemas from `packages/shared`. `class-validator`/`class-transformer` were removed; don't reintroduce them.
- **Database**: Drizzle ORM against Postgres/pgvector, schema `app` (see `database/schema/`). `DatabaseModule` is `@Global()` and exports `DRIZZLE_CLIENT` and `PG_POOL` injection tokens. Migrations are generated files under `database/migrations/`, committed to git — never edited by hand, never applied via `drizzle-kit push`.
- **Seeding**: `database/seed.ts` is transactional and idempotent (`ON CONFLICT DO NOTHING` on natural keys like `sessions.code`, `references.name`). It's run via `tsx` (a devDependency), not compiled — this lets the entrypoint and `pnpm seed` execute it without a build step.
- **`modules/llm`**: contract only (`llm.port.ts`, `llm.types.ts`). No driver exists yet — see the LLM constraint above.

### `apps/web` — feature-first + shared

`features/<name>/{components,api,...}` per route family (`medico`, `paciente`); a feature never imports from another feature. Shared code lives under `shared/{layouts,lib,components}` and never imports from `features/`.

- **Data fetching**: TanStack Query. Each feature owns its own `api/useXxx.ts` hooks under `features/<name>/api/`. `shared/lib/apiClient.ts` wraps `fetch`, takes a Zod schema per call, and throws `ApiValidationError` if the response doesn't match — API responses are never trusted blindly on the client.
- **Styling**: Tailwind v4, CSS-first (`@theme` in `src/styles/index.css`) — there is **no** `tailwind.config.ts`, don't go looking for one. Design tokens are defined verbatim from `DESIGN.md` §2 in `src/styles/tokens.css`; shadcn/ui variables are remapped to those tokens rather than left at their (mismatched) defaults. `DESIGN.md` is the frozen visual contract — check it before changing any token, spacing, or copy string.

### `packages/shared` — Zod contracts, has a build step

Contracts (`Session`, `TranscriptTurn`, `Citation`, `PriorityPatient`, `Reference`, `IngestJob`, `SessionSummary`, `KbState`, ...) live in `packages/shared/src/contracts/*.contract.ts` and are re-exported from `src/index.ts`. **This package builds to `dist/` via `tsc` (CommonJS)** — `package.json`'s `main`/`types` point at `dist/`, not `src/`. This is not the original design: it started as a types-only, no-build package, and that broke the moment it needed to ship real runtime values (Zod schemas) instead of only erased `import type`s, because neither Node nor Vite can consume multi-file TypeScript source directly as a workspace-linked CommonJS/ESM package. Consequence: **after editing anything under `packages/shared/src`, run `pnpm --filter shared build` before `api` or `web` will see the change** — there's no watch mode wired up yet. Type-checking (`pnpm typecheck`) is unaffected by this and stays instant, since it resolves `@ts-sm/shared` via the `paths` mapping in `tsconfig.base.json` straight to source.

Both `apps/api` and `apps/web` declare `"@ts-sm/shared": "workspace:*"` as a real dependency (required for pnpm to symlink it into `node_modules` — a `paths`-only mapping is enough for the type-checker but not for anything that actually runs). `apps/web/vite.config.ts` additionally sets `optimizeDeps.include: ['@ts-sm/shared']` so esbuild pre-bundles it (Vite doesn't do CJS/ESM interop for workspace-linked packages by default).

### Data model

Zod contracts define the shape once; Drizzle tables mirror them under the `app` Postgres schema (`sessions`, `transcripts`, `priority_patients`, `references`, `ingest_jobs`, `kb_state`). Field names are English in both contracts and DB columns; string *values* (patient names, procedures, summaries) stay in Spanish, matching the seed data ported from the design prototype. `sessions.code` (e.g. `SES-4821`) is a human-facing display id, separate from the `uuid` primary key. `kbVersion` is threaded through `sessions` and `transcripts` (and mirrored in a `kb_state` singleton row) so every turn records which knowledge-base version it was answered against — this is the audit trail behind the "upload → answer changes → delete → reverts" R0.5 demo requirement, and it's why `who: 'system'` exists as a transcript-turn type (the visual divider for a knowledge update) even though the ingestion logic that triggers it lands in a later spec.

### Tooling notes

- ESLint 9+ flat config (`eslint.config.js`) uses `eslint-plugin-import-x`, not the original `eslint-plugin-import` — the latter is broken under this ESLint version (uses a removed internal API).
- `tsconfig.base.json` sets `moduleResolution: "Bundler"` and defines the `@ts-sm/shared` path alias consumed by every workspace's `tsconfig.json`.
- No husky/lint-staged/commitlint — deliberately skipped to avoid pre-commit friction during the sprint.
