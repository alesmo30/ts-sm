# SPEC 13 — Métricas de rúbrica y reporte en README

> **Estado:** Implementado
> **Depende de:** SPEC 04 (`LlmMetricsService`), SPEC 06 (`VoiceMetricsService`), SPEC 09 (retrieval híbrido y multi-query), SPEC 10
> **Fecha:** 2026-08-10
> **Objetivo:** Instrumentar el turno completo de conversación —latencia fin-de-audio → primer chunk de TTS, tokens, invocaciones al modelo, consultas al RAG y costo— agregarlo por sesión en un endpoint `GET /metrics`, y reportar en el README números salidos de conversaciones reales.

---

## Contexto — por qué existe este spec

`plan/nuevos-enfoques/04-metricas-y-entregables.md` (bloque A) parte de que la rúbrica §5
declara las métricas obligatorias: *"si no están, el apartado correspondiente se califica muy
por debajo de su tope, aunque tu solución funcione bien"*, y advierte que *"reportar números
que no se sostienen es peor que no reportarlos"* — se contrastan contra los logs de la sesión
en vivo.

Hoy el repo tiene la mitad del camino: `LlmMetricsService` (`modules/llm/metrics.ts`) acumula
tokens, costo, latencia y TTFT **globalmente**, sin `sessionId`; `VoiceMetricsService`
(`modules/voice/voice.metrics.ts`) cuenta STT y TTS sin correlación con el turno; `pricing.ts`
calcula costo por llamada individual. Falta lo que la rúbrica pide de verdad: la latencia del
tramo completo, el agregado por sesión, las invocaciones al modelo por turno y las consultas
al RAG por llamada.

Este spec cubre el **bloque A** del plan 04, más la sección de métricas y la declaración del
modelo en el README. El diagrama (bloque C), el informe (D) y el video (E) son entregables
manuales y quedan fuera: no admiten criterios booleanos verificables.

---

## Alcance

**Dentro**

- Módulo nuevo `apps/api/src/modules/metrics/` con `TurnMetricsService` (acumulador por turno
  vía `AsyncLocalStorage`, mismo patrón que `LlmMetricsService.runInScope`),
  `metrics.controller.ts` (`GET /metrics`) y `metrics.module.ts`.
- **Dos tramos de latencia por turno**, ambos medidos en servidor:
  - `responseLatencyMs`: entrada a `ConversationService.handleUserMessage` → primer
    `emitAudio(audio)` en `enqueuePhrase` (`conversation.service.ts:424`).
  - `endOfSpeechLatencyMs`: marca de tiempo de `audio_end` del mismo socket → primer
    `emitAudio`. Es el tramo que pide la rúbrica; **incluye STT y el tiempo que el paciente
    pasó editando el composer** (diseño de SPEC 06). `null` en turnos escritos.
- P50 y P95 de ambos tramos, calculados sobre los turnos observados en la vida del proceso.
- Contadores por turno y agregados por `sessionId`: `inputTokens`, `outputTokens`, `costUsd`,
  `llmCalls` (desglosado en `stream` / `structured` / `complete` — las reformulaciones de
  multi-query cuentan), `embeddingCalls` (Gemini, separado del LLM y sin costo reportado),
  `ragQueries` (1 por `RetrievalService.search()`, así un turno con multi-query cuenta 4),
  `sttCalls`, `ttsCalls`.
- Instrumentación en los puntos existentes: `LlmMetricsService.recordCall` y
  `VoiceMetricsService.recordStt/recordTts` también escriben en el turno activo si hay uno;
  `RetrievalService.search` y `EmbeddingClient.embedOne` incrementan sus contadores.
- El gateway registra el instante de `audio_end` por socket y lo pasa al turno cuando llega el
  `user_message` de ese mismo cliente.
- Verificación y documentación de la tarifa de `llama-3.3-70b-versatile` en `pricing.ts`: se
  anota la fuente exacta en comentario. Si no se puede confirmar contra la consola de Groq, el
  README dice "costo estimado con tarifa pública, no confirmada en consola".
- README: sección de métricas con los números de una corrida real, y declaración del modelo
  (`llama-3.3-70b-versatile`, familia Meta Llama vía Groq) con su justificación.

**Fuera**

