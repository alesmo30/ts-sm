# SPEC 05 — Chat del paciente en tiempo real sobre `LlmPort`

> **Estado:** Implementado (2026-08-06) — los 10 pasos del plan completados, criterios de aceptación verificados uno por uno en Chrome contra `docker compose` y con `LLM_PROVIDER=openai` apuntando a Groq (`openai/gpt-oss-120b`) para el bloque de criterios de LLM real.
> **Depende de:** SPEC 02, SPEC 04
> **Fecha:** 2026-08-06
> **Objetivo:** Convertir `/paciente` en una conversación real de texto contra `LlmPort.stream()` a través de un gateway WebSocket, con cada turno persistido en vivo y la sesión cerrada y visible en el dashboard del médico al salir.

---

## Verificación contra Groq real (2026-08-06)

Con `LLM_PROVIDER=openai`, `OPENAI_BASE_URL=https://api.groq.com/openai/v1`, `LLM_MODEL=openai/gpt-oss-120b` y la key real de Groq: una conversación completa en `/paciente` respondió en streaming, con `GET /llm/health` reportando `provider:"openai"` y `GET /llm/metrics` registrando tokens, latencia (1260ms) y TTFT (684ms) reales tras la llamada. Se probó deliberadamente una pregunta de alarma ("Tengo sangrado abundante y fiebre muy alta, ¿qué hago?"): la respuesta abrió con el disclaimer de asistente automatizado, calificó la situación como señal de alarma, indicó llamar a emergencias/urgencias y avisar al médico de referencia — sin diagnosticar ni sugerir medicación, conforme a RC.1/RC.4/RC.5/RC.8 de `REGLAS.md` y al `SYSTEM_PROMPT`. La sesión se cerró con el modal de salida y apareció en el dashboard del médico con su resumen generado por el modelo real. Tras la verificación, `.env` se devolvió a `LLM_PROVIDER=mock` (el default documentado del repo).

---

## Contexto — por qué existe este spec

SPEC 04 dejó `LlmPort` con `complete()`, `stream()` y `structured()` implementados por tres drivers, y **cero consumidores**: ningún servicio del dominio lo inyecta. SPEC 03 dejó las vistas del médico completas, pero todas leen datos sembrados. `/paciente` sigue siendo la pantalla estática de SPEC 01: el botón `Comenzar` no hace nada.

Este spec cierra el circuito. Es el primero en el que un dato **nacido de una conversación real** llega a la vista del médico.

El plan del día (D1, bloques T2 y T3) juntaba en un solo spec el pipeline de voz completo —captura de audio, STT, TTS, gateway— y la vista paciente entera. Ese bloque es el de mayor riesgo del día y su verificación depende de APIs externas vivas. Se partió en dos:

- **Este spec (05)** construye la conversación: gateway WebSocket, streaming de deltas, persistencia turno a turno, cierre de sesión. Todo en modo texto, que RA.6 exige que exista de todas formas.
- **SPEC 06** le enchufa la voz encima (Deepgram STT + Deepgram Aura-2 TTS) a un chat que ya funciona.

La razón de la partición no es de tamaño, es de riesgo: al terminar este spec hay una demo end-to-end real —escribir, recibir respuesta en streaming, cerrar, ver la sesión en el dashboard— **aunque el audio nunca llegue a funcionar**. El orden inverso deja la tarde entera dependiendo de que un WebSocket de terceros se porte bien.

Consecuencia de numeración: el spec de conocimiento en caliente, descrito como "SPEC 06" en `plan/SPECS-PENDIENTES.md`, pasa a ser **SPEC 07**.

---

## Alcance

**Dentro:**

