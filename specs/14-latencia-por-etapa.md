# SPEC 14 — Latencia por etapa en las métricas de turno

> **Estado:** Aprobado
> **Depende de:** SPEC 09, SPEC 13
> **Fecha:** 2026-08-12
> **Objetivo:** Que `GET /metrics` desglose los milisegundos de cada turno por etapa externa (RAG, embeddings, LLM, STT, TTS), para poder afirmar con datos cuánto cuesta cada tramo del camino crítico en vez de leer solo el total.

---

## Contexto — por qué existe este spec

El plan `plan/nuevos-enfoques/05-embeddings-fase-2.md` ("Embeddings: la mitad densa de la búsqueda híbrida") quedó cumplido casi entero por SPEC 09, que implementó el cliente de embeddings, el llenado de `reference_chunks.embedding`, el backfill, la fusión híbrida y la degradación a solo-léxico sin `GEMINI_API_KEY`. De sus criterios de aceptación quedó uno abierto:

> - [ ] La latencia añadida por turno queda medida (entra en las métricas del plan 04).

SPEC 13 mide `responseLatencyMs` (turno completo) y `endOfSpeechLatencyMs` (fin de habla → primer audio), pero no reparte ese total entre etapas. Hoy un turno de 4 s no dice si se fue en el LLM, en los cuatro `search()` que dispara un fallback multi-query, o en las llamadas a Gemini que hace `CitationRelevanceService` para filtrar relevancia. Los contadores existen (`ragQueries`, `embeddingCalls`, `llmCalls`, `sttCalls`, `ttsCalls`) — el tiempo que consumen, no.

Sin ese reparto no se puede tomar la decisión que el propio plan 05 anotó como mitigación de riesgo:

> El round-trip añade latencia visible al turno → *Se mide. Si pesa, la rama densa se usa solo cuando la léxica trae poco.*

"Si pesa" no es evaluable hoy. Este spec produce el dato que lo hace evaluable.

Hay además una asimetría que abarata el trabajo: **tres de las cinco etapas ya calculan su duración y simplemente no la propagan al turno.** `LlmMetricsService.recordCall()` recibe `input.latencyMs`; `VoiceMetricsService.recordStt()`/`recordTts()` reciben `input.durationMs`. Solo RAG y embeddings necesitan medición nueva.

Los otros dos pendientes del plan 05 quedan **descartados**, no diferidos — ver "Decisiones tomadas y descartadas".

---

## Alcance

**Dentro**

- `TurnMetricsService`: nuevo método único `addStageMs(stage, ms)` con `TurnStage = 'rag' | 'embedding' | 'llm' | 'stt' | 'tts'`. Acumula milisegundos por etapa dentro del `TurnScope` (AsyncLocalStorage) ya existente. Mismo contrato defensivo que el resto: retorna temprano sin turno activo, nunca lanza, nunca hace I/O.
- `TurnMetric`: nuevo campo `stageMs: { rag, embedding, llm, stt, tts }` — milisegundos acumulados del turno. Un turno con multi-query (4 `search()`) reporta la suma de los cuatro en `rag`, no cuatro entradas.
- `SessionMetrics` y `TurnMetricsSnapshot.overall`: `stageLatency` con `LatencyStats` (`count`/`p50Ms`/`p95Ms`/`minMs`/`maxMs`) por cada una de las cinco etapas, reusando `latencyStats()` y la ventana `LATENCY_WINDOW_SIZE` ya existentes.
- Instrumentación en los cinco call sites, **sin cambiar ninguna firma pública**:
  - `RetrievalService.search()` — mide el método completo (rama léxica + rama semántica en paralelo, incluido el `embedOne` de la consulta).
  - `EmbeddingClient.embedOne()` — mide el `fetch` a Gemini. Cubre todas las llamadas del turno: retrieval semántico, `CitationRelevanceService` y `RedFlagDetectorService`.
  - `LlmMetricsService.recordCall()` — propaga el `input.latencyMs` que ya recibe.
  - `VoiceMetricsService.recordStt()` / `recordTts()` — propagan el `input.durationMs` que ya reciben.
