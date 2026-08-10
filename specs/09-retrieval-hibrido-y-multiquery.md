# SPEC 09 — Retrieval híbrido y reformulación de consulta

> **Estado:** Implementado
> **Depende de:** SPEC 02, SPEC 04, SPEC 07, SPEC 08
> **Fecha:** 2026-08-10
> **Objetivo:** Que el retrieval del RAG encuentre documentos relevantes que hoy pierde el corte puramente léxico, sumando una rama semántica sobre chunks pre-embebidos y, como respaldo cuando eso tampoco alcanza, variaciones de la pregunta generadas por el mismo LLM.

---

## Contexto — por qué existe este spec

SPEC 08 dejó anotado explícitamente: *"No: embeddings de los chunks recién subidos. La rama densa entera es SPEC 09; hacerlo a medias dejaría el corpus con unos chunks vectorizados y otros no."* Ese SPEC 09 nunca se escribió — la rama densa que sí llegó a implementarse (`CitationRelevanceService`, el backstop de escalada por embeddings) se armó ad-hoc y quedó documentada solo en `specs/problema-escalamiento-bloque5.md`, no en un spec propio. Este documento cierra ese hueco y, de paso, resuelve un bug real encontrado en QA manual.

Caso real: sesión `SES-4861` (Daniela Zuluaga). El médico subió un documento de texto plano ("Heridas generales") y, en la siguiente sesión de voz, la pregunta del paciente sobre cuidado de la herida nunca citó ese documento. Diagnóstico confirmado con SQL directo y con el propio `EmbeddingClient` del proyecto:

- El retrieval léxico (`ts_rank`) sí encontró candidatos (`citations=4` en el log), pero el filtro de relevancia semántica los rechazó todos (`relevantes=0`).
- Reproduciendo la consulta exacta: la similitud coseno contra el chunk correcto daba **0.70** (justo en el umbral) — el problema no era el umbral ni la formulación de la pregunta.
- El chunk correcto nunca llegó a competir en la etapa semántica porque el corte léxico (`ORDER BY ts_rank DESC LIMIT 4`) lo descartó antes: su `rank` (0.000108) perdía contra PDFs grandes de otros temas que repiten palabras genéricas ("recomendaciones", "cuidados", "paciente") muchas veces (rank 0.00028–0.00045).

Con 120 referencias activas y ~4170 chunks, este no es un caso aislado — es estructural: el único filtro con noción de significado (`CitationRelevanceService`) solo ve lo que el corte léxico decide dejarle pasar, y ese corte no sabe nada de significado.

Existe además un artefacto de arquitectura sin usar: `reference_chunks.embedding vector(768)` está en el esquema desde la migración `0002_careless_wither.sql`, pero ninguna fila lo tiene poblado — la etapa `Generando embeddings` del pipeline de ingesta hoy es solo un rótulo de progreso, no calcula nada.

---

## Alcance

**Dentro**

- `EmbeddingClient`: nuevo parámetro/método para pedir salida truncada a 768 dim (Gemini `outputDimensionality`), sin tocar el comportamiento default (3072) que ya usan `CitationRelevanceService` y `RedFlagDetectorService`.
- Ingesta: la etapa `Generando embeddings` (hoy solo un rótulo de progreso, no calcula nada) pasa a embeber cada chunk a 768 dim y guardarlo en `reference_chunks.embedding` (columna ya migrada, siempre `NULL`) — en la misma transacción de `createReferenceWithChunks`.
- Backfill: script manual (`pnpm --filter api run backfill-embeddings`, patrón `tsx` como `seed.ts`) que embebe los ~4170 chunks existentes sin `embedding`, con concurrencia acotada y backoff (mismo patrón que `kb-translate.ts`).
- `RetrievalService.search()`: suma una rama semántica — embebe la consulta a 768 dim, `ORDER BY embedding <=> query LIMIT SEMANTIC_TOP_K` contra chunks con `embedding IS NOT NULL` de referencias activas, se une (unión + dedupe por `chunkId`) con los candidatos léxicos (`ts_rank`) existentes. El pool combinado entra a `CitationRelevanceService.filterRelevant()` sin cambios en esa función ni en su umbral 0.70.
- Multi-query fallback en `ConversationService.handleUserMessage`: si tras la fusión híbrida + filtro de relevancia el resultado es 0 citas, se genera 1 llamada a `LlmPort` (mismo modelo aprobado, sin segundo proveedor) pidiendo 3 variaciones de la pregunta; cada variación corre la misma fusión híbrida; el pool total (original + 3 variaciones, deduplicado) pasa una sola vez más por el filtro de relevancia. Fail-open si la llamada al LLM falla.
- Respeta los fixes ya commiteados (saludo inicial excluido de la consulta de retrieval, retrieval saltado en despedidas) — no se tocan.
- Tests: `retrieval.service.spec.ts` (rama semántica + fusión), `embedding.client.spec.ts` (dimensión configurable), `conversation.service.spec.ts` (fallback multi-query, fail-open), test del script de backfill.

