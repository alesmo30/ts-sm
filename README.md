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
| `POST` | `/llm/complete` | llamada de verificación al proveedor de LLM activo |
| `GET` | `/llm/health` | proveedor y modelo activos (`provider`, `model`, `ready`) |
| `GET` | `/llm/metrics` | acumulado en memoria de tokens/costo/latencia por llamada |
| `GET` | `/metrics` | métricas de rúbrica por turno y por sesión — ver [Métricas](#métricas) |

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

## Capa de LLM: cambiar de proveedor

Todo acceso al modelo pasa por `LlmPort` (`apps/api/src/modules/llm/llm.port.ts`) — ver `specs/04-capa-agnostica-llm.md`. El proveedor se resuelve una sola vez en el bootstrap de Nest a partir de cinco variables de entorno; cambiarlo es editar `.env` y reiniciar, sin tocar ningún archivo `.ts`.

| Variable | Default | Notas |
|---|---|---|
| `LLM_PROVIDER` | `mock` | `mock` \| `anthropic` \| `openai`. Un valor fuera de esos tres aborta el arranque. |
| `LLM_MODEL` | — | Sin default. Obligatorio si `LLM_PROVIDER` no es `mock`; el arranque aborta nombrando la variable si falta. |
| `ANTHROPIC_API_KEY` | — | Obligatoria solo si `LLM_PROVIDER=anthropic`. |
| `OPENAI_API_KEY` | — | Obligatoria solo si `LLM_PROVIDER=openai`. |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | Host compatible con la API de OpenAI. |

Con `LLM_PROVIDER=mock` (el default) la API arranca sin ninguna key: cuatro respuestas fijas rotativas, útiles para probar la tubería sin gastar cuota de ningún proveedor.

**Ejemplo — Groq como gateway compatible con OpenAI**, sin escribir un cuarto driver:

```bash
LLM_PROVIDER=openai
LLM_MODEL=llama-3.3-70b-versatile
OPENAI_API_KEY=gsk_...
OPENAI_BASE_URL=https://api.groq.com/openai/v1
```

El driver `openai` no sabe que está hablando con Groq; solo usa el `baseURL` configurado. El mismo mecanismo sirve para cualquier gateway compatible con la API de `chat.completions`.

**Advertencia (R0.1 de `REGLAS.md`):** el `.env` que se entrega, el README y el video de demo deben apuntar al modelo obligatorio anunciado el 7 de agosto de 2026 — nunca a otro proveedor como fallback ni "solo para probar". Verificar con `GET /llm/health` antes de grabar cualquier entregable.

## Métricas

Ver `specs/13-metricas-de-rubrica.md`. `GET /metrics` acumula en memoria (sin persistencia — muere con el proceso, igual que `/llm/metrics`) latencia, tokens, invocaciones al modelo, consultas al RAG y costo, por turno y agregado por sesión.

**Modelo declarado:** `llama-3.3-70b-versatile`, familia Meta Llama, servido vía Groq (gateway compatible con la API de OpenAI — ver [Capa de LLM](#capa-de-llm-cambiar-de-proveedor)). Elegido por estar dentro de las familias permitidas por el kit del reto (G3) y por su latencia de inferencia, el factor más ajustado del presupuesto de una conversación de voz con un turno completo (STT → LLM → TTS) por debajo de los pocos segundos que tolera una llamada en vivo.

### Los dos tramos de latencia

| Tramo | Qué mide | Qué incluye |
|---|---|---|
| `responseLatencyMs` | Entrada a `handleUserMessage` → primer chunk de audio emitido | Solo el sistema: retrieval, LLM, primera frase sintetizada. No incluye STT ni red hacia el navegador. |
| `endOfSpeechLatencyMs` | `audio_end` del socket (fin de la transcripción) → primer chunk de audio | Es el tramo que pide la rúbrica — server-side, no incluye la ida/vuelta de red hacia el navegador ni la reproducción del audio en el parlante. |

**Esta corrida no ejerció `endOfSpeechLatencyMs`.** Las dos conversaciones de la corrida real (abajo) se condujeron con `user_message` directo (texto con `isVoice:true`), no con el flujo completo `audio_start` → frames de audio → `audio_end` — reproducir ese flujo exige audio real capturado por micrófono, que un script de backend no puede generar sin grabar o sintetizar voz de antemano. El mecanismo de este tramo (marca tomada en `ConversationGateway.handleAudioEnd`, consumida por el siguiente `user_message` del mismo socket) está cubierto por test automatizado en `apps/api/src/modules/conversation/conversation.gateway.spec.ts` y `apps/api/src/modules/metrics/turn-metrics.spec.ts`, no por esta corrida. La demo en vivo (app web con micrófono real) sí lo ejerce.

### Corrida real — 2026-08-11

Dos conversaciones completas contra el modelo real (`llama-3.3-70b-versatile` vía Groq), TTS real (Deepgram Aura-2) y embeddings reales (Gemini) — sin mocks. `docker compose up --build` sobre la imagen con este spec, corpus del reto ya sembrado.

| | Sesión "Ana María Restrepo" | Sesión "Carlos Gómez" |
|---|---|---|
| Turnos del paciente | 6 | 5 |
| Desenlace | escaló (`status: fail`) — dos áreas en amarillo (dolor + hinchazón) acumularon a rojo por SPEC 10, no por una sola bandera roja | escaló (`status: fail`) — sangrado, fiebre 39.5°, dolor 9/10: banderas rojas explícitas |
| `responseLatencyMs` P50 / P95 | 5432 / 8038 | 6235 / 9427 |
| Tokens entrada / salida | 19894 / 613 | 15180 / 386 |
| Invocaciones al LLM (`llmCallsPerTurn`) | 6 (1.0) | 5 (1.0) |
| Consultas al RAG (`ragQueriesPerTurn`) | 8 (1.33) | 20 (4.0) |
| Costo estimado | $0.0122 | $0.0093 |

Las dos sesiones de esta corrida terminaron escaladas — no fue el guion buscado (una pensada para cerrar sin novedad), sino el comportamiento real del triage sobre el texto enviado; se reporta tal cual, sin repetir la corrida hasta obtener el resultado "bonito". La sesión de Carlos Gómez reporta `ragQueriesPerTurn: 4.0` en los 4 turnos con síntomas graves porque el filtro de relevancia no encontró citas del corpus para ese vocabulario y disparó el respaldo de multi-query de SPEC 09 (1 intento original + 3 reformulaciones) en cada uno — la cifra no está inflada, es el costo real de una conversación fuera de cobertura del corpus.

Agregado de las dos sesiones (`overall`, 11 turnos):

| Métrica | Valor |
|---|---|
| `responseLatencyMs` P50 / P95 / min / max | 6091 / 9410 / 3784 / 10144 |
| `endOfSpeechLatencyMs` | sin muestras en esta corrida (ver arriba) |
| Tokens de entrada / salida | 35074 / 999 |
| Invocaciones al LLM | 11 (1 por turno — las reformulaciones de multi-query se cuentan aparte, ver `ragQueries`) |
| Consultas al RAG | 28 |
| Llamadas a embeddings (Gemini, aparte de `llmCalls`) | 251 |
| Costo total estimado | $0.0215 |
| Tarifa | `tarifa_publica` — $0.59 / $0.79 por millón de tokens (entrada/salida), sin confirmar contra la consola de la cuenta de Groq (ver `apps/api/src/modules/llm/pricing.ts`) |

<details>
<summary>JSON crudo de <code>GET /metrics</code> al cierre de esta corrida</summary>

```json
{
  "model": "llama-3.3-70b-versatile",
  "provider": "openai",
  "pricing": {
    "inputPerMTokUsd": 0.59,
    "outputPerMTokUsd": 0.79,
    "source": "tarifa_publica"
  },
  "observedTurns": 11,
  "overall": {
    "responseLatency": { "count": 11, "p50Ms": 6091, "p95Ms": 9410, "minMs": 3784, "maxMs": 10144 },
    "endOfSpeechLatency": { "count": 0, "p50Ms": null, "p95Ms": null, "minMs": null, "maxMs": null },
    "inputTokens": 35074,
    "outputTokens": 999,
    "costUsd": 0.021482870000000005,
    "llmCalls": 11,
    "embeddingCalls": 251,
    "ragQueries": 28
  },
  "bySession": [
    {
      "sessionId": "928a4d3c-7ca5-4411-abfa-65ce8371d879",
      "turns": 5,
      "inputTokens": 15180,
      "outputTokens": 386,
      "costUsd": 0.00926114,
      "llmCalls": 5,
      "llmCallsPerTurn": 1,
      "embeddingCalls": 155,
      "ragQueries": 20,
      "ragQueriesPerTurn": 4,
      "sttCalls": 0,
      "ttsCalls": 17,
      "responseLatency": { "count": 5, "p50Ms": 6235, "p95Ms": 9427.4, "minMs": 5722, "maxMs": 10144 },
      "endOfSpeechLatency": { "count": 0, "p50Ms": null, "p95Ms": null, "minMs": null, "maxMs": null }
    },
    {
      "sessionId": "b75c382e-92d7-4d1a-8014-bcf34dc4e17b",
      "turns": 6,
      "inputTokens": 19894,
      "outputTokens": 613,
      "costUsd": 0.01222173,
      "llmCalls": 6,
      "llmCallsPerTurn": 1,
      "embeddingCalls": 96,
      "ragQueries": 8,
      "ragQueriesPerTurn": 1.3333333333333333,
      "sttCalls": 0,
      "ttsCalls": 26,
      "responseLatency": { "count": 6, "p50Ms": 5431.5, "p95Ms": 8038, "minMs": 3784, "maxMs": 8676 },
      "endOfSpeechLatency": { "count": 0, "p50Ms": null, "p95Ms": null, "minMs": null, "maxMs": null }
    }
  ],
  "recentTurns": [
    { "at": "2026-08-11T04:04:06.593Z", "sessionId": "b75c382e-92d7-4d1a-8014-bcf34dc4e17b", "responseLatencyMs": 8676, "endOfSpeechLatencyMs": null, "spoke": true, "inputTokens": 2703, "outputTokens": 84, "costUsd": 0.0016611299999999998, "llmCalls": { "stream": 1, "structured": 0, "complete": 0 }, "embeddingCalls": 47, "ragQueries": 4, "sttCalls": 0, "ttsCalls": 5 },
    { "at": "2026-08-11T04:04:18.796Z", "sessionId": "b75c382e-92d7-4d1a-8014-bcf34dc4e17b", "responseLatencyMs": 4426, "endOfSpeechLatencyMs": null, "spoke": true, "inputTokens": 3210, "outputTokens": 83, "costUsd": 0.00195947, "llmCalls": { "stream": 1, "structured": 0, "complete": 0 }, "embeddingCalls": 13, "ragQueries": 1, "sttCalls": 0, "ttsCalls": 4 },
    { "at": "2026-08-11T04:04:38.112Z", "sessionId": "b75c382e-92d7-4d1a-8014-bcf34dc4e17b", "responseLatencyMs": 6124, "endOfSpeechLatencyMs": null, "spoke": true, "inputTokens": 3304, "outputTokens": 144, "costUsd": 0.00206312, "llmCalls": { "stream": 1, "structured": 0, "complete": 0 }, "embeddingCalls": 12, "ragQueries": 1, "sttCalls": 0, "ttsCalls": 5 },
    { "at": "2026-08-11T04:04:59.254Z", "sessionId": "b75c382e-92d7-4d1a-8014-bcf34dc4e17b", "responseLatencyMs": 4988, "endOfSpeechLatencyMs": null, "spoke": true, "inputTokens": 3663, "outputTokens": 176, "costUsd": 0.00230021, "llmCalls": { "stream": 1, "structured": 0, "complete": 0 }, "embeddingCalls": 11, "ragQueries": 1, "sttCalls": 0, "ttsCalls": 7 },
    { "at": "2026-08-11T04:05:07.312Z", "sessionId": "b75c382e-92d7-4d1a-8014-bcf34dc4e17b", "responseLatencyMs": 5875, "endOfSpeechLatencyMs": null, "spoke": true, "inputTokens": 3683, "outputTokens": 36, "costUsd": 0.0022014099999999996, "llmCalls": { "stream": 1, "structured": 0, "complete": 0 }, "embeddingCalls": 12, "ragQueries": 1, "sttCalls": 0, "ttsCalls": 2 },
    { "at": "2026-08-11T04:05:20.383Z", "sessionId": "b75c382e-92d7-4d1a-8014-bcf34dc4e17b", "responseLatencyMs": 3784, "endOfSpeechLatencyMs": null, "spoke": true, "inputTokens": 3331, "outputTokens": 90, "costUsd": 0.0020363900000000003, "llmCalls": { "stream": 1, "structured": 0, "complete": 0 }, "embeddingCalls": 1, "ragQueries": 0, "sttCalls": 0, "ttsCalls": 3 },
    { "at": "2026-08-11T04:05:43.524Z", "sessionId": "928a4d3c-7ca5-4411-abfa-65ce8371d879", "responseLatencyMs": 5722, "endOfSpeechLatencyMs": null, "spoke": true, "inputTokens": 2705, "outputTokens": 88, "costUsd": 0.0016654699999999998, "llmCalls": { "stream": 1, "structured": 0, "complete": 0 }, "embeddingCalls": 41, "ragQueries": 4, "sttCalls": 0, "ttsCalls": 4 },
    { "at": "2026-08-11T04:05:57.751Z", "sessionId": "928a4d3c-7ca5-4411-abfa-65ce8371d879", "responseLatencyMs": 6561, "endOfSpeechLatencyMs": null, "spoke": true, "inputTokens": 3104, "outputTokens": 78, "costUsd": 0.00189298, "llmCalls": { "stream": 1, "structured": 0, "complete": 0 }, "embeddingCalls": 29, "ragQueries": 4, "sttCalls": 0, "ttsCalls": 3 },
    { "at": "2026-08-11T04:06:09.524Z", "sessionId": "928a4d3c-7ca5-4411-abfa-65ce8371d879", "responseLatencyMs": 6091, "endOfSpeechLatencyMs": null, "spoke": true, "inputTokens": 3097, "outputTokens": 78, "costUsd": 0.0018888499999999999, "llmCalls": { "stream": 1, "structured": 0, "complete": 0 }, "embeddingCalls": 29, "ragQueries": 4, "sttCalls": 0, "ttsCalls": 3 },
    { "at": "2026-08-11T04:06:25.912Z", "sessionId": "928a4d3c-7ca5-4411-abfa-65ce8371d879", "responseLatencyMs": 10144, "endOfSpeechLatencyMs": null, "spoke": true, "inputTokens": 3181, "outputTokens": 78, "costUsd": 0.0019384099999999998, "llmCalls": { "stream": 1, "structured": 0, "complete": 0 }, "embeddingCalls": 29, "ragQueries": 4, "sttCalls": 0, "ttsCalls": 3 },
    { "at": "2026-08-11T04:06:37.597Z", "sessionId": "928a4d3c-7ca5-4411-abfa-65ce8371d879", "responseLatencyMs": 6235, "endOfSpeechLatencyMs": null, "spoke": true, "inputTokens": 3093, "outputTokens": 64, "costUsd": 0.0018754299999999998, "llmCalls": { "stream": 1, "structured": 0, "complete": 0 }, "embeddingCalls": 27, "ragQueries": 4, "sttCalls": 0, "ttsCalls": 4 }
  ]
}
```

</details>

Reproducir: `docker compose up --build`, luego crear una sesión (`POST /sessions`) y conducir turnos por el WebSocket `/ws` (ver `apps/web/src/features/paciente/api/useConversation.ts` para el formato exacto de los eventos), y leer `GET /metrics`.

### Latencia por etapa (SPEC 14)

`responseLatencyMs` dice cuánto tardó el turno completo, pero no dónde se fue ese tiempo. `GET /metrics` reparte los milisegundos por etapa externa en `overall.stageLatency` y `bySession[].stageLatency` (forma `LatencyStats`, igual que las demás), y en `stageMs` por turno individual dentro de `recentTurns`. Ver `specs/14-latencia-por-etapa.md`.

| Etapa | Qué mide |
|---|---|
| `rag` | `RetrievalService.search()` completo — rama léxica + semántica en paralelo, incluido el `embedOne` de la consulta. Con fallback multi-query (SPEC 09), las 4 invocaciones de `search()` de un turno suman sobre la misma etapa. |
| `embedding` | El `fetch` a Gemini dentro de `EmbeddingClient.embedOne()`. Cubre retrieval semántico, `CitationRelevanceService` y `RedFlagDetectorService` — todo lo que embebe texto en el turno, no solo RAG. Un `embedOne` que falla igual aporta su duración: es la latencia de un timeout la que interesa medir. |
| `llm` | `input.latencyMs` que ya recibe `LlmMetricsService.recordCall()` — la llamada al único LLM permitido. |
| `stt` | `input.durationMs` que ya recibe `VoiceMetricsService.recordStt()`. |
| `tts` | `input.durationMs` que ya recibe `VoiceMetricsService.recordTts()`. |

**`rag` y `embedding` se solapan a propósito — su suma NO es `responseLatencyMs`.** `search()` incluye el `embedOne` de la consulta, así que esos milisegundos cuentan en las dos etapas; `embedding` además incluye llamadas fuera de `search()` (filtrado de citas, backstop de escalada). Restar el solape daría un número más "limpio" pero mentiroso. Cada etapa reporta `count` aparte, así que una etapa nunca ejercida en el turno queda en `count: 0` y percentiles `null`, no en `0` — un turno de texto sin audio no diluye el p50 de `stt`/`tts` con ceros.

**Esta corrida no ejerció `stt`.** Los cuatro turnos se condujeron por WebSocket (`user_message` con `isVoice:false`), sin pasar por `audio_start`/frames de audio/`audio_end` — mismo motivo que `endOfSpeechLatencyMs` arriba. `tts` sí se ejerció: la respuesta se sintetiza siempre, la haya pedido el paciente en voz o no. El mecanismo de `stt` está cubierto por test automatizado (`voice.metrics.spec.ts`, `turn-metrics.spec.ts`); la demo en vivo con micrófono real lo ejerce.

#### Corrida real — 2026-08-12

Una sesión, 4 turnos, contra el modelo real (`llama-3.3-70b-versatile` vía Groq), TTS real (Deepgram Aura-2) y embeddings reales (Gemini) — sin mocks. `docker compose up --build`, conversación conducida por `/ws`. Este turno no disparó el respaldo de multi-query de SPEC 09 (`ragQueries: 1` por turno) — a diferencia de la corrida de SPEC 13 arriba, que sí lo hizo en una de sus sesiones.

| Etapa | count | p50Ms | p95Ms | minMs | maxMs |
|---|---|---|---|---|---|
| `rag` | 4 | 576.5 | 821.3 | 439 | 859 |
| `embedding` | 4 | 6347.5 | 6460.2 | 6274 | 6477 |
| `llm` | 4 | 795.5 | 1086.4 | 622 | 1129 |
| `stt` | 0 | null | null | null | null |
| `tts` | 4 | 6645 | 15912.1 | 3504 | 17073 |

**Lectura:** con `responseLatencyMs` p50 de 4849.5 ms, la etapa `embedding` (p50 6347.5 ms) es, ella sola, más larga que el turno completo — porque `embedding` cuenta las ~12 llamadas a Gemini que dispara `CitationRelevanceService` filtrando citas una por una, no una sola llamada. El LLM (p50 795.5 ms) es una fracción menor del turno frente al costo agregado de embeddings; RAG (p50 576.5 ms, sin multi-query en esta corrida) es la etapa más barata de las tres que sí se ejercitaron server-side.

<details>
<summary>JSON crudo de <code>GET /metrics</code> al cierre de esta corrida</summary>

```json
{
  "observedTurns": 4,
  "overall": {
    "responseLatency": { "count": 4, "p50Ms": 4849.5, "p95Ms": 6038.95, "minMs": 3515, "maxMs": 6199 },
    "endOfSpeechLatency": { "count": 0, "p50Ms": null, "p95Ms": null, "minMs": null, "maxMs": null },
    "inputTokens": 13147,
    "outputTokens": 287,
    "costUsd": 0.00798346,
    "llmCalls": 4,
    "embeddingCalls": 48,
    "ragQueries": 4,
    "stageLatency": {
      "rag": { "count": 4, "p50Ms": 576.5, "p95Ms": 821.3499999999999, "minMs": 439, "maxMs": 859 },
      "embedding": { "count": 4, "p50Ms": 6347.5, "p95Ms": 6460.200000000001, "minMs": 6274, "maxMs": 6477 },
      "llm": { "count": 4, "p50Ms": 795.5, "p95Ms": 1086.3999999999999, "minMs": 622, "maxMs": 1129 },
      "stt": { "count": 0, "p50Ms": null, "p95Ms": null, "minMs": null, "maxMs": null },
      "tts": { "count": 4, "p50Ms": 6645, "p95Ms": 15912.149999999998, "minMs": 3504, "maxMs": 17073 }
    }
  },
  "recentTurns": [
    { "responseLatencyMs": 6199, "spoke": true, "ragQueries": 1, "stageMs": { "rag": 608, "embedding": 6365, "llm": 1129, "stt": 0, "tts": 17073 } },
    { "responseLatencyMs": 4567, "spoke": true, "ragQueries": 1, "stageMs": { "rag": 545, "embedding": 6477, "llm": 746, "stt": 0, "tts": 3956 } },
    { "responseLatencyMs": 5132, "spoke": true, "ragQueries": 1, "stageMs": { "rag": 859, "embedding": 6330, "llm": 845, "stt": 0, "tts": 9334 } },
    { "responseLatencyMs": 3515, "spoke": true, "ragQueries": 1, "stageMs": { "rag": 439, "embedding": 6274, "llm": 622, "stt": 0, "tts": 3504 } }
  ]
}
```

`recentTurns` recortado a los campos relevantes de esta etapa para legibilidad — el JSON real de `GET /metrics` incluye también `at`, `sessionId`, tokens, costo y desglose de `llmCalls`/`embeddingCalls`/`ttsCalls` por turno, igual que en la corrida de SPEC 13.

</details>

## Base de conocimiento (RAG)

El corpus clínico (107 PDFs del kit del reto, español e inglés mezclados) no se commitea — ver `specs/07-rag-y-citas-trazables.md`. Flujo completo, de cero a base sembrada:

```bash
pnpm dataset:fetch          # clona TechSphere2026/ParticipantArtifacts en dataset-reto/
pnpm --filter api kb:ingest    # extrae PDFs, detecta idioma, fragmenta, llena references + reference_chunks
pnpm --filter api kb:translate # traduce chunks en inglés vía LlmPort — reanudable, cache-first en database/kb-cache/
pnpm --filter api kb:dump      # vuelca references + reference_chunks a database/seed-data/kb-corpus.json.gz
```

`kb-corpus.json.gz` y `database/kb-cache/` van commiteados: `docker compose up` los carga vía `seed.ts`, sin correr ingesta ni traducción en el arranque. `KNOWLEDGE_LOCAL_DIR` (`.env.example`) apunta a `dataset-reto/dataset/textos`, solo lo usan los scripts `kb:*`, nunca el runtime de la API.

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