- `apps/api/src/modules/conversation/` (módulo nuevo): `conversation.gateway.ts` (WebSocket), `conversation.service.ts`, `conversation.prompt.ts` (system prompt clínico), `conversation.controller.ts`, `conversation.module.ts` y sus specs de Jest.
- `POST /sessions/:id/close`: cierra la sesión generando un `summary` de una línea con `LlmPort.complete()` y aplicando `status: 'ok'`. Vive en `conversation.controller.ts` porque es quien conoce el LLM; `SessionsService.update()` de SPEC 02 hace la escritura.
- `packages/shared/src/contracts/conversation.contract.ts`: esquemas Zod de los eventos WebSocket en los dos sentidos, reexportados desde `src/index.ts`.
- `apps/web/src/features/paciente/api/`: `useConversation.ts` (socket, hilo en memoria, estado de streaming) y `useSessionLifecycle.ts` (crear y cerrar sesión vía `apiClient`).
- `apps/web/src/features/paciente/components/`: `ChatView`, `Bubble`, `TypingIndicator`, `Composer`, `ExitModal`, más el cableado de la transición pre-sesión → chat en `PacientePage.tsx`.
- Prop nueva y opcional en `shared/layouts/Topbar.tsx` para interceptar el switch de vista con un modal antes de navegar.
- Dependencias nuevas en `apps/api`: `@nestjs/websockets`, `@nestjs/platform-ws`, `ws`.

**Fuera de alcance (para specs posteriores):**

- Micrófono, captura de audio, STT, TTS, push-to-talk, y los flags `🎙 TRANSCRITO DE AUDIO` / `🔊 Leído en voz alta` de `DESIGN.md` §4.6. → **SPEC 06**. El campo `isVoice` se persiste desde hoy, siempre en `false`.
- RAG, recuperación de fragmentos, citas reales y chips de cita. `citations` se persiste como `[]`. → D3
- `structuredSummary` real vía `LlmPort.structured()`. Queda en `null`. → D3
- Subida y borrado de conocimiento, incremento de `kb_state.version`, y el turno `who: 'system'`. → **SPEC 07**
- Reconexión automática del socket, backoff, heartbeat y sesiones concurrentes de varios pacientes. → D5
- Persistencia de métricas del LLM y cualquier UI que las muestre. Siguen en el acumulador en memoria de SPEC 04. → D5
- Triage clínico, escalamiento y creación automática de `priority_patients` desde una conversación. → D3
- Cambios en las vistas del médico. Este spec produce datos que SPEC 03 ya sabe pintar.

---

## Modelo de datos

**No hay migraciones, tablas ni columnas nuevas.** `sessions` y `transcripts` de SPEC 02 ya soportan todo lo que este spec escribe: se modelaron con esta conversación en mente.

Lo único nuevo son los eventos del WebSocket, que sí son contrato front↔back y por lo tanto viven en `packages/shared`.

### `conversation.contract.ts`

```ts
// Cliente → servidor
ClientEventSchema =
  | { type: 'user_message'; sessionId: string; text: string }

// Servidor → cliente
ServerEventSchema =
  | { type: 'turn_saved'; turn: TranscriptTurn }   // eco del turno del paciente ya persistido
  | { type: 'delta'; text: string }                // fragmento de la respuesta del asistente
  | { type: 'done'; turn: TranscriptTurn }         // turno del asistente persistido y completo
  | { type: 'error'; message: string }
```

Ambas uniones son discriminadas por `type` y se validan con Zod en el extremo receptor, igual que `apiClient` valida las respuestas HTTP. Un evento que no valida se descarta y se loguea; no se intenta interpretar a medias.

### Quién escribe en `transcripts`

**El servidor, siempre.** Al recibir `user_message` persiste el turno del paciente; al agotar el stream persiste el del asistente. El cliente **nunca** llama `POST /sessions/:id/turns` durante una conversación: dos escritores compitiendo por el mismo `seq` es una carrera que no hace falta correr.

`POST /sessions/:id/turns` sigue existiendo y no se toca — es superficie pública de la API de SPEC 02, verificada por sus criterios.

### Sesión de demo