- Tabla en base de datos para las métricas — mueren con el proceso, igual que las de hoy.
- Métricas del navegador (tiempo de red, tiempo hasta que el audio suena en el parlante). El
  tramo medido termina cuando el servidor emite el chunk, y el README lo dice así.
- Diagrama de arquitectura, informe final y video — bloques C, D y E del plan 04, manuales.
- Cronometrar el levantamiento de `docker compose up` — se hace a mano, su número entra al
  README fuera de este spec.
- Vista web de métricas: la rúbrica dice que la estética no puntúa, y el jurado consulta el
  endpoint.
- Tocar `/llm/metrics`: queda como está, para no romper nada que ya lo consuma.
- Costo de STT/TTS/embeddings: proveedores en nivel gratuito, sin tarifa que sostener. Se
  reportan conteos, no dólares.

---

## Modelo de datos

No introduce tablas, columnas ni migraciones. Tampoco contratos en `packages/shared`: el
consumidor de `/metrics` es el jurado con `curl`, no `apps/web` — y `/llm/metrics` ya sentó ese
precedente (`LlmMetricsSnapshot` vive en `apps/api`, no en `shared`). Todo es estado en memoria
del proceso `api`, mismo estilo que `metrics.ts` y `voice.metrics.ts`.

### Acumulador por turno

```ts
// apps/api/src/modules/metrics/turn-metrics.ts

/** Lo que se acumula mientras el turno está en vuelo (dentro del AsyncLocalStorage). */
interface TurnScope {
  sessionId: string;
  startedAt: number;                 // Date.now() al entrar a handleUserMessage
  audioEndAt: number | null;         // marca de audio_end del socket; null si el turno fue escrito
  firstAudioAt: number | null;       // Date.now() del primer emitAudio de este turno
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  llmCalls: { stream: number; structured: number; complete: number };
  embeddingCalls: number;
  ragQueries: number;
  sttCalls: number;
  ttsCalls: number;
}

/** El turno cerrado, ya inmutable, que entra al buffer. */
export interface TurnMetric {
  at: string;                        // ISO 8601 del cierre del turno
  sessionId: string;
  responseLatencyMs: number;         // handleUserMessage → primer emitAudio
  endOfSpeechLatencyMs: number | null; // audio_end → primer emitAudio; null si turno escrito o sin audio previo
  spoke: boolean;                    // false si el turno nunca emitió audio (voz no configurada o TTS falló)
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  llmCalls: { stream: number; structured: number; complete: number };
  embeddingCalls: number;
  ragQueries: number;
  sttCalls: number;
  ttsCalls: number;
}
```

`spoke: false` importa: un turno sin audio no tiene latencia de rúbrica y **no entra a los
percentiles**. Meterlo con `responseLatencyMs` medido hasta el final del stream falsearía el
P50 hacia arriba.

### Respuesta de `GET /metrics`

```ts
export interface LatencyStats {
  count: number;      // turnos que aportaron a este percentil
  p50Ms: number | null;
  p95Ms: number | null;
  minMs: number | null;
  maxMs: number | null;
}

export interface SessionMetrics {
  sessionId: string;
  turns: number;                     // turnos del paciente instrumentados en esta sesión
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  llmCalls: number;                  // total de invocaciones al LLM en la sesión
  llmCallsPerTurn: number;           // llmCalls / turns
  embeddingCalls: number;
  ragQueries: number;
  ragQueriesPerTurn: number;
  sttCalls: number;
  ttsCalls: number;
  responseLatency: LatencyStats;
  endOfSpeechLatency: LatencyStats;
}

export interface MetricsSnapshot {
  model: string;                     // de LlmConfig — el modelo declarado en el README
  provider: string;
  pricing: { inputPerMTokUsd: number; outputPerMTokUsd: number; source: 'tarifa_publica' | 'consola_confirmada' };
  observedTurns: number;
  overall: {
    responseLatency: LatencyStats;
    endOfSpeechLatency: LatencyStats;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
    llmCalls: number;
    embeddingCalls: number;
    ragQueries: number;
  };
  bySession: SessionMetrics[];       // orden: sesión más reciente primero
  recentTurns: TurnMetric[];         // buffer circular, últimos 50 — mismo tamaño que los buffers existentes
}
```