**Fuera**

- Índice ANN (`ivfflat`/`hnsw`) sobre `reference_chunks.embedding` — con ~4170 chunks, `<=>` sin índice alcanza. Se evalúa si el corpus crece mucho.
- Migrar la columna a `vector(3072)` — queda en 768, sin tocar el filtro final calibrado.
- Cambiar el umbral 0.70 de `CitationRelevanceService` o la normalización de `ts_rank` existente.
- Backfill automático en `docker compose up` — es manual, decisión explícita del médico/dev.
- Multi-query como comportamiento default en cada turno — solo fallback ante 0 resultados relevantes.
- Cachear o persistir variaciones de multi-query entre turnos.
- Cualquier cambio al pipeline de ingesta de tipo/traducción/chunking existente — solo se agrega el paso de embeber.

---

## Modelo de datos

**Sin migraciones nuevas** — `reference_chunks.embedding vector(768)` ya existe (migración `0002_careless_wither.sql`), aplicada, siempre `NULL` hoy. Este spec es quien por fin la llena.

**Cambios de interfaz (no de esquema):**

```ts
// apps/api/src/modules/embeddings/embedding.client.ts
interface EmbedOptions {
  outputDimensionality?: number; // sin especificar → 3072 (comportamiento actual, sin cambios)
}

embedOne(text: string, options?: EmbedOptions): Promise<number[]>
embedBatch(texts: string[], options?: EmbedOptions): Promise<number[][]>
```

Los call sites existentes (`CitationRelevanceService`, `RedFlagDetectorService`) no pasan `options` — siguen a 3072 dim, comportamiento idéntico al de hoy.

```ts
// apps/api/src/modules/knowledge/retrieval.service.ts
const DEFAULT_TOP_K = 4;        // léxico, sin cambios
const SEMANTIC_TOP_K = 6;       // nuevo — candidatos de la rama semántica antes de fusionar

// search() pasa de un solo SELECT a: candidatos léxicos (ts_rank, como hoy)
// + candidatos semánticos (embedding <=> queryVector768, chunks con embedding IS NOT NULL)
// → unión por chunkId, dedupe → ese pool (no más limit fijo) sigue a CitationRelevanceService
```

```ts
// apps/api/src/modules/conversation/conversation.prompt.ts
const MULTI_QUERY_REPHRASE_PROMPT = `...`; // instrucción para 3 variaciones
const QueryVariationsSchema = z.object({ variations: z.array(z.string()).length(3) });
// vía LlmPort.structured(), mismo patrón que EscalationSummarySchema
```

```bash
# apps/api/src/database/backfill-embeddings.ts — nuevo script, patrón tsx como seed.ts
pnpm --filter api run backfill-embeddings
```

---

## Plan de implementación

1. **`EmbeddingClient` acepta dimensión opcional.** `embedOne`/`embedBatch` reciben `options?: { outputDimensionality?: number }`, se pasa al body de la request a Gemini. Sin `options`, comportamiento idéntico a hoy (3072 dim) — `CitationRelevanceService` y `RedFlagDetectorService` no se tocan. Test: `embedding.client.spec.ts` verifica que el campo viaja en el body cuando se pasa, y que se omite cuando no.

2. **Ingesta llena `reference_chunks.embedding`.** En `knowledge.repository.ts` (`createReferenceWithChunks`), antes de insertar cada chunk se embebe su `text` a 768 dim (`EmbeddingClient.embedBatch(chunks, { outputDimensionality: 768 })`) y se guarda en la columna. La etapa `Generando embeddings` de `ingestion.service.ts` pasa de rótulo a trabajo real. Documentos ya existentes siguen con `embedding: NULL` — el sistema sigue funcional (retrieval aún no depende de esto). Fail-open: si el embedding de un chunk falla, se guarda igual sin `embedding`, la ingesta no se bloquea.