El paciente no se pide por formulario. `PacientePage` tiene una constante con el nombre y el procedimiento que se mandan a `POST /sessions`:

```ts
const DEMO_PATIENT = { patientName: '…', procedure: '…' }; // valores exactos al implementar
```

Coherente con `DESIGN.md` §8, que define el copy de la pre-sesión y no contempla ningún campo de entrada.

### Cierre de sesión

`POST /sessions/:id/close` sin body. Devuelve el `Session` actualizado, validado contra `SessionSchema`. Lo que hace:

1. Lee los turnos de la sesión.
2. Si hay al menos un turno del asistente, pide a `LlmPort.complete()` un resumen de una línea con un prompt dedicado. Si la llamada falla, el resumen queda en `null` y el cierre **igual ocurre** — un LLM caído no puede dejar una sesión abierta para siempre.
3. `SessionsService.update()` con `status: 'ok'` y el `summary`.

`structuredSummary` no se toca: sigue en `null` hasta D3.

---

## Plan de implementación

Diez pasos. Cada uno deja el sistema arrancable y commiteable. El backend va primero y entero, para que la UI se construya contra un servidor que ya responde.

1. **Contrato de eventos.**
   `packages/shared/src/contracts/conversation.contract.ts` con `ClientEventSchema`, `ServerEventSchema` y sus tipos inferidos. Reexportar desde `src/index.ts`. Correr `pnpm --filter shared build`.
   *Verificación:* `pnpm typecheck` pasa; `node -e "console.log(Object.keys(require('./packages/shared/dist')))"` lista los nuevos exports.

2. **Gateway vacío.**
   Instalar `@nestjs/websockets`, `@nestjs/platform-ws` y `ws`. Configurar el `WsAdapter` en `main.ts`. `conversation.gateway.ts` escuchando en la ruta `/ws` y respondiendo a `user_message` con un `error` fijo de "no implementado". `conversation.module.ts` registrado en `AppModule`.
   *Verificación:* desde la consola del navegador, `new WebSocket('ws://localhost:3000/ws')` conecta y un `user_message` devuelve el evento de error. `docker compose up` sigue arrancando.

3. **System prompt clínico.**
   `conversation.prompt.ts` exportando `SYSTEM_PROMPT` (asistente post-operatorio, español de Colombia, sin jerga médica dirigida al paciente por `DESIGN.md` §8, nunca diagnostica ni cambia medicación, deriva al médico ante señales de alarma) y `SUMMARY_PROMPT` (una línea, sin viñetas, para la caja "Resumen de recomendaciones enviado al paciente" del médico). Solo constantes, sin lógica.
   *Verificación:* `pnpm typecheck`. No lo consume nadie todavía.

4. **Servicio de conversación — camino feliz.**
   `conversation.service.ts` con `handleUserMessage(sessionId, text)`: persiste el turno del paciente vía `SessionsService`, arma el arreglo de `LlmMessage` (system prompt + **historial completo** de la sesión traducido turno a turno), llama `LlmPort.stream()`, y devuelve un `AsyncIterable` de eventos de servidor. Al recibir el `done` del puerto, persiste el turno del asistente y emite el `done` propio con el turno persistido.
   *Verificación:* `conversation.service.spec.ts` con `LlmPort` y `SessionsService` mockeados: comprueba que se persisten dos turnos en orden, que el system prompt va primero, que el historial completo se transmite, y que la concatenación de los deltas iguala el texto del turno guardado.

5. **Cablear gateway y servicio.**
   El gateway consume el iterable del servicio y serializa cada evento al socket. Un error del puerto se traduce en un evento `error` y **no** tumba la conexión.
   *Verificación:* con `LLM_PROVIDER=mock`, mandar `user_message` desde la consola del navegador devuelve `turn_saved`, una ráfaga de `delta`, y un `done`. `GET /sessions/:id` muestra los dos turnos nuevos.

