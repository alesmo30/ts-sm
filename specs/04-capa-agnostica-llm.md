# SPEC 04 — Capa agnóstica de LLM: puerto, drivers y métricas

> **Estado:** Aprobado
> **Depende de:** SPEC 01, SPEC 02
> **Fecha:** 2026-08-06
> **Objetivo:** Construir los tres drivers (`mock`, `anthropic`, `openai`) detrás del `LlmPort` que SPEC 01 dejó como contrato vacío, con selección por `LLM_PROVIDER` resuelta en el bootstrap de Nest, de forma que cambiar de proveedor no exija tocar un solo archivo fuera de `modules/llm`.

---

## Contexto — por qué existe este spec

SPEC 01 creó `modules/llm/` con tres archivos y cero implementación: `llm.port.ts` con un único `complete()`, `llm.types.ts` con `LlmMessage`/`LlmCompletion`/`LlmUsage`/`LlmOptions`, y un `LlmModule` vacío sin providers. Ese vacío fue deliberado: R0.1 de `REGLAS.md` obliga a que todo acceso al LLM pase por un solo módulo, y el modelo obligatorio no se anuncia hasta el 7 de agosto. El puerto existe desde el día uno precisamente para que el modelo real se enchufe después sin tocar los sitios de llamada.

Este spec llena ese vacío. Tres cosas condicionan el trabajo:

- **No hay consumidor todavía.** Ningún controlador ni servicio inyecta `LlmPort` hoy. El primero real llega en SPEC 05 (pipeline de voz). Por eso este spec crea su propia superficie HTTP de verificación: sin ella, el criterio de éxito del bloque T1 solo sería demostrable desde Jest, y el entregable del video necesita mostrarlo en vivo.
- **El modelo obligatorio se desconoce.** Los drivers se escriben contra la API de cada proveedor, no contra un modelo concreto. `LLM_MODEL` es una variable de entorno sin default con significado propio.
- **La API de Groq es compatible con OpenAI.** Por eso el driver `openai` toma `OPENAI_BASE_URL` en vez de hardcodear el host: con esa única variable el mismo driver sirve OpenAI, Groq, y cualquier gateway compatible que aparezca el 7 de agosto.

---

## Alcance

**Dentro:**

- Extensión de `apps/api/src/modules/llm/llm.types.ts`: `LlmDelta` (evento normalizado de streaming), `LlmToolDefinition` y `LlmToolCall` (normalización de `tool_use` de Anthropic vs. `tool_calls` de OpenAI), `LlmStructuredOptions`, y `role: 'tool'` en `LlmMessage`.
- Extensión de `llm.port.ts` con `stream()` y `structured()`, junto al `complete()` existente. `embed()` no entra.
- `drivers/mock.driver.ts`: cuatro respuestas fijas rotativas con retardo simulado, streaming por fragmentos, y `structured()` devolviendo un objeto fijo conforme al schema.
- `drivers/anthropic.driver.ts`: Messages API, `system` como campo separado, `tool_use`/`tool_result`, streaming SSE, `usage.input_tokens`.
- `drivers/openai.driver.ts`: `chat.completions`, `system` como rol dentro del array, `tool_calls`/`role:tool`, streaming SSE, `usage.prompt_tokens`, `baseURL` configurable.
- `registry.ts`: factory provider de Nest que resuelve `LLM_PROVIDER` **una sola vez en el bootstrap** y bindea la clase concreta al token `LlmPort`.
- `parse.ts`: parser JSON tolerante — recupera el objeto cuando el modelo lo envuelve en texto o en vallas de código, y falla con un error explícito cuando no hay JSON recuperable.
- `metrics.ts`: `AsyncLocalStorage` que captura tokens, latencia, costo y TTFT por llamada, más un acumulador en memoria.
- `pricing.ts`: tabla de precios por modelo para `LlmUsage.costUsd`, con `0` como fallback en modelos desconocidos.
- `llm.service.ts`: capa fina entre controlador y puerto, responsable de abrir el scope de métricas y de loguear el `model` de cada llamada (R0.1).
- `llm.controller.ts` con tres rutas: `POST /llm/complete`, `GET /llm/health` (proveedor y modelo activos), `GET /llm/metrics` (acumulado en memoria).
- `LlmModule` cableado y registrado en `AppModule`.
- Variables nuevas en `.env.example`: `LLM_PROVIDER`, `LLM_MODEL`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `OPENAI_BASE_URL`, con `mock` como default funcional.
- Tests Jest: las cuatro respuestas rotativas del mock, los casos de recuperación y de fallo de `parse.ts`, la selección de driver del registry, y `llm.service` con el puerto mockeado.

**Fuera de alcance (para specs posteriores):**

- `embed()` y todo lo relacionado con embeddings o vector store. No son "el LLM" según la zona gris de `REGLAS.md` y su ciclo de vida es distinto. → D3
- El **loop agéntico** de ejecución de herramientas: este spec normaliza los *tipos* de tool calls y los transporta en ambos sentidos, pero nadie ejecuta una herramienta ni reinyecta su resultado. → D3
- Consumo real de `stream()` por el pipeline de voz: segmentación por frase, cola de audio, TTS. → SPEC 05
- Consumo de `structured()` para generar el `SessionSummary` real. Hoy el resumen sigue siendo el stub sembrado. → D3
- Persistencia de métricas en Postgres y cualquier UI que las muestre. El acumulador vive en memoria y se pierde al reiniciar. → D5
- Prompt caching, parámetros de *thinking*/effort y cualquier afinación específica de un proveedor. El puerto expone el mínimo común denominador; afinar exige saber cuál es el modelo obligatorio. → D2, tras el anuncio
- Reintentos, backoff, circuit breaker y rate limiting. Un fallo del proveedor se propaga como error. → D5
- Fallback automático a otro proveedor cuando el primario falla. **Prohibido por R0.1**, no es una omisión: usar un LLM de otro vendor como plan B invalida la entrega.
- Cualquier cambio en `apps/web` o en `packages/shared`.