`pricing.source` viaja en la respuesta a propósito: es la diferencia entre "costo confirmado" y
"costo con tarifa pública" y la rúbrica penaliza reportar números que no se sostienen. Si
`priceFor()` devuelve el `ZERO_PRICING` de fallback, `costUsd` sale en `0` y eso queda visible,
no disimulado.

### Retención

- `bySession`: acotado a **200 sesiones** en orden de última actividad, descartando la más
  vieja. Una demo no pasa de decenas; el tope es el seguro contra un proceso vivo días.
- Percentiles: se calculan sobre un array de latencias con tope de **500 turnos** por tramo
  (ventana deslizante). Un P95 sobre 50 muestras es ruido; 500 es suficiente para la demo y son
  ~4 KB.
- `recentTurns`: 50, igual que `LlmMetricsSnapshot.recent` y `VoiceMetricsSnapshot.recent`.

---

## Plan de implementación

1. **Módulo y acumulador vacío.** `apps/api/src/modules/metrics/` con `turn-metrics.ts` (tipos
   del modelo de datos + `TurnMetricsService`: `runInTurn(sessionId, fn)` sobre
   `AsyncLocalStorage`, `markAudioEnd`, `markFirstAudio`, `addLlmCall`, `addEmbeddingCall`,
   `addRagQuery`, `addSttCall`, `addTtsCall`, `getSnapshot`), `metrics.controller.ts` con
   `GET /metrics`, y `metrics.module.ts` marcado `@Global()` — mismo recurso que usa
   `DatabaseModule` para que `llm`, `voice`, `knowledge` y `embeddings` inyecten el servicio sin
   que ninguno de esos módulos importe a `metrics` explícitamente (y sin ciclo). Todos los
   `add*` son no-op si no hay turno activo, así que nada se rompe fuera del flujo de
   conversación.
   **Verificación:** `GET /metrics` responde `observedTurns: 0`, `bySession: []`, y
   `model`/`provider`/`pricing` con los valores reales de `LlmConfig` y `priceFor()`.
   `turn-metrics.spec.ts` cubre percentiles (P50/P95 con listas conocidas, `null` con lista
   vacía) y el no-op sin scope.

2. **Percentiles y ventana deslizante.** `percentile(values, p)` como función pura en
   `metrics/percentiles.ts` (interpolación lineal, orden explícito), y la ventana de 500 por
   tramo.
   **Verificación:** test con `[1..100]` da P50 = 50.5 y P95 = 95.05; con un solo valor,
   P50 = P95 = ese valor; a los 501 turnos la ventana descarta el más viejo.

3. **Envoltura del turno en `ConversationService`.** `handleUserMessage` corre su cuerpo dentro
   de `turnMetrics.runInTurn(sessionId, ...)`, y `enqueuePhrase` llama
   `turnMetrics.markFirstAudio()` justo antes del primer `emitAudio(audio)`
   (`conversation.service.ts:424`). El turno se cierra al terminar `handleUserMessage`,
   **después** de esperar `ttsChain` — si el audio se emite después del cierre, la latencia sale
   `null` y el turno no cuenta.
   **Verificación:** `conversation.service.spec.ts` sigue en verde; test nuevo que confirma que
   un turno con TTS deja un `TurnMetric` con `spoke: true` y `responseLatencyMs > 0`, y que un
   turno sin voz deja `spoke: false` y no aporta a los percentiles.

4. **`audio_end` correlacionado en el gateway.** `ConversationGateway` guarda `Date.now()` por
   socket al terminar `handleAudioEnd` con transcripción válida
   (`audioEndByClient: Map<WebSocket, number>`), lo consume el siguiente `user_message` de ese
   mismo socket y lo borra al consumirlo y en `handleDisconnect` — un `audio_end` no puede
   alimentar dos turnos. La marca se pasa a `handleUserMessage` como parámetro opcional.
   **Verificación:** test del gateway: `audio_end` → `user_message` produce
   `endOfSpeechLatencyMs` no nulo y mayor que `responseLatencyMs`; un `user_message` escrito sin
   `audio_end` previo lo deja en `null`; dos `user_message` seguidos tras un solo `audio_end`
   dejan el segundo en `null`.