3. **Script de backfill.** `apps/api/src/database/backfill-embeddings.ts`, patrón `tsx` de `seed.ts`: recorre `reference_chunks` con `embedding IS NULL`, embebe en lotes con concurrencia acotada y backoff (mismo patrón que `kb-translate.ts`), hace `UPDATE`. Corrido manual: `pnpm --filter api run backfill-embeddings`. Idempotente (solo toca `NULL`).

4. **`RetrievalService.search()` — fusión híbrida.** Se agrega la rama semántica (`ORDER BY embedding <=> queryVector768 LIMIT SEMANTIC_TOP_K`, solo chunks con `embedding IS NOT NULL` de referencias activas) en paralelo a la léxica existente, unión + dedupe por `chunkId`, ese pool pasa a `CitationRelevanceService.filterRelevant()` sin cambios ahí. **Este es el paso que arregla el bug real** — verificable de inmediato reproduciendo el caso de Daniela. Test: `retrieval.service.spec.ts` cubre unión/dedupe y el caso "solo pasa por semántico, léxico no lo trae".

5. **Multi-query fallback en `ConversationService`.** Se extrae la lógica de "retrieval híbrido + filtro de relevancia" a un método privado reusable. `handleUserMessage`: si el resultado da 0 citas, llama `LlmPort.structured()` con `MULTI_QUERY_REPHRASE_PROMPT` (3 variaciones), corre el método privado por cada variación + la original, une y dedupea, un solo pase final por `CitationRelevanceService`. Fail-open si la llamada al LLM falla (log + sigue con lo que había). Test: `conversation.service.spec.ts` cubre el fallback disparando, el fail-open, y que con ≥1 cita relevante en el primer intento el fallback nunca se dispara (no gasta la llamada extra).

---

## Criterios de aceptación

- [x] `EmbeddingClient.embedOne`/`embedBatch` aceptan `outputDimensionality` opcional; sin pasarlo, el request a Gemini es idéntico al de hoy (sin el campo). — `embedding.client.spec.ts`.
- [x] Subir un documento nuevo deja su(s) chunk(s) con `embedding` no nulo en `reference_chunks`, a 768 dimensiones. — validado en navegador: doc `heridas-generales-spec09-qa` subido vía UI, `vector_dims(embedding)=768` confirmado en DB.
- [x] `pnpm --filter api run backfill-embeddings` corrido sobre la base actual deja `count(*) filter (where embedding is not null) = count(*)` en `reference_chunks`; corrido una segunda vez no reprocesa nada (0 llamadas a Gemini). — corrida real: 3767/3767 procesados, 0 fallidos, DB en 4171/4171; segunda corrida: "Chunks pendientes de embedding: 0".
- [x] Reproduciendo el caso real (procedimiento con sutura de herida, pregunta de cuidados, documento "Heridas generales" activo y con embedding) el chunk correcto aparece en `citations` de la respuesta — ya no depende de ganarle a PDFs grandes por `ts_rank`. — validado dos veces en navegador: doc de QA propio (score 0.77) y doc real del corpus `PLAN DE CUIDADO EN CASA...APENDICECTOMÍA.pdf` (2 chunks, score 0.83) citado por encima de PDFs de 90+ chunks sobre el mismo tema.
- [x] `RetrievalService.search()` nunca devuelve un `chunkId` duplicado aunque el mismo chunk entre por la rama léxica y la semántica. — `retrieval.service.spec.ts`.
- [x] Con al menos 1 cita relevante en el primer intento, `LlmPort` no recibe ninguna llamada de reformulación (el fallback no se activa). — `conversation.service.spec.ts` + validado en navegador (pregunta con cita relevante no disparó reformulación).
- [x] Con 0 citas relevantes en el primer intento, se generan exactamente 3 variaciones, se reintenta la fusión híbrida por cada una + la original, y el resultado final es la unión deduplicada pasada una sola vez por `CitationRelevanceService`. — `conversation.service.spec.ts` + validado en navegador (pregunta fuera de dominio: log real `citations=5 relevantes=0` → `multi-query fallback variations=3 pool=10 relevantes=0`).
- [x] Si `LlmPort.structured()` falla durante el fallback, la conversación sigue con las citas (o la ausencia de citas) que ya había — sin error visible al paciente. — `conversation.service.spec.ts`.
- [x] `CitationRelevanceService` y su umbral `0.70` no cambian de comportamiento para llamadas que no pasan `outputDimensionality` (test de regresión: mismo input, mismo score que antes de este spec). — `citation-relevance.service.spec.ts` sin modificar, sigue en verde.
- [x] `pnpm test`, `pnpm lint`, `pnpm typecheck` en verde. — 28 suites / 148 tests, 0 errores de lint, 0 errores de tipo.