---

## Modelo de datos

Sin estructuras persistidas. Ninguna migración, ninguna tabla, ningún contrato Zod nuevo en `packages/shared` — los tipos de este spec son internos a `apps/api/src/modules/llm/` porque describen la conversación con el proveedor, no datos que el frontend consuma. Lo único que sale al exterior es el JSON de las tres rutas de verificación, definido al final de esta sección.

### Tipos existentes que se conservan sin cambios

`LlmUsage` (`inputTokens`, `outputTokens`, `costUsd`), `LlmCompletion` (`text`, `model`, `usage`, `latencyMs`) y `LlmOptions` (`temperature`, `maxTokens`) quedan tal como los dejó SPEC 01. `LlmCompletion.model` sigue siendo obligatorio: es lo que hace verificable el "cada llamada loguea el `model` usado" de R0.1.

### Tipos extendidos y nuevos

```ts
// llm.types.ts

// 'tool' es nuevo: transporta el resultado de una herramienta de vuelta al modelo.
// Anthropic lo expresa como un bloque tool_result dentro de un mensaje user;
// OpenAI como un mensaje con role:'tool'. El driver traduce; el puerto no se entera.
export interface LlmMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;   // obligatorio cuando role === 'tool'
  toolCalls?: LlmToolCall[];  // presente cuando role === 'assistant' y el modelo pidió herramientas
}

export interface LlmToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;  // JSON Schema
}

export interface LlmToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;  // ya parseado; OpenAI lo entrega como string
}

// Evento normalizado de streaming. Anthropic emite content_block_delta,
// OpenAI emite choices[].delta — los dos se aplanan a esto.
export type LlmDelta =
  | { type: 'text'; text: string }
  | { type: 'tool_call'; toolCall: LlmToolCall }
  | { type: 'done'; completion: LlmCompletion };

export interface LlmStreamOptions extends LlmOptions {
  tools?: LlmToolDefinition[];
}

export interface LlmStructuredOptions<T> extends LlmOptions {
  schema: ZodType<T>;
  schemaName: string;   // algunos proveedores lo exigen en el json_schema nativo
}

export interface LlmStructured<T> {
  data: T;
  model: string;
  usage: LlmUsage;
  latencyMs: number;
  usedFallbackParser: boolean;  // true si el proveedor no soportó JSON schema nativo
}
```

`usedFallbackParser` no es decorativo: es lo que hace verificable el criterio de aceptación "`structured()` recupera JSON válido incluso sin schema nativo". Sin ese booleano, un `structured()` que funciona por el camino nativo y uno que funciona por el parser tolerante son indistinguibles desde fuera.

### Puerto extendido

```ts
// llm.port.ts
export abstract class LlmPort {
  abstract complete(messages: LlmMessage[], options?: LlmOptions): Promise<LlmCompletion>;
  abstract stream(messages: LlmMessage[], options?: LlmStreamOptions): AsyncIterable<LlmDelta>;
  abstract structured<T>(messages: LlmMessage[], options: LlmStructuredOptions<T>): Promise<LlmStructured<T>>;
  abstract readonly providerName: 'mock' | 'anthropic' | 'openai';
  abstract readonly modelId: string;
}
```

`providerName` y `modelId` son de solo lectura y existen para que `GET /llm/health` responda sin adivinar y sin releer el entorno.

### Métricas en memoria

```ts
// metrics.ts
export interface LlmCallMetric {
  at: string;            // ISO 8601
  provider: string;
  model: string;
  method: 'complete' | 'stream' | 'structured';
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
  ttftMs: number | null;  // null salvo en stream()
  ok: boolean;
}

export interface LlmMetricsSnapshot {
  totalCalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
  recent: LlmCallMetric[];   // buffer circular, últimas 50
}
```

Buffer acotado a 50 entradas a propósito: es un proceso de larga vida y un array sin tope es una fuga de memoria lenta. Se pierde todo al reiniciar, y eso está aceptado — la persistencia de métricas es D5.

### Precios

```ts
// pricing.ts
export interface ModelPricing {
  inputPerMTokUsd: number;
  outputPerMTokUsd: number;
}

export const PRICING: Record<string, ModelPricing> = { /* ... */ };
export function priceFor(model: string): ModelPricing;  // devuelve {0, 0} si el modelo no está en la tabla
```

La tabla se llena con los modelos que se conozcan al implementar. Un modelo ausente **no es un error**: devuelve costo `0` y el resto de la métrica sigue siendo válida. El 7 de agosto, cuando se anuncie el modelo obligatorio, agregarlo es una línea.

### Variables de entorno

| Variable | Default | Obligatoria | Notas |
|---|---|---|---|
| `LLM_PROVIDER` | `mock` | no | `mock` \| `anthropic` \| `openai`. Un valor fuera de esos tres aborta el arranque. |
| `LLM_MODEL` | — | solo si el proveedor no es `mock` | Sin default. Ningún identificador de modelo aparece hardcodeado en el código. |
| `ANTHROPIC_API_KEY` | — | solo si `LLM_PROVIDER=anthropic` | |
| `OPENAI_API_KEY` | — | solo si `LLM_PROVIDER=openai` | |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | no | Apuntar a `https://api.groq.com/openai/v1` u otro gateway compatible. |