5. **Contadores en los puntos existentes.** `LlmMetricsService.recordCall` llama
   `turnMetrics.addLlmCall(method, inputTokens, outputTokens, costUsd)`;
   `VoiceMetricsService.recordStt/recordTts` llaman `addSttCall`/`addTtsCall`;
   `RetrievalService.search` llama `addRagQuery()` en cada invocación;
   `EmbeddingClient.embedOne` llama `addEmbeddingCall()`. Ningún sitio de llamada cambia de
   firma, y cada llamada va envuelta en `try { } catch { }` silencioso (ver riesgos).
   **Verificación:** un turno con multi-query (retrieval vacío y luego 3 variaciones) reporta
   `llmCalls.stream: 1`, `llmCalls.structured: 1` y `ragQueries: 4`. Los specs existentes de
   `metrics`, `voice.metrics` y `retrieval.service` siguen en verde.

6. **Tarifa de Groq documentada.** Verificar `llama-3.3-70b-versatile` en la página pública de
   precios de Groq. Comentario en `pricing.ts` con URL y fecha de consulta, y `pricingSource` en
   la config (`'tarifa_publica'` mientras no se confirme en consola).
   **Verificación:** `GET /metrics` devuelve `pricing.source` coherente con lo que dice el
   comentario; `pricing.spec.ts` sigue en verde.

7. **Corrida real y README.** Levantar el stack, sostener al menos **dos sesiones de voz
   completas de 5+ turnos cada una** (una que escale, una que cierre normal), leer
   `GET /metrics` y volcar los números al README: sección de métricas con P50/P95 de los dos
   tramos —cada uno con lo que incluye y lo que no—, tokens por turno y por sesión,
   invocaciones al modelo por turno, consultas al RAG por llamada y costo por sesión. Más la
   declaración del modelo (`llama-3.3-70b-versatile`, familia Meta Llama vía Groq) con su
   justificación.
   **Verificación:** cada número del README se encuentra en la salida de `/metrics` de esa
   corrida, con el JSON crudo pegado en un bloque plegable del propio README como evidencia.

---

## Criterios de aceptación

- [ ] `GET /metrics` responde sin turnos observados y no rompe con `bySession: []`.
- [ ] `endOfSpeechLatencyMs` se mide desde el `audio_end` del socket hasta el primer
      `emitAudio`, y es `null` en turnos escritos.
- [ ] Un solo `audio_end` alimenta un solo turno; el siguiente turno sin `audio_end` propio
      queda en `null`.
- [ ] Los turnos con `spoke: false` **no** entran a los percentiles de ninguno de los dos
      tramos.
- [ ] P50 y P95 se calculan con interpolación lineal y están cubiertos por test con valores
      conocidos.
- [ ] Un turno con multi-query reporta `ragQueries: 4` y `llmCalls.structured: 1` — las
      reformulaciones de SPEC 09 no se esconden.
- [ ] `embeddingCalls` cuenta las llamadas a Gemini aparte de `llmCalls`, y no reporta costo.
- [ ] `bySession` agrega tokens, costo, `llmCallsPerTurn` y `ragQueriesPerTurn` por `sessionId`.
- [ ] `pricing.source` viaja en la respuesta y refleja si la tarifa se confirmó en consola o no.
- [ ] Ningún sitio de llamada existente cambió de firma; `metrics.spec.ts`,
      `voice.metrics.spec.ts`, `retrieval.service.spec.ts` y `conversation.service.spec.ts`
      siguen en verde.
- [ ] `/llm/metrics` responde exactamente lo mismo que antes de este spec.
- [ ] Con un `TurnMetricsService` que lanza en todos sus métodos, un turno completo de
      `handleUserMessage` sigue respondiendo y guardando su transcript.
- [ ] Ningún método `add*`/`mark*` de `TurnMetricsService` hace I/O ni puede lanzar; todos
      retornan temprano si no hay turno activo.
- [ ] Tras `handleDisconnect`, `audioEndByClient` no conserva entradas de ese socket.
- [ ] `bySession` está acotado a 200 sesiones por última actividad.
- [ ] El README declara el modelo exacto, el proveedor y por qué se eligió.
- [ ] El README reporta los dos tramos de latencia, cada uno con qué incluye y qué no.
- [ ] Cada número del README aparece en el JSON de `/metrics` pegado como evidencia en el mismo
      README.
- [ ] No hay tabla, columna ni migración nueva.
- [ ] `pnpm lint`, `pnpm typecheck` y `pnpm test` en verde.

---

