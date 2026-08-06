# D0 — Miércoles 5 de agosto · ~2 horas

> **Objetivo del día:** que `docker compose up` levante los tres servicios y que el sistema de diseño quede congelado. Al terminar hoy, la compuerta #2 (correr en ≤15 min) está asegurada desde el día cero.

**Prerrequisito bloqueante:** [ ] **Registrarse en el reto.** Cierra el 7 de agosto. Es preinscripción sin penalidad. Si no se hace esto, nada más importa.

---

## Bloques

### Bloque 1 — Fundación del repo (25 min)

1. `git init` en `/Users/alejandro/Documents/ts-sm` + repo público en GitHub.
2. **`LICENSE` con Licencia MIT en la raíz** (regla R0.6 — hazlo primero y olvídalo).
3. `.gitignore` estricto:
   ```
   node_modules/  dist/  build/  .env  .env.local
   *.log  .DS_Store  coverage/
   models/  .cache/  data/uploads/
   ```
4. Monorepo con **pnpm workspaces**:
   ```
   pnpm-workspace.yaml   →  apps/*  ·  packages/*
   package.json          →  scripts raíz: dev, build, test, docker:up
   tsconfig.base.json    →  strict:true, paths de @ts-sm/shared
   ```
5. Commit inicial.

### Bloque 2 — Docker que arranca de verdad (35 min)

`docker-compose.yml` con tres servicios y healthchecks en los tres:

| Servicio | Imagen / build | Puerto | Notas |
|---|---|---|---|
| `db` | `pgvector/pgvector:pg16` | 5432 | `init.sql` crea `CREATE EXTENSION vector;` |
| `api` | build `apps/api` | 3000 | depende de `db` healthy |
| `web` | build `apps/web` | 5173 | depende de `api` healthy |

Archivos:
- `docker-compose.yml`
- `docker/db/init.sql` — extensión `vector` + schema base vacío
- `apps/api/Dockerfile` — multi-stage, node:22-alpine
- `apps/web/Dockerfile` — dev con Vite, HMR expuesto
- **`.env.example`** con TODAS las variables comentadas (ver anexo abajo)

> **Regla RA.3 desde ya:** cuando lleguen los modelos de embeddings (D3), se descargan en el `docker build`, nunca en runtime. Dejar el `RUN` preparado y comentado.

### Bloque 3 — Diseño congelado en código (30 min)

1. `apps/web` con **Vite + React 19 + TypeScript**.
2. Tailwind configurado con los tokens de `DESIGN.md` en `theme.extend` — **no** con los defaults.
3. Fuentes: Space Grotesk, DM Sans, JetBrains Mono. Por CDN hoy; **autohospedarlas antes de la entrega** (R0.3 no puede depender de red externa).
4. shadcn/ui instalado y **retematizado** con los tokens (mapear `--background`, `--foreground`, `--primary`, `--border`, `--ring`).
5. Verificación visual: el fondo debe verse `#1A1C1E`. Si se ve gris azulado, la retematización no se aplicó.

### Bloque 4 — Esqueleto de rutas (20 min)

1. `react-router` con dos rutas: `/medico` y `/paciente`. Redirección de `/` a `/medico`.
2. **Topbar** de ambas vistas, pixel-fiel al prototipo: marca de 34px, título display, subtítulo `--muted`, `switch-btn` pill a la derecha.
3. **Shell del médico:** grid `minmax(260px,1fr) minmax(0,2fr)` + sidenav con los 4 ítems y su numeración mono, con el primero activo.
4. **Stage del paciente:** contenedor centrado de 720px con la pantalla de pre-sesión.
5. `apps/api` con NestJS mínimo: módulo `health` que responde `GET /health → {status:'ok', db:'connected'}`.

### Bloque 5 — Cierre (10 min)

1. `README.md` embrionario con el quick start real (se completa en D5).
2. Commit + push.
3. Anotar en `plan/D1-jue-06-ago.md` cualquier fricción encontrada hoy.

---

## Alcance

**Dentro:** infraestructura, tokens, rutas vacías, topbar y shells, health check.

**Fuera (explícitamente, no caer en la tentación):**
- Cualquier lógica de negocio
- Tablas con datos, aunque sean mock
- Micrófono, STT, TTS
- Vector store, embeddings, ingesta
- La capa `LLMPort` (es D1)
- Diseño de la base de datos más allá de habilitar `vector`

---

## Criterios de aceptación

- [ ] `docker compose up` desde limpio levanta los tres servicios sin intervención manual
- [ ] `curl localhost:3000/health` → `{"status":"ok","db":"connected"}`
- [ ] `localhost:5173/medico` muestra topbar + sidenav de 4 ítems con la paleta correcta
- [ ] `localhost:5173/paciente` muestra topbar + pre-sesión centrada
- [ ] `docker compose exec db psql -U postgres -c "\dx"` lista la extensión `vector`
- [ ] `ls LICENSE` existe y dice MIT
- [ ] `git ls-files | grep -E "^\.env$|node_modules"` no devuelve nada
- [ ] El fondo renderizado es `#1A1C1E` (verificar con inspector, no a ojo)

---

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Se va el tiempo peleando con la config de Docker | Timebox de 35 min. Si a los 35 no arranca, `db` en Docker y `api`/`web` en local por hoy; se completa mañana |
| shadcn pisa los tokens con sus defaults | Verificar el fondo con el inspector antes de cerrar el bloque 3 |
| Tentación de empezar a construir features | El alcance "Fuera" de arriba es vinculante. Hoy solo andamiaje |

---

## Anexo — `.env.example` inicial

```bash
# ─── LLM (capa agnóstica) ───────────────────────────────
LLM_PROVIDER=mock            # mock | anthropic | openai | google | bedrock
LLM_MODEL=                   # se llena el 7 de agosto
LLM_API_KEY=
LLM_TEMPERATURE=0.2
LLM_MAX_TOKENS=2048
LLM_INPUT_COST_PER_1M=0
LLM_OUTPUT_COST_PER_1M=0

# ─── Voz ────────────────────────────────────────────────
STT_PROVIDER=deepgram        # deepgram | webspeech | local
DEEPGRAM_API_KEY=
TTS_PROVIDER=azure           # azure | elevenlabs | webspeech
AZURE_SPEECH_KEY=
AZURE_SPEECH_REGION=eastus
AZURE_TTS_VOICE=es-CO-SalomeNeural

# ─── Datos ──────────────────────────────────────────────
DATABASE_URL=postgresql://postgres:postgres@db:5432/tssm
EMBEDDING_MODEL=intfloat/multilingual-e5-large
RERANKER_MODEL=BAAI/bge-reranker-v2-m3

# ─── Delta Share (llega el 7 de agosto) ─────────────────
DELTA_SHARE_PROFILE_PATH=./config.share
KNOWLEDGE_LOCAL_DIR=./data/knowledge

# ─── Notificaciones ─────────────────────────────────────
RESEND_API_KEY=

# ─── App ────────────────────────────────────────────────
PORT=3000
VITE_API_URL=http://localhost:3000
```