La validación ocurre **en el bootstrap, no en la primera llamada**: si `LLM_PROVIDER=openai` y falta `OPENAI_API_KEY`, el proceso no arranca y dice cuál variable falta. Un contenedor mal configurado que arranca sano y falla treinta minutos después, en medio del demo, es el peor de los dos fallos.

### Forma de las respuestas HTTP

```ts
// GET /llm/health
{ provider: 'openai', model: 'openai/gpt-oss-120b', ready: true }

// POST /llm/complete  — body: { messages: LlmMessage[], options?: LlmOptions }
{ text: '...', model: '...', usage: { inputTokens, outputTokens, costUsd }, latencyMs }

// GET /llm/metrics
LlmMetricsSnapshot
```

Los tres se validan con `ZodValidationPipe` en la entrada, siguiendo el patrón de SPEC 02. Los esquemas viven en `modules/llm/dto/`, **no** en `packages/shared`: son superficie de diagnóstico interna, no contrato con el frontend.

---

## Plan de implementación

Once pasos. Cada uno deja el sistema arrancable y commiteable. Los drivers van en orden de verificabilidad: `mock` primero porque no necesita red, `openai` segundo porque es el que se puede probar hoy contra Groq, `anthropic` tercero.

1. **Configuración y validación de entorno.**
   Agregar `LLM_PROVIDER`, `LLM_MODEL`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` y `OPENAI_BASE_URL` a `.env.example` con `LLM_PROVIDER=mock`. Crear `modules/llm/llm.config.ts` con un esquema Zod que valide el entorno y aplique las reglas condicionales de la tabla del modelo de datos (`LLM_MODEL` obligatorio salvo en `mock`, cada key obligatoria solo para su proveedor). Todavía no lo consume nadie.
   *Verificación:* `pnpm --filter api build` compila; `docker compose up` arranca igual que antes.

2. **Extender contrato y tipos.**
   Añadir a `llm.types.ts` los tipos de la sección de modelo de datos: `role: 'tool'` y los campos opcionales en `LlmMessage`, más `LlmToolDefinition`, `LlmToolCall`, `LlmDelta`, `LlmStreamOptions`, `LlmStructuredOptions`, `LlmStructured`. Añadir a `llm.port.ts` las firmas de `stream()`, `structured()`, `providerName` y `modelId`.
   *Verificación:* `pnpm typecheck` pasa. No hay implementaciones aún y eso es correcto: `LlmPort` es una clase abstracta sin providers registrados.

3. **Parser JSON tolerante.**
   `parse.ts` con `parseTolerantJson(raw: string): unknown`. Orden de intentos: `JSON.parse` directo; extracción del contenido de una valla de código ` ```json `; extracción del primer objeto balanceado por conteo de llaves respetando comillas y escapes. Si los tres fallan, lanza un error que incluye los primeros 200 caracteres del texto recibido.
   *Verificación:* `parse.spec.ts` cubre los tres caminos de éxito, el caso de llaves dentro de un string, y el fallo con mensaje explícito. `pnpm --filter api test -- parse`.

4. **Tabla de precios.**
   `pricing.ts` con `PRICING` y `priceFor(model)`. Poblar con los modelos conocidos al momento de implementar. `priceFor` devuelve `{ inputPerMTokUsd: 0, outputPerMTokUsd: 0 }` para modelos ausentes, sin lanzar.
   *Verificación:* test de que un modelo conocido devuelve su precio y uno inventado devuelve ceros.

5. **Métricas.**
   `metrics.ts`: `AsyncLocalStorage<LlmCallContext>` para capturar inicio, TTFT y fin de cada llamada; `recordCall()` que calcula el costo con `priceFor()`; acumulador en memoria con buffer circular de 50 entradas y `getSnapshot(): LlmMetricsSnapshot`. Registrado como provider de Nest con estado de instancia, no como singleton de módulo global.
   *Verificación:* test que registra tres llamadas y comprueba totales y longitud del buffer; test que verifica que la entrada 51 desaloja la primera.

6. **Driver mock.**
   `drivers/mock.driver.ts` implementando los tres métodos. Cuatro respuestas fijas rotativas —no más, es el riesgo de sobrediseño ya identificado en el plan del día—. `complete()` con retardo simulado; `stream()` emitiendo la misma respuesta troceada por palabras con retardo entre fragmentos y un `done` final; `structured()` devolviendo un objeto que satisface el schema recibido, con `usedFallbackParser: false`. `providerName = 'mock'`, `modelId = 'mock'`.
   *Verificación:* `mock.driver.spec.ts` comprueba que cuatro llamadas consecutivas devuelven las cuatro respuestas y la quinta vuelve a la primera; que `stream()` termina en `done` y que la concatenación de los deltas de texto iguala el `text` del `completion`.

7. **Registry y cableado del módulo.**
   `registry.ts` exportando un factory provider que lee la configuración validada del paso 1 y devuelve la instancia del driver. `llm.module.ts` registra `{ provide: LlmPort, useFactory }`, `MetricsService`, y exporta `LlmPort`. Registrar `LlmModule` en `AppModule`. Solo `mock` está en el registry por ahora; los otros dos lanzan un error de "driver no implementado todavía" explícito.
   *Verificación:* `registry.spec.ts` comprueba que `LLM_PROVIDER=mock` devuelve el driver mock y que un valor inválido aborta. La app arranca y `LlmPort` es inyectable.