- Tests: `turn-metrics.spec.ts` (acumulación por etapa, agregación de stats, no-op sin turno activo, rechazo de valores no finitos/negativos), y en cada spec de call site que la etapa se registre con la duración esperada.
- README, sección Métricas: documenta las cinco etapas, aclara explícitamente que **se solapan y no suman al total**, y pega el JSON de una corrida real nueva.

**Fuera**

- Persistencia de las métricas — sigue en memoria, muere con el proceso, igual que SPEC 13.
- Spans individuales por llamada dentro del turno — solo acumulado por etapa. El promedio por llamada sale dividiendo por los contadores que ya existen (`ragQueries`, `embeddingCalls`, `llmCalls`).
- Separar la latencia de la rama densa de la léxica dentro de `search()` — corren en `Promise.all`, el reparto sería ficticio. La etapa `embedding` da la señal que importa.
- Tracing distribuido (OpenTelemetry, spans anidados, exportadores).
- Cualquier decisión de arquitectura tomada *a partir* de lo medido (desactivar la rama densa, condicionarla al resultado léxico, cachear embeddings de consulta). Este spec produce el dato; actuar sobre él es otro spec.
- Índice HNSW sobre `reference_chunks.embedding` y fórmula de score con `α` — los otros dos pendientes del plan 05, descartados abajo.
- Cambios a `GET /llm/metrics` y `GET /voice/metrics`, que ya reportan su propia latencia por llamada.
- Exponer las etapas en la UI del médico — `GET /metrics` es JSON, se lee con `curl`.

---

## Modelo de datos

**Sin migraciones.** Nada de esto toca Postgres — las métricas viven en memoria en `TurnMetricsService`, igual que en SPEC 13. Tampoco toca `packages/shared`: el snapshot de `/metrics` se tipa en `apps/api` (`MetricsSnapshot` en `metrics.controller.ts`) y no tiene consumidor en `apps/web`.

Todos los cambios son de interfaz, en `apps/api/src/modules/metrics/turn-metrics.ts`:

```ts
export type TurnStage = 'rag' | 'embedding' | 'llm' | 'stt' | 'tts';

/** Milisegundos acumulados por etapa dentro de un turno. Las etapas se solapan:
 *  `rag` incluye el embedOne de la consulta, que también cuenta en `embedding`.
 *  Su suma NO es responseLatencyMs. */
export interface StageMs {
  rag: number;
  embedding: number;
  llm: number;
  stt: number;
  tts: number;
}

const STAGES: TurnStage[] = ['rag', 'embedding', 'llm', 'stt', 'tts'];
const emptyStageMs = (): StageMs => ({ rag: 0, embedding: 0, llm: 0, stt: 0, tts: 0 });

interface TurnScope {
  // ...campos existentes, sin cambios...
  stageMs: StageMs;                 // nuevo, inicializado en emptyScope()
}

export interface TurnMetric {
  // ...campos existentes, sin cambios...
  stageMs: StageMs;                 // nuevo, copia inmutable al cerrar el turno
}

export type StageLatencyStats = Record<TurnStage, LatencyStats>;

export interface SessionMetrics {
  // ...campos existentes, sin cambios...
  stageLatency: StageLatencyStats;  // nuevo
}

export interface TurnMetricsSnapshot {
  observedTurns: number;
  overall: {
    // ...campos existentes, sin cambios...
    stageLatency: StageLatencyStats; // nuevo
  };
  bySession: SessionMetrics[];
  recentTurns: TurnMetric[];
}

interface SessionAgg {
  // ...campos existentes, sin cambios...
  stageLatencies: Record<TurnStage, number[]>;  // ventanas por etapa, LATENCY_WINDOW_SIZE
}
```

**Método nuevo, único punto de entrada:**

```ts
/** Suma `ms` a la etapa del turno en vuelo. No-op sin turno activo. No lanza. */
addStageMs(stage: TurnStage, ms: number): void {
  const scope = this.als.getStore();
  if (!scope) return;
  if (!Number.isFinite(ms) || ms < 0) return;   // una medición corrupta no envenena el p95
  scope.stageMs[stage] += ms;
}
```

**Criterio de agregación** (difiere a propósito del que ya existe para `responseLatency`):