## Decisiones tomadas y descartadas

**Tomadas**

- **Dos tramos de latencia, ambos reportados.** `endOfSpeechLatencyMs` es el que pide la rúbrica
  pero incluye el tiempo que el paciente pasa editando el composer (diseño de SPEC 06: el
  `stt_result` vuelve al composer y el envío pasa siempre por `user_message`).
  `responseLatencyMs` es el tramo limpio del sistema. Reportar solo el primero infla el número
  contra nosotros sin explicación; reportar solo el segundo mide algo que la rúbrica no pidió.
  Los dos, etiquetados, es la única opción defendible.
- **Medición en servidor, no en el navegador.** El tramo termina cuando el servidor emite el
  chunk de audio, y el README lo dice con esas palabras. Medir en el cliente exigiría un
  endpoint de telemetría nuevo y números que el jurado no puede contrastar contra los logs.
- **Todo en memoria, sin tabla.** Mismo patrón que `LlmMetricsService` y `VoiceMetricsService` ya
  en producción. Persistir exigiría migración, repositorio y un cierre de turno transaccional
  para números que solo se leen en una demo.
- **Módulo `metrics` marcado `@Global()`.** Precedente directo: `DatabaseModule`. Es lo que
  permite que `llm`, `voice`, `knowledge` y `embeddings` escriban en el turno activo sin importar
  el módulo y sin ciclo de dependencias.
- **`AsyncLocalStorage` para el scope del turno.** `LlmMetricsService.runInScope` ya lo usa para
  el TTFT; extender el mismo mecanismo evita pasar un objeto de métricas por seis firmas de
  método.
- **Las reformulaciones de multi-query cuentan como invocaciones al modelo.** Son llamadas
  reales al LLM aprobado. Esconderlas para que "invocaciones por turno" salga en 1 es exactamente
  lo que la rúbrica llama reportar números que no se sostienen.
- **`ragQueries` = 1 por `RetrievalService.search()`.** Un turno con multi-query reporta 4, no 1.
  Es la carga real sobre el retrieval.
- **Los embeddings se cuentan aparte y sin costo.** Gemini es encoder, no el LLM generativo (ver
  `REGLAS.md` y la zona gris del kit). Mezclarlos con `llmCalls` confundiría al jurado sobre la
  restricción de un solo LLM.
- **Los turnos sin audio no entran a los percentiles.** Un turno donde la voz no estaba
  configurada o el TTS falló no tiene latencia de rúbrica. Contarlo con el fin del stream
  ensuciaría el P50.
- **`pricing.source` en la respuesta.** La tarifa de `llama-3.3-70b-versatile` no se pudo
  confirmar en la consola de Groq. Exponer esa incertidumbre en el propio endpoint es más barato
  que defender un costo que no se sostiene.
- **`/llm/metrics` intacto.** El endpoint nuevo agrega; no reemplaza. Cero riesgo de romper algo
  a dos días de la entrega. Corrige de paso el criterio del plan 04 que hablaba de
  `/llm/metrics`: la fuente de verdad del README es `/metrics`.
- **Sin contratos en `packages/shared`.** El consumidor es `curl`, no `apps/web`. Tocar `shared`
  obliga a `pnpm --filter shared build` y arrastra la trampa del caché de Vite en Docker (ver
  `CLAUDE.md`) sin ganar nada.

**Descartadas**

- **Tabla `app.turn_metrics`.** Migración, repositorio y persistencia para números que se leen
  una vez, en una demo, dentro del mismo proceso.
- **Endpoint de telemetría del cliente para medir hasta que el audio suena en el parlante.**
  Superficie nueva, sin forma de que el jurado la contraste, en el bloque de tiempo más ajustado
  del plan.
- **Meter las métricas de voz y RAG en `/llm/metrics`.** Rompe el layering: el módulo `llm` no
  tiene por qué conocer STT ni retrieval.
- **Vista web de métricas.** La rúbrica dice literal que la estética no puntúa, y el jurado
  consulta el endpoint.
- **Reportar costo de STT/TTS/embeddings.** Los tres están en nivel gratuito; inventar una
  tarifa para sumarla al total sería un número sin respaldo.
- **Cambiar el diseño de SPEC 06 para que el envío sea automático tras el `audio_end` y así
  medir el tramo puro de la rúbrica.** Es un cambio de producto en el último día para mejorar
  una métrica. Se documenta la limitación en su lugar.