8. **Servicio, DTOs y rutas de verificación.**
   `dto/complete.dto.ts` con el esquema Zod del body. `llm.service.ts` envolviendo el puerto: abre el scope de métricas, delega, registra la métrica y loguea `provider`, `model`, tokens y latencia vía el `Logger` de Nest (R0.1). `llm.controller.ts` con `POST /llm/complete` (usando `ZodValidationPipe`), `GET /llm/health` y `GET /llm/metrics`.
   *Verificación:* con `docker compose up`, `curl -X POST localhost:3000/llm/complete -H 'content-type: application/json' -d '{"messages":[{"role":"user","content":"hola"}]}'` devuelve una de las cuatro respuestas mock; `GET /llm/health` devuelve `{"provider":"mock","model":"mock","ready":true}`; `GET /llm/metrics` refleja la llamada anterior. `llm.service.spec.ts` con el puerto mockeado.

9. **Driver OpenAI.**

   **9.0 — Sonda de capacidades (primero, antes de escribir código).** Contra la API de Groq con la key real: listar `GET /v1/models` para conocer el catálogo disponible, y probar el modelo candidato con una petición que incluya `tools` y otra que incluya `response_format: { type: 'json_schema' }`. Anotar en este spec qué respondió cada una. Si el modelo candidato falla en ambas, elegir otro del catálogo. Los criterios de aceptación que dependen de features reales se ajustan según ese resultado, y el ajuste queda registrado como fricción en `plan/01-jueves/D1-jue-06-ago.md`.

   **9.1 — Implementación.** `drivers/openai.driver.ts` contra `chat.completions`, con `baseURL` desde `OPENAI_BASE_URL`. Traduce: `system` como primer mensaje del array; `LlmToolDefinition` a `tools[].function`; `tool_calls` de la respuesta a `LlmToolCall` parseando `arguments` con `parseTolerantJson`; `role: 'tool'` con `tool_call_id`. `stream()` consume SSE y aplana `choices[].delta` a `LlmDelta`, marcando el TTFT en el primer fragmento de texto. `structured()` intenta `response_format: { type: 'json_schema' }` con el schema convertido por `zod-to-json-schema`; si el proveedor lo rechaza, reintenta con `json_object` más instrucción en el system prompt y pasa el resultado por `parseTolerantJson`, marcando `usedFallbackParser: true`. En ambos casos valida con el Zod recibido antes de devolver. Agregar `zod-to-json-schema` a `apps/api/package.json`. Registrarlo en el registry.

   *Verificación:* con `LLM_PROVIDER=openai`, `OPENAI_BASE_URL=https://api.groq.com/openai/v1`, `OPENAI_API_KEY` y `LLM_MODEL` reales en `.env`, las tres rutas responden contra el proveedor real. `git diff --stat` del paso confirma que no se tocó ningún archivo fuera de `modules/llm` salvo `package.json` y `.env.example`.

   **Resultado de la sonda 9.0 (2026-08-06, contra Groq real):** `GET /v1/models` lista tres variantes `gpt-oss` (`openai/gpt-oss-120b`, `openai/gpt-oss-20b`, `openai/gpt-oss-safeguard-20b`), las tres con `supported_features: ["tools", "json_mode", "structured_outputs", "reasoning"]`. Se eligió `openai/gpt-oss-120b` como modelo candidato. Prueba de `tools`: una petición con una función `get_weather` devolvió `finish_reason: "tool_calls"` y `message.tool_calls[0].function.arguments` como el string `"{\"city\":\"Bogotá\"}"` — soportado de forma nativa. Prueba de `response_format: { type: 'json_schema' }`: devolvió `message.content` como el string `"{\"greeting\":\"¡Hola!\",\"count\":0}"`, JSON válido y conforme al schema pedido — soportado de forma nativa. Conclusión: **no hace falta el camino de fallback (`usedFallbackParser: true`) para el caso feliz de este modelo**; el criterio de aceptación que exige ejercitar el fallback se cubre forzando el modo `json_object` explícitamente en un caso de prueba dedicado, no porque el modelo lo requiera para uso normal. Nota adicional no prevista: la respuesta incluye un campo `message.reasoning` (cadena de razonamiento en texto libre) además de `content`/`tool_calls`; el driver lo ignora — no forma parte de ningún tipo de `LlmMessage`/`LlmCompletion` de este spec.

10. **Driver Anthropic.**
    `drivers/anthropic.driver.ts` contra la Messages API. Traduce: mensajes con `role: 'system'` se extraen al parámetro `system` de nivel superior; `LlmToolDefinition` a `tools[]` con `input_schema`; bloques `tool_use` de la respuesta a `LlmToolCall`; `role: 'tool'` a un mensaje `user` con un bloque `tool_result`. `stream()` consume SSE y aplana `content_block_delta` a `LlmDelta`. `usage.input_tokens`/`output_tokens` a `LlmUsage`. `structured()` vía tool forzado con el JSON Schema convertido, con el mismo fallback al parser tolerante. Registrarlo en el registry.
    *Verificación:* `pnpm typecheck` y `pnpm test` pasan. Prueba end-to-end solo si hay una key de Anthropic disponible; si no, queda cubierto por test unitario con `fetch` mockeado y se anota como fricción en el archivo del día.

11. **Documentación y cierre.**
    Bloque en el `README.md` explicando cómo cambiar de proveedor: las tres variables, el ejemplo de Groq como gateway compatible con OpenAI, y la advertencia de que el `.env` entregado debe apuntar al modelo obligatorio (R0.1). Anotar en `plan/01-jueves/D1-jue-06-ago.md` las fricciones que hayan aparecido.
    *Verificación:* alguien que no escribió el código cambia de proveedor siguiendo solo el README.