- `responseLatency` solo se acumula en las ventanas `if (spoke)`. Las etapas **se acumulan siempre**, hablara o no el asistente — un turno de texto sin voz igual gastó RAG, embeddings y LLM, y descartarlo sesgaría los percentiles.
- Un turno que no usó una etapa (`stt: 0` en un turno de texto) **no entra a la ventana de esa etapa**: se empuja solo `if (ms > 0)`, para que el p50 de `stt` signifique "cuánto tarda el STT cuando ocurre" y no quede aplastado por ceros. `count` en `LatencyStats` deja visible cuántos turnos ejercieron cada etapa.

**Forma del JSON resultante en `GET /metrics`** (valores ilustrativos):

```json
{
  "overall": {
    "responseLatency": { "count": 12, "p50Ms": 3120, "p95Ms": 4880, "minMs": 2400, "maxMs": 5100 },
    "stageLatency": {
      "rag":       { "count": 12, "p50Ms": 380,  "p95Ms": 1240, "minMs": 210,  "maxMs": 1310 },
      "embedding": { "count": 12, "p50Ms": 290,  "p95Ms": 950,  "minMs": 180,  "maxMs": 1020 },
      "llm":       { "count": 12, "p50Ms": 2210, "p95Ms": 3400, "minMs": 1800, "maxMs": 3520 },
      "stt":       { "count": 0,  "p50Ms": null, "p95Ms": null, "minMs": null, "maxMs": null },
      "tts":       { "count": 11, "p50Ms": 640,  "p95Ms": 810,  "minMs": 520,  "maxMs": 830 }
    }
  },
  "recentTurns": [
    {
      "responseLatencyMs": 3480,
      "stageMs": { "rag": 412, "embedding": 305, "llm": 2260, "stt": 0, "tts": 690 }
    }
  ]
}
```

---

## Plan de implementación

1. **`TurnMetricsService` acumula etapas.** Se agregan `TurnStage`, `StageMs`, `emptyStageMs()`, el campo `stageMs` en `TurnScope` (inicializado en `emptyScope()`) y en `TurnMetric` (copia en `closeTurn()`), y el método `addStageMs()` con sus guardas. Todavía nadie lo llama: el snapshot ya expone `stageMs` en `recentTurns`, en ceros. Sistema funcional, `/metrics` sigue respondiendo. Test: `turn-metrics.spec.ts` cubre acumulación, suma de varias llamadas a la misma etapa, no-op sin turno activo, y descarte de `NaN`/`Infinity`/negativos.

2. **Agregación por etapa en `overall` y `bySession`.** Ventanas `stageLatencies: Record<TurnStage, number[]>` en `SessionAgg` y en los campos overall del servicio, empujadas en `closeTurn()`/`recordSession()` con el criterio `if (ms > 0)`; `getSnapshot()` y `toSessionMetrics()` mapean cada ventana con `latencyStats()`. Con todo en ceros, cada etapa reporta `count: 0` y percentiles `null` — que es exactamente lo que `latencyStats([])` ya devuelve. Test: `turn-metrics.spec.ts` verifica p50/p95 por etapa sobre valores conocidos, y que una etapa nunca ejercida queda en `count: 0`.

3. **Etapas ya medidas: `llm`, `stt`, `tts`.** Tres líneas, ninguna medición nueva:
   - `LlmMetricsService.recordCall()` — dentro del mismo `try` defensivo que ya envuelve `addLlmCall()`, añade `this.turnMetrics?.addStageMs('llm', input.latencyMs)`.
   - `VoiceMetricsService.recordStt()` / `recordTts()` — dentro de `recordTurnCall()`, que ya es el envoltorio defensivo, añade `addStageMs('stt' | 'tts', input.durationMs)`.

   Test: los specs de esos call sites verifican que la etapa recibe la duración que ya reportaban a su propio snapshot.

4. **Etapa `embedding`.** En `EmbeddingClient.embedOne()`, se toma `Date.now()` antes del `fetch` y se registra la etapa en un `finally`, de modo que **una llamada fallida a Gemini también aporta su tiempo** — un timeout de 5 s es justamente la latencia que interesa medir. El registro va envuelto en el mismo `try/catch` con `logger.debug` que ya usa el contador. Test: `embedding.client.spec.ts` cubre camino feliz y camino de error.