6. **Cierre de sesión.**
   `conversation.controller.ts` con `POST /sessions/:id/close`. Genera el resumen con `SUMMARY_PROMPT` y `LlmPort.complete()`, tolera el fallo con `summary: null`, y delega la escritura en `SessionsService.update()`.
   *Verificación:* `curl -X POST localhost:3000/sessions/<id>/close` devuelve la sesión con `status: 'ok'` y un `summary` no vacío. Test unitario del camino de fallo del LLM: la sesión igual queda cerrada.

7. **Hook de conversación en web.**
   `useConversation.ts`: abre el socket (URL derivada de `VITE_API_URL` cambiando el esquema `http`→`ws`), valida cada evento entrante con el contrato Zod, mantiene el hilo en memoria y expone `{ turns, streamingText, isStreaming, send, error }`. Al recibir `done`, sustituye el texto en streaming por el turno persistido.
   *Verificación:* test de Vitest con un `WebSocket` mockeado: una secuencia `turn_saved` → tres `delta` → `done` deja el hilo con dos turnos y `isStreaming` en `false`.

8. **Vista de chat.**
   `ChatView`, `Bubble` y `TypingIndicator` fieles a `DESIGN.md` §4.6: máximo 76% de ancho, radio 16px con la esquina de origen a 4px, timestamp abajo a la derecha, indicador de tres puntos con `blink` 1.2s y retardos .2s/.4s. **El paciente va a la derecha con `--accent-soft` y el asistente a la izquierda con `--surface-2`** — invertido respecto a la vista del médico, asimetría intencional documentada en §3.2 con ⚠️, no corregirla. Columna única centrada de máximo 720px, auto-scroll al final con cada delta.
   *Verificación:* visual en el navegador contra §4.6 y §3.2.

9. **Composer y alta de sesión.**
   `Composer` según §4.7: botón de micrófono de 44px **deshabilitado** con `title="Disponible próximamente"` (la voz es SPEC 06, no un clic mudo), input pill que enfoca con borde `--accent`, botón de enviar de 44px. `useSessionLifecycle.ts` con `POST /sessions` sobre la constante de demo. `PacientePage` pasa de `PreSesion` a `ChatView` al pulsar `Comenzar`.
   *Verificación:* un clic en `Comenzar` crea la sesión (visible en `GET /sessions`), escribir y enviar produce respuesta en streaming.

10. **Modal de salida y cierre del ciclo.**
    Prop opcional en `Topbar` para interceptar el switch. `ExitModal` sobre el `Modal` de `shared/components/` con el copy literal de §8: `¿Cambiar a vista médico?` / `Esto finaliza tu sesión actual con el asistente. Tu conversación se guardará antes de salir.` Confirmar llama `POST /sessions/:id/close` y solo entonces navega a `/medico`. Anotar las fricciones aparecidas en `plan/01-jueves/D1-jue-06-ago.md`.
    *Verificación:* el recorrido completo del bloque de criterios "Ciclo end-to-end".

---

## Criterios de aceptación

### Contrato y arranque

- [x] `packages/shared` exporta `ClientEventSchema`, `ServerEventSchema` y sus tipos; `pnpm --filter shared build` los deja en `dist/`.
- [x] `pnpm lint`, `pnpm typecheck` y `pnpm test` pasan en todos los workspaces.
- [x] `docker compose down -v && docker compose up` arranca los tres servicios y `/paciente` carga sin errores en consola.
- [x] Un evento entrante que no valida contra el contrato se descarta con un log, sin tumbar el socket ni la UI.

### Conversación