---

## Criterios de aceptación

### Contrato y tipos

- [ ] `LlmPort` declara `complete()`, `stream()`, `structured()`, `providerName` y `modelId`, y no declara `embed()`.
- [ ] `LlmMessage` acepta `role: 'tool'` con `toolCallId`, y `role: 'assistant'` con `toolCalls`.
- [ ] `pnpm typecheck` pasa en todos los workspaces.
- [ ] `packages/shared` no cambió: `git diff --stat main -- packages/shared` no reporta líneas.

### Driver mock

- [ ] Con `LLM_PROVIDER=mock` (el default de `.env.example`), la API arranca sin ninguna key configurada.
- [ ] Cuatro llamadas consecutivas a `POST /llm/complete` devuelven cuatro textos distintos; la quinta repite el texto de la primera.
- [ ] `stream()` del mock emite al menos dos deltas de tipo `text` antes del delta `done`.
- [ ] Concatenar los deltas `text` de una llamada a `stream()` produce exactamente el `text` del `completion` que trae el delta `done`.

### Parser tolerante

- [ ] `parseTolerantJson('{"a":1}')` devuelve `{ a: 1 }`.
- [ ] `parseTolerantJson` recupera el objeto cuando viene envuelto en una valla de código ` ```json `.
- [ ] `parseTolerantJson` recupera el objeto cuando viene precedido y seguido de texto en prosa.
- [ ] `parseTolerantJson` recupera correctamente un objeto que contiene una llave `}` dentro de un valor string.
- [ ] `parseTolerantJson('lo siento, no puedo')` lanza un error cuyo mensaje incluye parte del texto recibido.

### Precios y métricas

- [ ] `priceFor()` con un modelo ausente de la tabla devuelve ceros y no lanza.
- [ ] Tras N llamadas, `GET /llm/metrics` reporta `totalCalls === N`.
- [ ] `GET /llm/metrics` reporta `totalInputTokens` y `totalOutputTokens` mayores que cero tras una llamada real a un proveedor.
- [ ] El buffer `recent` nunca supera 50 entradas: tras 51 llamadas, `recent.length === 50` y la primera llamada ya no aparece.
- [ ] Cada entrada de `recent` trae `provider`, `model`, `latencyMs` y `ok`.
- [ ] Una llamada a `stream()` produce una métrica con `ttftMs` no nulo; una a `complete()`, con `ttftMs` nulo.
- [ ] Cada llamada emite una línea de log de Nest que incluye el `model` usado (R0.1).

### Configuración y arranque

- [ ] `LLM_PROVIDER=basura` aborta el arranque con un mensaje que nombra la variable inválida.
- [ ] `LLM_PROVIDER=openai` sin `OPENAI_API_KEY` aborta el arranque nombrando la variable faltante, **antes** de atender la primera petición.
- [ ] `LLM_PROVIDER=openai` sin `LLM_MODEL` aborta el arranque nombrando la variable faltante.
- [ ] `LLM_PROVIDER=mock` sin `LLM_MODEL` arranca correctamente.
- [ ] `.env.example` contiene las cinco variables, con `LLM_PROVIDER=mock` y las tres credenciales vacías.

### Rutas de verificación

- [ ] `GET /llm/health` devuelve `provider`, `model` y `ready`, y sus valores coinciden con el `.env` activo.
- [ ] `POST /llm/complete` con un body inválido (sin `messages`) devuelve 400 vía `ZodValidationPipe`, no 500.
- [ ] `POST /llm/complete` devuelve `text`, `model`, `usage` y `latencyMs`, con `latencyMs > 0`.
- [ ] Las tres rutas están registradas bajo `LlmModule` y este está importado en `AppModule`.

### Driver OpenAI, verificado contra Groq

- [ ] Con `LLM_PROVIDER=openai`, `OPENAI_BASE_URL=https://api.groq.com/openai/v1`, `OPENAI_API_KEY` y `LLM_MODEL` reales, `GET /llm/health` reporta ese proveedor y ese modelo.
- [ ] `POST /llm/complete` devuelve una respuesta generada por el modelo real, no una de las cuatro del mock.
- [ ] La métrica de esa llamada reporta un `costUsd` coherente con la tabla de precios, o `0` si el modelo no está en ella.
- [ ] `structured()` con un schema Zod simple devuelve un objeto que pasa la validación de ese schema.
- [ ] Existe al menos un caso probado en el que `structured()` devuelve `usedFallbackParser: true` y aun así el objeto valida — es decir, el camino del parser tolerante está ejercitado, no solo escrito.
- [ ] Un `LlmToolDefinition` enviado a `stream()` produce un delta `tool_call` con `arguments` ya parseado como objeto, no como string.

### Driver Anthropic

- [ ] Un mensaje con `role: 'system'` se envía en el parámetro `system` de nivel superior, no dentro del array de mensajes. Verificable por test unitario con `fetch` mockeado inspeccionando el body.
- [ ] Un mensaje con `role: 'tool'` se traduce a un mensaje `user` con un bloque `tool_result` que conserva el `toolCallId`.
- [ ] `usage.input_tokens` de la respuesta llega a `LlmUsage.inputTokens`.
- [ ] Si hay una key de Anthropic disponible, `POST /llm/complete` responde end-to-end. Si no la hay, queda cubierto por test unitario y se registra como fricción en `plan/01-jueves/D1-jue-06-ago.md`.