---

## Decisiones tomadas y descartadas

**Tomadas**

- **Fusión híbrida como estrategia principal**, no solo subir `TOP_K` ni ajustar la normalización de `ts_rank`. Es la única determinística: ataca la causa (el corte léxico no tiene noción de significado) en vez de darle más margen a la misma apuesta.
- **Multi-query solo como fallback**, no como reemplazo de la fusión híbrida. En el caso real medido, la similitud semántica con la pregunta tal cual ya daba 0.70 — el problema no era la formulación, era el corte léxico. Multi-query se gana su costo solo cuando ni la fusión híbrida encuentra nada.
- **Multi-query se dispara solo con 0 citas relevantes**, no en cada turno — ahorra latencia y costo en la mayoría de los casos, que ya funcionan bien.
- **3 variaciones + la original** — diversidad suficiente sin disparar llamadas a embeddings.
- **Unión + dedupe + un solo filtro de relevancia final**, no un filtro por variación — menos llamadas a embeddings, mismo criterio de corte para todo el pool.
- **Fail-open en multi-query** — consistente con `CitationRelevanceService` y `RedFlagDetectorService`, que ya son fail-open. Un fallo de red no debe cortar la conversación.
- **768 dim solo para la rama semántica nueva**, reaprovechando `vector(768)` ya migrada — evita tocar el esquema y no re-calibra el umbral 0.70 del filtro final, que sigue a 3072 dim sin cambios.
- **Backfill manual**, no automático en el entrypoint — 4170 llamadas a Gemini no deberían dispararse solas en cada `docker compose up`.
- **Sin índice ANN** (`ivfflat`/`hnsw`) — con ~4170 chunks, coseno sin índice alcanza. Se evalúa después si el corpus crece mucho.
- **El umbral 0.70 y la normalización de `ts_rank` existentes no se tocan** — el problema nunca fue el umbral, fue que el chunk correcto no llegaba a que se lo midiera.

**Descartadas**

- **Migrar `embedding` a `vector(3072)`** — se prefirió mantener lo que ya existía en vez de duplicar precisión sin evidencia de que hiciera falta.
- **Multi-query como comportamiento default en cada turno** — costo/latencia de un round-trip extra al LLM en turnos que no lo necesitan.
- **Filtrar relevancia por separado en cada variación de multi-query** — multiplica llamadas a embeddings sin necesidad frente a un solo pase sobre el pool unido.
- **Reemplazar el retrieval léxico por completo con solo la rama semántica** — el léxico sigue aportando precisión en coincidencias exactas (nombres de fármacos, siglas) que el embedding puede diluir; se mantienen ambas ramas.

---

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Backfill de ~4170 chunks tarda / gasta cuota de Gemini de golpe | Script manual con concurrencia acotada y backoff (patrón `kb-translate.ts`); se corre una vez, fuera de horario de demo si hace falta. |
| Truncar a 768 dim pierde precisión frente a 3072 | Solo afecta la rama semántica nueva (prefiltro); el filtro final de relevancia sigue a 3072 dim exactamente como hoy — la pérdida de precisión nunca decide qué cita se muestra, solo qué candidatos entran a competir. |
| Multi-query agrega latencia visible al paciente cuando se dispara | Solo se dispara con 0 citas relevantes (turno ya "raro" de por sí); fail-open si tarda o falla. |
| Unión léxico+semántico duplica candidatos y satura `CitationRelevanceService` (más llamadas a embeddings por turno) | Dedupe por `chunkId` antes del filtro; `SEMANTIC_TOP_K` acotado (6) igual que el léxico. |
| Ingesta de documentos nuevos ahora depende de `GEMINI_API_KEY` disponible en el paso de embeber | Mismo fail-open que ya usa `CitationRelevanceService`: si el embedding falla, el chunk se guarda igual (sin `embedding`), la ingesta no se bloquea — solo ese chunk no participa de la rama semántica hasta el próximo backfill. |