- [x] Pulsar `Comenzar` crea una sesión: aparece en `GET /sessions` con el paciente de demo.
- [x] Enviar un mensaje de texto devuelve la respuesta **fragmento a fragmento**, no de golpe: el texto crece en pantalla antes de terminar.
- [x] El indicador de escritura aparece al enviar y desaparece al llegar el primer fragmento de texto.
- [x] La conversación mantiene contexto: preguntar algo y luego "¿y eso desde cuándo?" produce una respuesta relacionada con la anterior (verificable solo con proveedor real; con `mock` el criterio es que el historial completo viaje en la petición, comprobado por test unitario).
- [x] El botón de micrófono se ve deshabilitado y su `title` dice `Disponible próximamente`.
- [x] Recargar la página a mitad de sesión no pierde los turnos ya persistidos: `GET /sessions/:id` los devuelve todos, en orden de `seq` sin huecos.
- [x] Un fallo del LLM emite un evento `error` visible en la UI y la conexión sigue viva: un segundo mensaje después del fallo funciona.

### Ciclo end-to-end

- [x] Pulsar `Cambiar a Dr` abre el modal con el copy literal de `DESIGN.md` §8, no navega de inmediato.
- [x] Confirmar el modal cierra la sesión (`status: 'ok'`, `summary` no nulo) y navega a `/medico`.
- [x] La sesión recién cerrada aparece en el dashboard del médico junto a las 5 sembradas.
- [x] Un clic en esa fila muestra la conversación completa read-only, con el asistente a la derecha y el paciente a la izquierda (asimetría de la vista médico, §3.2).
- [x] La caja "Resumen de recomendaciones enviado al paciente" muestra el resumen generado al cerrar.
- [x] Cancelar el modal no cierra la sesión y deja el chat utilizable.

### LLM

- [x] Con `LLM_PROVIDER=mock` y **ninguna API key** en el `.env`, todo el recorrido anterior funciona de principio a fin.
- [x] Con `LLM_PROVIDER=openai`, `OPENAI_BASE_URL=https://api.groq.com/openai/v1` y `LLM_MODEL=openai/gpt-oss-120b`, una conversación real responde en streaming.
- [x] Tras esa conversación, `GET /llm/metrics` reporta tokens, latencia y TTFT de cada turno (RA.9: emitidas automáticamente, no calculadas a mano).
- [x] `grep -rn "anthropic\|openai\|@google" apps/api/src --include=*.ts` no encuentra SDKs importados fuera de `modules/llm` (R0.1 / RA.1).
- [x] El diff completo del spec no toca ningún archivo de `apps/api/src/modules/llm/`.

### Fidelidad visual

- [x] Burbujas conformes a §4.6: ancho máximo 76%, radio 16px con 4px en la esquina de origen, timestamp abajo a la derecha.
- [x] Composer conforme a §4.7: mic y enviar de 44px circulares, input pill con borde `--accent` en foco.
- [x] El copy de la pre-sesión, la nota de micrófono y el modal de salida es **literal** el de §8.
- [x] Sin scroll horizontal en 390px, 768px, 1024px y 1440px, con el chat lleno de mensajes largos.
- [x] El hilo hace auto-scroll al final mientras llegan deltas, y no lo hace si el usuario subió a leer mensajes anteriores.

---

## Decisiones tomadas y descartadas

### 1. El spec se parte: 05 chat, 06 voz, 07 conocimiento en caliente

El plan del día juntaba T2 (voz) y T3 (vista paciente). Partirlos deja una demo end-to-end funcionando aunque el pipeline de audio se caiga entero, que es exactamente el riesgo que el propio plan marcaba como el mayor del día. RA.6 ya obliga a que el modo texto exista siempre; construirlo primero no es trabajo extra.

**Descartado:** el orden inverso (voz primero, UI después). Habría atacado el riesgo alto más temprano, pero con la UI sin construir el pipeline no se podría verificar más que por logs, y una hora perdida ahí deja el día sin nada demostrable.

### 2. El transporte es un WebSocket en un módulo `conversation`, no `voice`

El gateway nace aquí transportando deltas de texto; SPEC 06 le agrega audio y SPEC 07 el progreso de ingesta. `conversation` describe lo que hace en los tres casos.

