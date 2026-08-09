# Plan 01 — RAG clínico con citas trazables

> **Cuándo:** hoy, sábado 8 · **Presupuesto:** 2 horas
> **Cierra:** los 20 pts de *RAG, precisión clínica y conocimiento vivo* · habilita G5 (que se cierra en el plan 02)
> **Depende de:** SPEC 02 (contratos y tablas), SPEC 05 (gateway de conversación)

## Objetivo en una frase

Que cada respuesta clínica del agente se construya sobre fragmentos recuperados del corpus real y quede rastreable hasta el documento que la sustenta, usando búsqueda de texto completo en español de Postgres.

> **Diagrama del pipeline completo** (ingesta, consulta y dónde entraría la API de embeddings):
> https://claude.ai/code/artifact/7c5fe42c-9886-480d-9fd6-33dc4745b763

## Alcance

**Dentro:**

- Tabla `reference_chunks` con `tsvector` en español e índice GIN. **Se deja preparada la columna vectorial** (nullable) para que la fase 2 sea aditiva.
- Servicio de retrieval: consulta → top-K chunks con score.
- **Enriquecimiento de la consulta**: buscar con la última pregunta del agente + la respuesta del paciente, no solo con la del paciente. Costo cero, ambos textos ya están en memoria.
- Inyección del contexto recuperado al `SYSTEM_PROMPT` de la conversación.
- Persistencia de `Citation[]` en cada turno del asistente.
- Comando de ingesta desde carpeta local (`pnpm kb:ingest`) que extrae texto de PDF/MD/TXT, fragmenta y llena `references` + `reference_chunks`.
- Seed SQL con el corpus ya procesado, para que el arranque del jurado no ejecute el pipeline.
- Honestidad ante el vacío: si el retrieval no trae nada relevante, el agente lo declara y redirige al médico en vez de improvisar.

**Fuera:**

- **La rama vectorial del score** → fase 2, domingo, solo si G5 y triage cerraron. Este plan deja el terreno listo: la columna existe y el servicio de retrieval se escribe con el score como una función aislada, para que sumarle el término denso sea una línea.
- Subir/eliminar documentos desde la consola → **plan 02**.
- Mostrar las citas en la UI del médico → **plan 02** (el dato ya se persiste aquí).
- Reranking y reformulación de consulta con el LLM.

## Decisiones ya cerradas — no reabrir en Fase 2

- **Retrieval:** `to_tsvector('spanish', ...)` + `ts_rank`, índice GIN. Verificado hoy contra nuestra instancia: `pg_ts_config` trae `spanish`, y `plainto_tsquery('spanish','dolor fiebre')` hace match sobre texto clínico.
- **El chunking se porta de `invoice-system`.** `chunk_by_paragraphs` (dividir por `\n\n` sin cortar párrafos, con techo de caracteres) ya está escrito y probado en Python; son ~30 líneas a TypeScript. Mismo criterio para los loaders por extensión.
- **La columna vectorial se crea ahora, vacía.** `embedding vector(768) NULL`. Cuesta nada hoy y convierte la fase 2 en un `UPDATE` más un término en el score, en vez de una migración con datos en producción.
- **El score vive en una función aislada** desde el primer commit, para que sumarle el término denso sea una línea y no una refactorización.
- **La tabla `references` ya existe con `body`, `active`, `version`, `chunks`.** Este plan la **llena** y por fin usa la columna `chunks` (hasta hoy fija en `0`).
- **El contrato `Citation` ya existe** en `packages/shared/src/contracts/session.contract.ts` con exactamente los campos que hacen falta: `docId`, `docName`, `chunkId`, `version`, `score`, `snippet`. **No se toca.**
- **`transcripts.citations` (jsonb) ya existe** y hoy se persiste como `[]` en `conversation.service.ts`. Este plan es quien lo llena de verdad.
- **Chunking:** por párrafos, con un techo de caracteres y solape pequeño. Sin tokenizador — no hace falta precisión de tokens para FTS.
- **Top-K:** 4 chunks. Suficiente contexto sin inflar el prompt (importa: cada token de entrada se reporta en las métricas de la rúbrica).
- **El filtro por `active = true` es obligatorio en el retrieval.** Es lo que hace que "eliminar un documento" en el plan 02 sea instantáneo y real, sin reindexar nada.
- **El `kbVersion` del turno se toma de `kb_state`** al momento de responder — ya está cableado así en `sessions.service.ts`.

## Dónde está el corpus

**`dataset-reto/` en la raíz del repositorio**, ya clonado desde `github.com/TechSphere2026/ParticipantArtifacts` y **añadido a `.gitignore`** (verificado: no aparece en `git status`).

```
dataset-reto/
  dataset/
    textos/                    ← el corpus del RAG: 107 PDF, 127 MB, 5 carpetas
      Appendicitis/
      cholecystitis/
      colorectal cancer/       ← ojo: espacio en el nombre
      breast_cancer/           ← contiene sobre todo cáncer de cuello uterino
      total joint replacement/ ← ojo: espacios
    dataset_final.xlsx         ← 3.991 turnos de conversación
    trayectorias_postop_silver.xlsx
    perfiles_clinicos_pacientes_silver_contest.xlsx
    perfiles_pacientes_co.xlsx
  docs/                        ← rúbrica y stack técnico oficiales
```

**Por qué no se commitea:** los PDFs *"conservan sus propios derechos"* (README del kit) y nuestro repositorio es público MIT. Además, 127 MB atacan directamente los 15 minutos de G2.

**Cómo lo recupera otra máquina** (o nosotros si se borra): un script `pnpm dataset:fetch` que haga `git clone --depth 1` del repo del reto a `dataset-reto/`. Documentarlo en el README — es lo que hace reproducible la ingesta sin redistribuir los PDFs.