### Agnosticismo — el criterio central del bloque T1

- [ ] Cambiar de `LLM_PROVIDER=mock` a `LLM_PROVIDER=openai` y reiniciar el contenedor cambia el comportamiento de `POST /llm/complete` **sin editar ningún archivo `.ts`**.
- [ ] `git diff --stat` entre el commit del paso 8 y el del paso 9 no toca ningún archivo fuera de `apps/api/src/modules/llm/`, salvo `apps/api/package.json` y `.env.example`.
- [ ] `grep -rn "anthropic\|openai\|groq\|@google" apps/api/src --include=*.ts | grep -v "modules/llm"` no devuelve resultados.
- [ ] Ningún identificador de modelo aparece hardcodeado fuera de `pricing.ts`: `grep -rn "gpt-\|claude-" apps/api/src --include=*.ts | grep -v pricing.ts` no devuelve resultados.
- [ ] Ningún módulo fuera de `modules/llm` importa un SDK de LLM ni hace `fetch` a un endpoint de proveedor.

### Higiene

- [ ] `pnpm lint` pasa sin advertencias nuevas.
- [ ] `pnpm test` pasa: los specs de `parse`, `pricing`, `metrics`, `mock.driver`, `registry`, `llm.service` y los dos drivers reales con `fetch` mockeado.
- [ ] `docker compose down -v && docker compose up` desde limpio arranca los tres servicios y `GET /llm/health` responde, sin ninguna credencial configurada.
- [ ] `.env` no está commiteado.

---

## Decisiones tomadas y descartadas

### 1. El puerto expone `complete()`, `stream()` y `structured()`. `embed()` queda fuera

`stream()` entra porque el segmentador por frase de SPEC 05 consume deltas, no respuestas completas: sin él, el TTS espera a que el modelo termine y la voz arranca con segundos de silencio. `structured()` entra porque el `SessionSummary` del contrato tiene forma fija y la alternativa —parsear texto libre con expresiones regulares— es la clase de fragilidad que revienta en demo.

**Descartado:** meter `embed()` en el mismo puerto. El plan original de D1 ya lo excluía explícitamente y la razón se sostiene: los embeddings no son "el LLM" según la zona gris de `REGLAS.md`, su proveedor se elige por separado, y su ciclo de vida (indexación por lotes, versionado de la base de conocimiento) no se parece en nada al de una conversación. Mezclarlos ataría la elección del vector store a la del modelo obligatorio.

### 2. El proveedor se resuelve una vez en el bootstrap, no por petición

`registry.ts` es un factory provider de Nest que lee `LLM_PROVIDER`, construye el driver y lo bindea al token `LlmPort`. Todo lo demás inyecta `LlmPort` y nunca sabe cuál llegó.

**Descartado:** un `LlmRegistry` que resolviera el driver en cada llamada. Habría permitido cambiar de proveedor sin reiniciar, que suena bien y no lo necesita nadie: obliga a cada sitio de llamada a pedir el driver en vez de recibirlo inyectado, lo cual es exactamente el acoplamiento que el puerto existe para evitar. La resolución en bootstrap además permite validar credenciales al arrancar (decisión 6).

### 3. El driver `openai` lee `OPENAI_BASE_URL`

Default `https://api.openai.com/v1`. Apuntarlo a `https://api.groq.com/openai/v1` hace que el mismo driver sirva Groq, y con él cualquier gateway compatible con OpenAI. Es una línea de código y el retorno es doble: permite verificar el driver end-to-end hoy con una key de Groq, y cubre el escenario de que el modelo obligatorio del 7 de agosto se sirva tras un gateway compatible.

**Descartado:** un cuarto driver `groq.driver.ts`. Sería una copia del de OpenAI con otra URL —el protocolo es el mismo— y triplicaría el mantenimiento de la normalización de `tool_calls` y del streaming.

### 4. Se prueba contra un proveedor real hoy, con Groq, antes de conocer el modelo obligatorio

`REGLAS.md` R0.1 exige que el 100% de la generación de lenguaje se ejecute con el modelo obligatorio. Probar contra Groq en desarrollo, el 6 de agosto, con el anuncio pendiente para el 7, no lo viola: el punto entero del spec es que el proveedor sea intercambiable, y validar esa intercambiabilidad exige haber intercambiado al menos una vez. Lo que sí sería una violación es que el `.env.example` entregado, el README o el video apunten a otra cosa que el modelo obligatorio.

**Descartado:** desarrollar solo contra `mock` hasta el 7 de agosto. Habría dejado los dos drivers reales sin ejecutarse nunca, y el día del anuncio —con el reloj corriendo— se habrían descubierto de golpe todas las diferencias entre lo que dice la documentación de cada proveedor y lo que hace su API. El costo de la alternativa es tiempo el día peor, y el beneficio es cero.

### 5. Las rutas de verificación son permanentes, no un andamio temporal

`GET /llm/health`, `POST /llm/complete` y `GET /llm/metrics` se quedan. Son la única forma de demostrar el criterio de éxito del bloque T1 —cambiar de proveedor sin tocar código— en el navegador y en el video del entregable; desde Jest solo se demuestra a quien lea el código. `GET /llm/metrics` además le sirve a SPEC 05 para el criterio "el log de cada turno reporta TTFT".

**Descartado:** cubrirlo solo con tests, y marcar las rutas como temporales para borrarlas en SPEC 05. Lo primero deja el entregable sin demostración visible; lo segundo produce endpoints huérfanos que nadie borra —ya hay uno documentado en este proyecto, `GET /patients/priority/:id`.