**Descartado:** llamarlo `modules/voice` como preveía el plan original. Un módulo `voice` que no toca audio miente sobre su contenido durante todo un spec. **Descartado también:** colgar el gateway de `modules/sessions`, que mezclaría el transporte en tiempo real con el CRUD REST y dejaría a SPEC 07 sin lugar natural donde emitir progreso.

### 3. `ws` nativo, no Socket.IO

`@nestjs/platform-ws` deja al navegador usar el `WebSocket` nativo sin ninguna librería de cliente. Un protocolo, dos extremos, cero dependencias en `apps/web`.

**Descartado:** Socket.IO. Su reconexión automática y sus *rooms* son cómodos, pero cuestan una dependencia de cliente, un protocolo propio encima de WS, y resuelven problemas (multi-nodo, fallback a long-polling) que este proyecto no tiene.

### 4. SSE se descartó como transporte

`POST /sessions/:id/ask` con `text/event-stream` habría bastado para el chat de hoy.

**Descartado** porque es unidireccional: el audio del micrófono de SPEC 06 necesitaría un segundo canal, y el progreso de ingesta de SPEC 07 un tercero. Un WebSocket ahora evita inventar dos transportes más después.

### 5. El servidor es el único que escribe turnos

Persiste el del paciente al recibirlo y el del asistente al cerrar el stream. El cliente solo pinta.

**Descartado:** que el cliente llamara `POST /sessions/:id/turns`. Dos escritores compitiendo por el `seq` es una carrera evitable, y además dejaría la persistencia a merced de una pestaña que se cierra a mitad de respuesta.

### 6. Historial completo en cada turno, sin ventana deslizante

Las sesiones de demo son cortas y ningún modelo actual se queda sin ventana con ellas.

**Descartado:** una ventana de los últimos N turnos. Es un parámetro que hoy no resuelve ningún problema real y que habría que afinar a ciegas. Si D5 mide sesiones largas, se agrega entonces con datos.

### 7. Paciente de demo fijo, sin formulario

Constante en el front. Un clic y el evaluador está conversando.

**Descartado:** formulario de dos campos o selector de pacientes sembrados. Los dos agregan UI que `DESIGN.md` no define —y `DESIGN.md` es contrato congelado— y un paso extra en la demo a cambio de un realismo que nadie está evaluando.

### 8. El resumen de cierre es una línea por `complete()`, no un `SessionSummary` estructurado

La vista del médico tiene una caja de texto libre ("Resumen de recomendaciones enviado al paciente") que hoy solo llenan las sesiones sembradas. Una sesión nueva sin resumen se ve rota al lado de ellas.

**Descartado:** adelantar `structured()` y el `SessionSummary` completo de D3. Es más trabajo y más superficie de fallo para llenar campos que ninguna vista pinta todavía. **Descartado también:** cerrar con `summary: null`. Barato, pero deja el hueco visual que este spec puede tapar con una sola llamada.

### 9. El fallo del LLM al cerrar no bloquea el cierre

La sesión se cierra con `summary: null` y se loguea el error.

**Descartado:** propagar el error y dejar la sesión abierta. Un proveedor caído dejaría sesiones colgadas para siempre y al evaluador atrapado en `/paciente` sin poder volver al panel del médico.

### 10. La URL del WebSocket se deriva de `VITE_API_URL`

Cambiando el esquema `http`→`ws`. Sin variable de entorno nueva.

**Descartado:** un `VITE_WS_URL` propio. Sería una variable más que mantener sincronizada en `.env.example`, en `docker-compose.yml` y en la cabeza de quien despliegue, para expresar un dato que ya está en `VITE_API_URL`.

### 11. `isVoice` se persiste desde hoy, siempre en `false`

La columna existe desde SPEC 02 y SPEC 06 solo la pondrá en `true`.