`KNOWLEDGE_LOCAL_DIR` apunta a `dataset-reto/dataset/textos` por defecto, y va a `.env.example`.

## Modelo de datos — lo único nuevo

```
app.reference_chunks
  id           uuid  PK
  reference_id uuid  FK → references(id) ON DELETE CASCADE
  seq          int         -- orden dentro del documento
  text         text        -- el fragmento
  tsv          tsvector    -- generado: to_tsvector('spanish', text)
  embedding    vector(768) NULL   -- vacía hoy; la llena la fase 2
  índice GIN sobre tsv
```

Una migración generada con `pnpm --filter api db:generate`. La columna `tsv`, el índice GIN y el tipo `vector` necesitan SQL a mano dentro del archivo de migración generado — Drizzle no modela columnas generadas de `tsvector` ni el tipo de pgvector de forma directa. La extensión se habilita con `CREATE EXTENSION IF NOT EXISTS vector` (la imagen `pgvector/pgvector:pg16` ya la trae).

El índice vectorial (HNSW/IVFFlat) **no se crea hoy** — sin datos no sirve de nada y se añade en la fase 2.

## Plan de implementación

1. **Schema + migración.** `database/schema/reference-chunks.ts`, exportado desde `schema/index.ts`. Generar migración y añadir a mano la columna `tsvector` generada y el índice GIN.
2. **Script de ingesta.** `apps/api/src/database/kb-ingest.ts`, ejecutado con `tsx` igual que `seed.ts` (mismo patrón, ya probado). Lee `KNOWLEDGE_LOCAL_DIR`, extrae texto (PDF vía una librería nueva; MD/TXT/JSON directo), fragmenta, escribe `references` + `reference_chunks`, actualiza `references.chunks`. Idempotente por `references.name`, como el seed actual.
   - Detectar extracción vacía (hay un PDF escaneado sin capa de texto en `Appendicitis/`) y **registrarlo sin fallar**.
   - Script `"kb:ingest"` en `apps/api/package.json`.
3. **Servicio de retrieval.** `modules/knowledge/retrieval.service.ts`: `search(query, k=4): Promise<Citation[]>` con `plainto_tsquery('spanish', ...)`, `ts_rank`, `JOIN references` filtrando `active = true`. Devuelve directamente el contrato `Citation` — sin tipo intermedio. El cálculo del score queda en una función propia, aislada, para que la fase 2 le sume el término denso sin tocar el resto.
4. **Cableado en la conversación.** En `conversation.service.ts`, antes de armar los mensajes: recuperar con la **consulta enriquecida** (última pregunta del asistente + texto del paciente), inyectar los fragmentos en un bloque de contexto dentro del mensaje `system`, y pasar las `Citation[]` a `addTurn` del turno del asistente.
   - Ajustar `SYSTEM_PROMPT` en `conversation.prompt.ts` con la instrucción de fundamentar en el contexto y declarar el límite cuando no hay material — esto es lo que la rúbrica observa como *"declara el límite y redirige, o improvisa"*.
5. **Seed del corpus procesado.** Volcar `references` + `reference_chunks` a un `.sql` que el entrypoint cargue, para que `docker compose up` llegue con el corpus listo sin correr el pipeline.
6. **Tests.** `retrieval.service.spec.ts` con el cliente Drizzle mockeado; extender `conversation.service.spec.ts` para verificar que las citas llegan a `addTurn`.

Cada paso deja el sistema corriendo y commitable.

## Criterios de aceptación

- [ ] `pnpm kb:ingest` procesa la carpeta local y reporta documentos ingeridos, chunks creados y archivos sin texto extraíble.
- [ ] `references.chunks` deja de ser `0` para los documentos ingeridos.
- [ ] Una pregunta clínica sobre un procedimiento del corpus (ej. cuidados tras colecistectomía) produce una respuesta cuyo contenido corresponde a un documento real del corpus.
- [ ] El turno del asistente queda persistido con `citations` no vacío, y cada cita trae `docName`, `chunkId`, `score` y `snippet`.
- [ ] El `snippet` de la cita **existe textualmente** en el documento citado — se verifica abriendo el documento.
- [ ] Una pregunta fuera del corpus (ej. algo no clínico) obtiene una respuesta que declara el límite y redirige al médico, sin inventar contenido clínico.
- [ ] Marcar un `reference` como `active = false` en la base hace que deje de aparecer en las citas, sin reindexar ni reiniciar.
- [ ] La consulta enviada al retrieval **incluye la última pregunta del asistente**, no solo el texto del paciente — verificable en el log.
- [ ] La columna `embedding vector(768)` existe y está vacía, sin romper nada.
- [ ] `pnpm lint`, `pnpm typecheck` y `pnpm test` en verde.
- [ ] `docker compose up` desde limpio arranca con el corpus ya cargado, sin correr la ingesta.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| La extracción de PDF se come el presupuesto de 2 h | Empezar por MD/TXT y los PDFs que extraigan limpio. Si la librería da guerra, ingerir un subconjunto menor — 10 documentos buenos demuestran el RAG igual que 30. |
| El contexto inyectado infla los tokens de entrada y encarece cada turno | Top-K 4 y techo de caracteres por chunk. Las métricas del plan 04 lo van a exponer, así que conviene medirlo desde ya. |
| El seed SQL del corpus queda pesado para el repositorio | Ingerir menos documentos. El objetivo es demostrar el mecanismo, no la cobertura. |
| `ts_rank` devuelve resultados pobres en preguntas coloquiales del paciente | **Primero, el enriquecimiento de la consulta** (paso 4): la pregunta del agente aporta los términos clínicos que el paciente no usa, y eso es gratis. Lo que quede es la razón concreta para la fase 2 de embeddings — material para la Pregunta 2 del video. |