- **Estimar los números del README en vez de medirlos.** Penalización explícita de la rúbrica:
  se contrastan contra los logs de la sesión en vivo.

---

## Riesgos

### Riesgo mitigado: la instrumentación vive dentro del camino crítico del turno

`LlmMetricsService.recordCall`, `VoiceMetricsService.recordStt/recordTts`,
`RetrievalService.search` y `EmbeddingClient.embedOne` son código que ya funciona. Una excepción
dentro de un contador —un `sessionId` inesperado, un `Map` en mal estado— tumbaría el turno
completo del paciente por una métrica.

Mitigación, en tres capas:

1. **Los `add*` y `mark*` de `TurnMetricsService` no lanzan nunca.** Cada uno abre con
   `const scope = this.als.getStore(); if (!scope) return;` y su cuerpo es aritmética de enteros
   sobre el propio scope — sin I/O, sin serialización, sin acceso a mapas externos.
   `getSnapshot()` es el único método que arma estructuras, y solo lo llama el controller.
2. **Los sitios de llamada existentes envuelven la llamada en `try { } catch { }` silencioso.**
   Igual que ya hace `enqueuePhrase` con los fallos de TTS: una métrica perdida no interrumpe la
   conversación. El `catch` loguea a nivel `debug`, no `error` — no es una condición de alarma.
3. **Test explícito:** con `TurnMetricsService` reemplazado por un doble que lanza en cada
   método, un turno completo de `handleUserMessage` sigue respondiendo y guardando su
   transcript. Si la instrumentación puede tumbar el turno, ese test falla.

### Riesgo mitigado: mapas y agregados sin tope

- `audioEndByClient` en el gateway: se borra al consumirlo y en `handleDisconnect` (paso 4).
  Criterio de aceptación: tras desconectar, el mapa no conserva entradas de ese socket.
- `bySession`: acotado a 200 sesiones en orden de última actividad, descartando la más vieja.
- Ventana de percentiles: 500 por tramo, ya en el modelo de datos.

### Riesgos asumidos, declarados sin mitigación adicional

| Riesgo | Por qué se asume |
| --- | --- |
| El P95 sale alto porque `endOfSpeechLatencyMs` incluye al paciente editando el composer | Se reportan los dos tramos con su definición exacta. Bajarlo exigiría cambiar el diseño de SPEC 06 el último día — descartado arriba. |
| Pocas muestras hacen que el P95 sea ruido | `LatencyStats.count` viaja en la respuesta: el jurado ve sobre cuántas muestras se calculó. El paso 7 exige dos sesiones de 5+ turnos. |
| La tarifa de Groq es incorrecta y el costo del README no cuadra | `pricing.source: 'tarifa_publica'` viaja en el endpoint y el README lo declara. Un costo etiquetado como estimado es defendible; uno presentado como confirmado sin serlo, no. |
| El turno se cierra antes de que salga el primer audio y la latencia queda `null` | El cierre espera `ttsChain`. Si aun así el audio llega tarde, el turno queda `spoke: false` y no contamina los percentiles — degrada a "no medido", nunca a "medido mal". |
| `AsyncLocalStorage` pierde el contexto en la cadena de TTS y `markFirstAudio` no encuentra el turno | `enqueuePhrase` se define dentro del cuerpo ya envuelto por `runInTurn` y `ttsChain` se encadena con `.then()`, que preserva el store. El test del paso 3 falla si se pierde. |
| Instrumentar el turno introduce latencia en el propio turno que mide | Son `Date.now()` y sumas de enteros en memoria, sin I/O ni serialización, frente a llamadas de red de cientos de milisegundos por turno. |
| Se pasa el tiempo instrumentando y no queda hora para el video | El plan 04 fija el corte de código a la hora 3. Los pasos 1–6 son ~1.5 h; el paso 7 es la corrida, no código nuevo. |

---

## Lo que **no** está en este spec

- El diagrama de arquitectura (bloque C del plan 04).
- El informe final (bloque D).
- El video y su guion (bloque E).
- El cronometraje del levantamiento con `docker compose down -v` (bloque B, manual).
- Cualquier persistencia de métricas en base de datos.
- Cualquier superficie web que muestre las métricas.