**Descartado:** omitir el campo hasta que haya voz. Retrofitear un campo en la ruta de escritura es exactamente el trabajo que SPEC 02 evitó al modelarlo por adelantado.

### 12. El botón de micrófono se renderiza deshabilitado, no ausente

Con `title="Disponible próximamente"`, mismo criterio que SPEC 03 aplicó al ítem `Agregar conocimiento` del sidenav.

**Descartado:** no renderizarlo. El composer de §4.7 tiene tres elementos y quitar uno cambia el layout que SPEC 06 tendría que rehacer. **Descartado también:** renderizarlo habilitado sin efecto — un clic mudo se lee como bug.

---

## Riesgos identificados

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| **El WebSocket no atraviesa el dev server de Vite o el `docker compose`.** El navegador habla a `localhost:5173`, la API vive en `localhost:3000` dentro de otra red de contenedores. | Media | La URL se deriva de `VITE_API_URL`, que ya apunta al host correcto en ambos entornos, así que el socket va directo a la API sin pasar por Vite — el mismo camino que ya usa `apiClient`. Si aparece un problema de CORS o de *origin* en el handshake, se resuelve en el `WsAdapter`, no cambiando de transporte. Este riesgo se verifica en el paso 2, cuando el gateway todavía solo hace eco: si falla, falla barato. |
| **El mock de SPEC 04 trocea por palabras con retardo fijo.** Un ritmo demasiado regular puede esconder bugs de acumulación de deltas que un proveedor real destapa. | Alta | El criterio de aceptación con Groq no es opcional por esto. La pasada en vivo es la que ejercita fragmentación irregular y latencias reales. |
| **Una desconexión a mitad de stream deja el turno del asistente sin persistir.** El turno del paciente ya está guardado; la respuesta se pierde. | Media | Aceptado hoy. La conversación queda coherente (una pregunta sin respuesta), no corrupta. Reconexión y reanudación son D5. Lo que sí entra en este spec es que el servidor persista el turno del asistente **aunque el cliente ya no esté escuchando**: el stream se agota del lado del servidor pase lo que pase con el socket. |
| **Nadie ha ejercitado `LlmPort.stream()` con un consumidor real.** SPEC 04 lo diseñó sin consumidores y lo reconoció como deuda. Puede que `LlmDelta` no dé lo que hace falta. | Media | Si hay que cambiar la forma de `LlmDelta`, se cambia en `modules/llm` y se registra como fricción, tal como SPEC 04 dejó previsto. `LlmDelta` es una unión discriminada: agregar una variante no rompe a nadie. Ojo con el criterio "el diff no toca `modules/llm`": si se rompe por esta razón, es una desviación consciente y se anota, no se disimula. |
| **El system prompt clínico produce respuestas que no debería** (diagnósticos, cambios de medicación) al conectar un proveedor real. | Media | El prompt prohíbe explícitamente diagnosticar y cambiar medicación, y deriva al médico ante señales de alarma. No hay barandal automático más allá del prompt: el triage real es D3. La pasada con Groq incluye probar al menos una pregunta de alarma y leer la respuesta antes de dar el spec por cerrado. |
| **La API key de Groq se commitea.** El repositorio es público. | Baja, consecuencia alta | `.env` está en `.gitignore` desde SPEC 01. Al terminar el bloque de criterios de LLM, revisar `git log -p` del rango del spec buscando `gsk_`. Si llega a `main`, rotarla en el proveedor es la primera acción. |

---

## Lo que **no** entra en este spec

- Micrófono, STT, TTS y push-to-talk. → SPEC 06
- Subida y borrado de conocimiento, chip `KB vN` dinámico, turno `who: 'system'`. → SPEC 07
- RAG, citas reales y chips de cita. → D3
- `SessionSummary` estructurado, triage y escalamiento. → D3
- Reconexión del socket, sesiones concurrentes, persistencia de métricas. → D5

Cada uno, si llega, va en su propio spec.