5. **Etapa `rag`.** En `RetrievalService.search()`, se toma `Date.now()` al inicio (junto al `addRagQuery()` existente) y se registra en un `finally` que envuelve todo el método — incluye ambas ramas y el `embedOne` de la consulta. Con multi-query, las cuatro invocaciones suman sobre el mismo turno sin trabajo extra, que es el comportamiento buscado. Test: `retrieval.service.spec.ts` verifica que la etapa se registra una vez por invocación y que la suma de varias invocaciones aparece en el turno.

6. **Corrida real y README.** `docker compose up --build`, crear sesión, conducir una conversación de varios turnos que ejercite RAG con y sin multi-query, leer `GET /metrics`. Se actualiza la sección **Métricas** del README: tabla de las cinco etapas con su significado, la advertencia de solapamiento (`rag` ⊃ parte de `embedding`; las etapas corren en paralelo y **su suma no es `responseLatencyMs`**), el JSON crudo de la corrida en el `<details>` existente, y la lectura en una frase — cuánto del turno se va en el LLM frente a la rama densa. Se anota si la corrida ejerció o no `stt`/`tts`, con la misma honestidad con la que SPEC 13 anotó que no ejerció `endOfSpeechLatencyMs`.

---

## Criterios de aceptación

- [ ] `TurnMetricsService.addStageMs('rag', 120)` fuera de un turno activo no lanza y no altera el snapshot.
- [ ] `addStageMs` con `NaN`, `Infinity` o un valor negativo deja la etapa sin cambios.
- [ ] Dos llamadas `addStageMs('embedding', 100)` y `addStageMs('embedding', 50)` en el mismo turno producen `stageMs.embedding === 150` en el `TurnMetric` cerrado.
- [ ] `GET /metrics` devuelve `overall.stageLatency` y `bySession[].stageLatency` con las cinco etapas, cada una con la forma `LatencyStats` (`count`, `p50Ms`, `p95Ms`, `minMs`, `maxMs`).
- [ ] Una etapa nunca ejercida reporta `count: 0` y percentiles `null`, no `0`.
- [ ] Un turno que no usó una etapa no empuja un `0` a la ventana de esa etapa: tras un turno solo-texto, `stageLatency.stt.count` no aumenta.
- [ ] Las etapas se acumulan también en turnos con `spoke === false` (a diferencia de `responseLatency`).
- [ ] Una llamada al LLM registrada con `latencyMs: 2200` deja `stageMs.llm === 2200` en el turno.
- [ ] Un `embedOne()` que falla (Gemini responde 500) igual aporta su duración a `stageMs.embedding`.
- [ ] Un turno con fallback multi-query (4 invocaciones de `search()`) reporta en `stageMs.rag` la suma de las cuatro, y `ragQueries === 4`.
- [ ] Un fallo dentro de la instrumentación de cualquiera de los cinco call sites no altera el resultado funcional de ese call site (retrieval devuelve sus citas, el LLM su respuesta, la voz su audio).
- [ ] La sección Métricas del README documenta las cinco etapas y dice explícitamente que **se solapan y su suma no es `responseLatencyMs`**.
- [ ] El README incluye el JSON crudo de una corrida real nueva con `stageLatency` poblado, y una frase con la lectura (qué proporción del turno se va en cada etapa).
- [ ] `pnpm lint`, `pnpm typecheck` y `pnpm test` en verde.

---

## Decisiones tomadas y descartadas

**Tomadas**