### 6. La validación del entorno ocurre al arrancar, no en la primera llamada

Si `LLM_PROVIDER=openai` y falta `OPENAI_API_KEY`, el proceso no arranca y dice qué variable falta.

**Descartado:** validación perezosa en la primera petición. Un contenedor que arranca sano, pasa el healthcheck, y falla media hora después en mitad de una demo es peor que uno que se niega a arrancar. `LLM_MODEL` sigue la misma regla, con la excepción de `mock`, que no lo necesita.

### 7. Los tipos de herramientas entran; su ejecución no

El puerto modela `LlmToolDefinition` y `LlmToolCall`, y los drivers los traducen en ambos sentidos (`tool_use`/`tool_result` de Anthropic, `tool_calls`/`role:tool` de OpenAI). Nadie ejecuta una herramienta ni reinyecta su resultado.

**Descartado:** dejar las herramientas fuera por completo hasta D3. Añadir estos tipos después de que existan tres drivers implica reabrir los tres y su normalización, que es la parte cara. Añadir el loop de ejecución, en cambio, no toca los drivers: vive en el consumidor. Modelar ahora lo caro y diferir lo barato.

### 8. `structured()` recibe un esquema Zod, convertido a JSON Schema con `zod-to-json-schema`

Zod ya es dependencia del proyecto y `packages/shared` está construido sobre él, así que el mismo esquema sirve para pedirle la forma al proveedor y para validar lo que devuelve. Se agrega `zod-to-json-schema` a `apps/api` porque el proyecto declara `zod@^3.23.0` (resuelve a 3.25.76) y `z.toJSONSchema()` no existe en el import por defecto de Zod 3 — llegó en Zod 4.

**Descartado, dos alternativas.** Escribir el JSON Schema a mano junto a cada esquema Zod: duplica la definición y garantiza que se desincronicen. Subir el proyecto a Zod 4: toca `packages/shared`, `apps/api` y `apps/web` a mitad de sprint, por un beneficio que una dependencia de pocos kilobytes ya cubre.

### 9. El parser tolerante es fallback, no camino principal

`structured()` intenta primero el modo nativo del proveedor (`json_schema` en OpenAI, tool forzado en Anthropic). Solo si el proveedor lo rechaza cae al modo `json_object` más `parseTolerantJson`, y lo señala con `usedFallbackParser: true`. En los dos caminos se valida con el Zod recibido antes de devolver.

**Descartado:** usar siempre el parser tolerante por uniformidad. El modo nativo da garantías que el parseo posterior no puede dar; renunciar a ellas para que los dos proveedores se comporten igual es igualar por abajo. El booleano existe para que la diferencia sea observable y el camino de fallback sea verificable —sin él, un fallback roto solo se descubre el día que el proveedor cambia de comportamiento.

### 10. Las métricas viven en memoria, en un buffer de 50

`totalCalls`, `totalCostUsd` y los totales de tokens son acumuladores; `recent` es un buffer circular acotado.

**Descartado:** persistirlas en Postgres. Habría exigido tabla, migración y repositorio para un dato que hoy nadie consulta después del hecho; el spec de auditoría y observabilidad es D5. **Descartado también:** un array sin tope. Es un proceso de larga vida y un array que solo crece es una fuga de memoria lenta, del tipo que aparece en la demo larga y no en las pruebas cortas.

### 11. Existe `llm.service.ts` entre el controlador y el puerto

`CLAUDE.md` fija la capa controlador → servicio → repositorio y este es el primer módulo nuevo desde que esa convención se estableció. El servicio abre el scope de métricas y emite el log del `model` de R0.1, de modo que esa obligación se cumple en un solo sitio y no en cada driver.

**Descartado:** que el controlador inyecte `LlmPort` directamente. Son menos archivos y rompe la convención en el ejemplo que los siguientes módulos van a copiar. Además dispersaría el logging de R0.1 por los tres drivers, donde es fácil olvidarlo al agregar el cuarto.

### 12. No hay fallback automático a otro proveedor

Si el proveedor configurado falla, el error se propaga.

**Descartado por regla, no por tiempo.** `REGLAS.md` marca "LLM de otro vendor como fallback" con un ❌ explícito, "ni siquiera como plan B". Es la trampa natural de una capa agnóstica —si Anthropic cae, prueba OpenAI— y construirla invalidaría la entrega. Queda escrito aquí precisamente para que nadie lo agregue como mejora obvia en D5. Reintentos contra el *mismo* proveedor no están prohibidos, pero también quedan fuera de este spec.

### 13. El mock devuelve cuatro respuestas fijas rotativas

Sin plantillas, sin lógica condicional según el prompt, sin memoria de conversación.

**Descartado:** un mock que "entienda" la pregunta y responda algo plausible. El plan del día ya identificó "sobrediseñar el mock" como riesgo con nombre propio. Su trabajo es probar que la tubería funciona, y para eso cuatro respuestas y un retardo simulado bastan. Cada hora invertida en hacerlo listo es una hora que no está en el pipeline de voz, que es el bloque de riesgo real.

### 14. Los DTOs de las rutas viven en `modules/llm/dto/`, no en `packages/shared`

Son superficie de diagnóstico interna del backend. Ningún componente de `apps/web` los consume ni va a consumirlos.

**Descartado:** ponerlos en `packages/shared` por consistencia con los contratos de SPEC 02. Ese paquete es el contrato front↔back; meter ahí tipos que el front nunca ve lo diluye, y además obliga a `pnpm --filter shared build` en cada iteración sobre un DTO de diagnóstico.