- **Un solo método `addStageMs(stage, ms)`** en vez de ampliar las firmas de `addLlmCall`/`addSttCall`/`addTtsCall`/`addEmbeddingCall`/`addRagQuery`. Deja los contadores intactos, evita tocar cinco firmas y sus tests, y hace trivial añadir una sexta etapa después.
- **Acumulado por etapa, no spans por llamada.** El promedio por llamada sale dividiendo por los contadores que ya existen. Spans individuales serían el germen de un tracer a medias, y el tracer real (OpenTelemetry) no cabe en el presupuesto del reto.
- **`rag` y `embedding` se solapan a propósito, y se documenta.** `search()` incluye el `embedOne` de la consulta, así que esos ms cuentan en las dos etapas. Restarlos daría un número más "limpio" pero mentiroso, porque `embedding` también incluye llamadas fuera de `search()` (`CitationRelevanceService`, `RedFlagDetectorService`). Se prefiere un dato honesto con una nota a un dato aparentemente aditivo que no lo es.
- **Los ceros no entran a la ventana de percentiles.** El p50 de `tts` debe responder "cuánto tarda el TTS cuando ocurre", no diluirse con turnos de texto. `count` deja visible cuántos turnos ejercieron cada etapa.
- **Las etapas se acumulan aunque el turno no hable**, a diferencia de `responseLatency` (que filtra por `spoke`). Un turno de texto consumió LLM y RAG igual; excluirlo sesgaría el reparto justo en los turnos que más se ejercitan en pruebas.
- **La duración se registra en `finally`, incluidos los caminos de error.** Un embedding que revienta tras 5 s de timeout es precisamente la latencia que este spec existe para exponer; descartarla haría que la métrica se viera mejor cuanto peor se comportara la red.
- **Instrumentación siempre en un `try/catch` con `logger.debug`**, igual que todo lo de SPEC 13 — la instrumentación no puede tumbar el turno del paciente.
- **Sin cambios en `packages/shared`.** El snapshot no tiene consumidor en `apps/web`; agregarlo al contrato compartido obligaría a `pnpm --filter shared build` y a la danza del caché de Vite en Docker, sin ganar nada.

**Descartadas**

- **Índice HNSW sobre `reference_chunks.embedding`** (paso 4 del plan 05). Con ~4171 chunks, el `<=>` exhaustivo tarda milisegundos; el índice no compra latencia observable, solo la posibilidad de nombrarlo en el video. SPEC 09 ya lo había descartado con el mismo argumento. Si el corpus crece un orden de magnitud, se reabre — y ahora, con este spec, se reabriría **con la medición previa en la mano**.
- **Fórmula de score `α * (1 - dist) + (1-α) * ts_rank`** (paso 5 del plan 05). Revertiría la decisión de SPEC 09 (unión + dedupe de dos ramas top-k, corte fino delegado a `CitationRelevanceService` con umbral 0.70 ya calibrado y validado en QA con casos reales) y obligaría a re-calibrar ese umbral. No hay ningún caso observado en que el orden actual de citas sea incorrecto — sin evidencia, es rediseñar algo que funciona.
- **Separar la latencia de la rama léxica de la densa dentro de `search()`.** Corren en `Promise.all`: medirlas por separado daría dos números que suman más que el tiempo real transcurrido. La etapa `embedding` ya aísla el costo del round-trip a Gemini, que es la pregunta que el plan 05 quería responder.
- **Persistir las métricas en Postgres.** Fuera del alcance de SPEC 13 por decisión explícita; este spec no cambia esa postura.
- **Exponer el desglose en la UI del médico.** El consumidor de este dato es el informe y el video, no el usuario del producto.

---

## Riesgos

| Riesgo | Mitigación |
|---|---|
| La instrumentación en el camino crítico tumba un turno real | Mismo patrón de SPEC 13: todo `addStageMs` va dentro de un `try/catch` con `logger.debug`, el método retorna temprano sin turno activo y valida el valor antes de sumar. Criterio de aceptación explícito para los cinco call sites. |
| `AsyncLocalStorage` pierde el contexto en alguna rama async y una etapa queda en 0 sin que se note | `addStageMs` es no-op silencioso sin scope, igual que los contadores existentes — que hoy sí registran correctamente en esas mismas rutas (`ragQueries`, `embeddingCalls` aparecen poblados en la corrida de SPEC 13). Si una etapa apareciera en `count: 0` en la corrida real teniendo su contador > 0, es señal directa de este fallo y se ve en el JSON. |
| El solapamiento `rag`/`embedding` se malinterpreta como suma de tiempos | Se documenta en el JSDoc de `StageMs`, en la sección Métricas del README y en el propio spec. La suma de etapas nunca se presenta como total. |
| La corrida real no ejercita `stt`/`tts` (mismo problema que SPEC 13 tuvo con `endOfSpeechLatencyMs`) | Se anota en el README con la misma honestidad, apoyándose en los tests automatizados para el mecanismo. La demo en vivo con micrófono real sí los ejercita. |
| El p95 por etapa con pocos turnos es estadísticamente pobre | `count` viaja en cada `LatencyStats`, así que la debilidad es visible en el propio JSON. La corrida real busca varios turnos con y sin multi-query, no un turno único. |