### 15. `LLM_MODEL` no tiene valor por defecto

Ningún identificador de modelo aparece hardcodeado fuera de `pricing.ts`, y allí ausente significa costo cero, no error.

**Descartado:** un default razonable por proveedor. Un default es un modelo que alguien va a usar sin darse cuenta, y el 7 de agosto eso significa violar R0.1 en silencio. Sin default, arrancar con un proveedor real obliga a decir cuál modelo, en voz alta, en el `.env`.

---

## Riesgos identificados

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| **El modelo obligatorio del 7 de agosto no encaja en el puerto.** Podría servirse solo a través de Bedrock, Vertex o un SDK propietario, o exigir parámetros que ninguno de los tres drivers modela (razonamiento, *effort*, cachés de prompt). | Media | El puerto expone el mínimo común denominador y `LlmOptions` es un objeto extensible: agregar un campo opcional no rompe a nadie. Si el proveedor resulta ser nuevo, el trabajo es un cuarto archivo en `drivers/` y una línea en `registry.ts` — que es exactamente el escenario para el que se construye este spec. Lo que sí obligaría a reabrirlo es que el proveedor no exponga streaming; en ese caso `stream()` se implementa devolviendo un único delta con la respuesta completa y SPEC 05 pierde la segmentación por frase, no la funcionalidad. |
| **No está verificado qué features soporta el modelo de Groq elegido.** `json_schema` nativo y `tool_calls` pueden estar o no disponibles para `openai/gpt-oss-120b`; se determina con la sonda del paso 9.0, no por suposición. Tres criterios de aceptación dependen de ejercitarlos contra un proveedor real. | Por determinar | Ninguno de los dos bloquea el spec. Si falta `json_schema`, el fallo *es* el camino feliz: fuerza `usedFallbackParser: true`, que es justamente lo que un criterio de aceptación exige verificar. Si falta `tool_calls`, el criterio del delta `tool_call` baja a test unitario con `fetch` mockeado y se registra como fricción. Si el modelo elegido no soporta ninguno de los dos, la sonda del paso 9.0 permite cambiar a otro modelo del catálogo de Groq antes de escribir una línea del driver. |
| **El parseo de SSE a mano es la parte más frágil del spec.** Dos formatos distintos (`content_block_delta` de Anthropic, `choices[].delta` de OpenAI), fragmentación arbitraria de los chunks TCP, líneas `data:` partidas a la mitad, el centinela `[DONE]` de OpenAI. | Alta | Usar el SDK oficial de cada proveedor en lugar de `fetch` crudo: los dos exponen iteradores asíncronos ya resueltos y el driver solo traduce sus eventos a `LlmDelta`. Esto no viola R0.1 —los SDKs viven dentro de `modules/llm`, que es precisamente donde el `grep` de verificación permite que estén—. Si un SDK resulta pesado o problemático en el contenedor, el plan B es `fetch` más un acumulador de líneas probado por unidad, con timebox de 30 minutos antes de volver al SDK. |
| **Se agotan los créditos o el rate limit de Groq a mitad de la verificación.** | Media | Los criterios que exigen proveedor real son seis de cuarenta; el resto corre contra `mock` y tests. Si Groq se corta, esos seis quedan pendientes y se retoman cuando haya credenciales, sin bloquear los pasos 10 y 11. Poner un límite de gasto al crear la cuenta, como ya recomendaba el plan del día para Deepgram y Azure. |
| **La API key se commitea por accidente.** El repositorio es público. | Baja pero de consecuencia alta | `.env` ya está en `.gitignore` desde SPEC 01 y hay un criterio de aceptación que lo verifica. Al terminar el paso 9, revisar `git log -p` del rango del spec buscando `gsk_`, `sk-ant-` y `sk-`. Si una key llega a `main`, rotarla en el proveedor es la primera acción, antes de reescribir historia. |
| **Nueve implementaciones (tres métodos por tres drivers) consumen la tarde entera** y dejan sin tiempo el pipeline de voz, que es el bloque de mayor riesgo del día. | Media | El corte natural es el paso 8: ahí ya hay un sistema demostrable end-to-end con `mock` y cero credenciales. Los pasos 9 y 10 se pueden mover a D2 sin dejar nada a medias. Si el reloj aprieta, el orden de sacrificio es: primero `structured()` del driver Anthropic, luego el driver Anthropic completo, nunca el bloque de agnosticismo de los criterios de aceptación. |
| **Coexisten `zod@3.25.76` y `zod@4.4.3` en `node_modules/.pnpm`.** Si `zod-to-json-schema` resuelve contra la v4 mientras los contratos usan la v3, los esquemas serían instancias incompatibles y el fallo aparecería en runtime, no en `typecheck`. | Media | Fijar `zod-to-json-schema` a la versión compatible con Zod 3 y verificar con `pnpm why zod` tras instalarlo. El primer test de `structured()` con un esquema importado de `packages/shared` detecta el problema de inmediato — escribirlo antes que el driver, no después. |
| **`stream()` se diseña sin consumidor y SPEC 05 lo encuentra inadecuado.** Es el riesgo estructural de definir una API que nadie usa todavía. | Media | `LlmDelta` es una unión discriminada: agregar una variante en SPEC 05 no rompe a los consumidores existentes. El criterio de aceptación que exige que la concatenación de los deltas iguale el `text` final fija la garantía que el segmentador por frase necesita de verdad. Aceptado como deuda conocida: si SPEC 05 exige cambiar la forma de `LlmDelta`, se cambia allí y se anota como fricción. |
