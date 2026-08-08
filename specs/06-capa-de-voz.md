# SPEC 06 — Capa de voz: Deepgram STT + TTS

> **Estado:** Implementado (2026-08-08) — los 11 pasos del plan completados. Verificado con `pnpm lint`/`typecheck`/`test` en verde (69 tests api + 17 web) y con `docker compose up` limpio: los tres servicios arrancan sanos, `GET /voice/config` responde `provider:"off"` sin ninguna key, y un turno de texto completo (`turn_saved`→`delta`×N→`done`) funciona igual que en SPEC 05, confirmando que la bifurcación binaria del gateway no rompió el pipeline existente. **Sin verificación end-to-end contra Deepgram real** — la key se recibió pero no se ejerció el circuito de voz completo en vivo (STT/TTS reales, matriz visual de estados del micrófono); el código está cubierto por `voice.service.spec.ts` con el SDK mockeado. Ver fricciones en `plan/01-jueves/D1-jue-06-ago.md`.
> **Depende de:** SPEC 04, SPEC 05
> **Fecha:** 2026-08-08
> **Objetivo:** Enchufar voz real a la conversación que SPEC 05 ya dejó funcionando — push-to-talk hacia Deepgram Nova-3, respuesta hablada por Aura-2 `aura-2-celeste-es` con streaming por frase, y fallback local a Web Speech API activable por configuración.

---

## Contexto — por qué existe este spec

SPEC 05 dejó `/paciente` con una conversación de texto completa: gateway WebSocket en `modules/conversation`, streaming de deltas de `LlmPort.stream()`, persistencia turno a turno, cierre de sesión con resumen. El botón de micrófono del composer está renderizado **deshabilitado** con `title="Disponible próximamente"`, y `isVoice` se persiste siempre en `false`. Este spec enciende esa mitad: micrófono → Deepgram Nova-3 → el gateway que ya existe → Deepgram Aura-2 → parlante.

**Hallazgo que cambia el diseño previsto en `plan/SPECS-PENDIENTES.md`.** Ese archivo daba por hecho que "el gateway ya existe, este spec le agrega familias de evento de audio". Es cierto a medias: `conversation.gateway.ts` usa `@SubscribeMessage('user_message')`, y el `WsAdapter` de Nest **parsea todo mensaje entrante como JSON `{event, data}`**. Frames binarios no atraviesan ese pipeline tal como está. La solución (bifurcar en `client.on('message')` según `isBinary`, dejando el `WsAdapter` intacto para los eventos de texto) es la primera cosa que este spec verifica, antes de escribir una línea de STT o TTS.

---

## Alcance

**Dentro:**

- `apps/api/src/modules/voice/` (módulo nuevo): `voice.service.ts` (STT streaming + TTS por frase), `voice.metrics.ts` (`VoiceMetricsService`), `voice.controller.ts` (`GET /voice/config`, `GET /voice/metrics`), `voice.config.ts` (Zod sobre `process.env`), `voice.keyterms.ts`, `voice.module.ts` y sus specs de Jest.
- Bifurcación binaria en `conversation.gateway.ts`: `handleConnection` engancha `client.on('message')` y desvía los frames binarios a la capa de voz; los de texto siguen por el `WsAdapter` sin tocarse.
- Eventos nuevos en `packages/shared/src/contracts/conversation.contract.ts`: `audio_start` / `audio_end` (cliente→servidor) y `stt_status` / `tts_start` / `tts_end` (servidor→cliente). El audio en sí **no** viaja por el contrato Zod: son frames binarios crudos.
- `apps/web/src/features/paciente/audio/`: `micWorklet.ts` (`AudioWorklet` a PCM 16kHz mono), `useMicrophone.ts` (permisos, push-to-talk, estados del botón) y `useAudioPlayback.ts` (cola de buffers Web Audio API).
- `apps/web/src/features/paciente/api/useVoiceConfig.ts`: consulta `GET /voice/config` al montar.
- Fallback `webspeech`: STT por `SpeechRecognition` y TTS por `speechSynthesis`, ambos en el navegador, activados por el mismo `VOICE_PROVIDER`.
- Habilitar el botón de micrófono del `Composer` con los cinco estados de `DESIGN.md` §4.7, y el flag `🔊 Leído en voz alta` en `Bubble.tsx`.
- Dependencia nueva en `apps/api`: `@deepgram/sdk`.
- Variables nuevas en `.env.example`: `VOICE_PROVIDER`, `DEEPGRAM_API_KEY`, `DEEPGRAM_STT_MODEL`, `DEEPGRAM_TTS_MODEL`.

**Fuera de alcance (para specs posteriores):**

- Barge-in, VAD, manos libres y detección de fin de habla. → D4
- Transcripción parcial pintada en vivo. Solo se pinta el resultado final de Deepgram.
- Plan B de `MediaRecorder` + Deepgram batch. Queda como mitigación de riesgo, no como paso del plan.
- Subida de conocimiento, chip `KB vN` dinámico, turno `who:'system'`. → SPEC 07
- RAG, citas reales y chips de cita. → D3
- Reconexión del socket y sesiones concurrentes. → D5
- Persistencia de métricas de voz en base de datos. `VoiceMetricsService` acumula en memoria, igual que `LlmMetricsService`. → D5
- Cambios en las vistas del médico. La vista read-only ya sabe pintar `isVoice`.

---

## Modelo de datos

**No hay migraciones, tablas ni columnas nuevas.**

`TranscriptTurn` ya tiene `isVoice: boolean` desde SPEC 02, hoy escrito siempre en `false` en `conversation.service.ts`. Este spec le da su significado real: **`isVoice: true` = el turno pasó por voz**, que en un turno `patient` se pinta como `🎙 TRANSCRITO DE AUDIO` y en uno `assistant` como `🔊 Leído en voz alta`. Un solo campo, dos lecturas según `who`.

### Eventos nuevos del contrato

```ts
// Cliente → servidor (JSON, envelope {event, data} del WsAdapter)
| { type: 'audio_start'; sessionId: string }
| { type: 'audio_end';   sessionId: string }

// Servidor → cliente (JSON plano, sin envelope)
| { type: 'stt_status'; state: 'listening' | 'transcribing' | 'failed'; message?: string }
| { type: 'tts_start' }
| { type: 'tts_end' }
```

Los frames de audio viajan **binarios crudos** en el mismo socket, en los dos sentidos: PCM 16kHz mono little-endian hacia arriba, MP3 de Aura-2 hacia abajo. No pasan por Zod — un `ArrayBuffer` no tiene forma que validar, y el delimitador de turno lo dan `audio_start`/`audio_end` y `tts_start`/`tts_end`.

### Flujo de un turno hablado

1. Cliente manda `audio_start`. El servidor abre el socket de Deepgram Nova-3 y responde `stt_status: 'listening'`.
2. Cliente empuja frames PCM binarios mientras el botón está presionado.
3. Cliente suelta el botón y manda `audio_end`. Servidor cierra el socket de Deepgram y emite `stt_status: 'transcribing'`.
4. Con la transcripción final, el servidor entra al **mismo camino que SPEC 05** — `ConversationService.handleUserMessage(sessionId, texto, emit)` — con `isVoice: true`. El cliente recibe `turn_saved`, la ráfaga de `delta` y el `done` sin distinguir origen.
5. En paralelo a los `delta`, el servidor segmenta por frase y sintetiza cada una con Aura-2: `tts_start`, frames MP3 binarios, `tts_end`.

### `GET /voice/config`

```ts
{ provider: 'deepgram' | 'webspeech' | 'off', sttModel: string, ttsModel: string }
```

`off` deshabilita el micrófono y deja el chat en modo texto puro — el estado en que SPEC 05 lo dejó.

### `GET /voice/metrics`

Mismo patrón que `GET /llm/metrics`: totales acumulados + buffer circular de las últimas 50 llamadas. Cada registro: `{ at, kind: 'stt'|'tts', model, durationMs, audioMs?, characters?, ok }`.

---

## Plan de implementación

Once pasos. Backend primero y entero, igual que SPEC 05. Cada paso deja el sistema arrancable y commiteable.

1. **Contrato de eventos de voz.**
   Agregar los cinco miembros nuevos a `ClientEventSchema`/`ServerEventSchema` en `conversation.contract.ts`. Correr `pnpm --filter shared build`.
   *Verificación:* `pnpm typecheck` pasa; el `dist/` exporta los tipos nuevos. La UI de SPEC 05 sigue funcionando sin cambios (las uniones solo crecen).

2. **Configuración de voz.**
   `voice.config.ts` con Zod sobre `process.env` siguiendo el patrón de `llm.config.ts`: `VOICE_PROVIDER` (default `off`), `DEEPGRAM_API_KEY` (requerida solo si el provider es `deepgram`), `DEEPGRAM_STT_MODEL` (default `nova-3`), `DEEPGRAM_TTS_MODEL` (default `aura-2-celeste-es`). Agregar las cuatro a `.env.example` con valores vacíos o de default. `voice.module.ts` + `voice.controller.ts` con `GET /voice/config`.
   *Verificación:* `curl localhost:3000/voice/config` devuelve `provider:"off"` sin ninguna key en el `.env`. Con `VOICE_PROVIDER=deepgram` y sin key, la API **falla al arrancar** con mensaje explícito.

3. **Métricas de voz.**
   `voice.metrics.ts` con `VoiceMetricsService`: `recordStt({durationMs, audioMs, ok})`, `recordTts({durationMs, characters, ok})`, `getSnapshot()`. Buffer circular de 50, mismo tamaño que `LlmMetricsService`. `GET /voice/metrics` en el controller.
   *Verificación:* test unitario del buffer y los totales; el endpoint devuelve ceros antes de cualquier llamada.

4. **Keyterms clínicos.**
   `voice.keyterms.ts` exportando `CLINICAL_KEYTERMS: string[]` con los términos del dominio ya sembrados y su vocabulario cercano: `Seguimiento post-operatorio`, `Consulta de resultados`, `Examen de laboratorio`, `incisión`, `sutura`, `puntos`, `dolor postoperatorio`, `antibiótico`, `analgésico`, `fiebre`, `sangrado`, `inflamación`, `cicatrización`, `apósito`, `drenaje`, `signos de alarma`, `control postoperatorio`, `anestesia`, `medicamento para la presión`. Solo constantes.
   *Verificación:* `pnpm typecheck`. No lo consume nadie todavía.

5. **STT: `VoiceService.transcribe()`.**
   Con `@deepgram/sdk`: abre el socket de Nova-3 (`language: 'es'`, `keyterm: CLINICAL_KEYTERMS`, `encoding: 'linear16'`, `sample_rate: 16000`, `channels: 1`), acepta frames PCM, y resuelve con el transcript **final** al cerrarse. Registra en `VoiceMetricsService`. Un fallo resuelve con `null`, no lanza.
   *Verificación:* `voice.service.spec.ts` con el cliente de Deepgram mockeado: los keyterms llegan en las opciones, el transcript final se devuelve, un error resuelve `null` y queda registrado con `ok:false`.

6. **Bifurcación binaria en el gateway.**
   En `handleConnection`, enganchar `client.on('message', (raw, isBinary) => ...)`: si `isBinary`, empujar el chunk a la sesión de STT activa de ese socket; si no, no hacer nada (el `WsAdapter` ya lo maneja). `@SubscribeMessage('audio_start')` abre la sesión de STT y `@SubscribeMessage('audio_end')` la cierra y dispara el turno. Mapa `WebSocket → sesión de STT` en el gateway, limpiado en `handleDisconnect` (que hoy no existe y se agrega).
   *Verificación:* desde la consola del navegador, `audio_start` → mandar un `ArrayBuffer` → `audio_end` produce `stt_status` en los dos extremos del ciclo. **Los mensajes de texto de SPEC 05 siguen funcionando** — este es el criterio que valida que la bifurcación no rompió nada, y el paso donde el riesgo alto se paga barato.

7. **Turno hablado end-to-end (sin TTS).**
   `audio_end` con transcripción no vacía llama `ConversationService.handleUserMessage(sessionId, transcript, emit, { isVoice: true })`. Parámetro opcional nuevo en la firma; sin él, el comportamiento de SPEC 05 es idéntico. Transcripción vacía o `null` → `stt_status: 'failed'` con mensaje, sin persistir turno.
   *Verificación:* mandar audio real produce un turno `patient` con `isVoice: true` en `GET /sessions/:id`, seguido de la respuesta del asistente en streaming. Con `LLM_PROVIDER=openai` apuntando a Groq.

8. **TTS por frase.**
   `VoiceService.speak(text)` contra Aura-2, devolviendo el audio. En `ConversationService`, un segmentador acumula deltas y corta en `.`, `?`, `!` o salto de línea (mínimo 20 caracteres para no sintetizar fragmentos sueltos); cada frase completa se sintetiza y se emite como `tts_start` → frames binarios → `tts_end`. El turno del asistente se persiste con `isVoice: true` cuando hubo TTS.
   *Verificación:* test unitario del segmentador (una frase larga produce N cortes en los puntos correctos; texto sin puntuación se sintetiza entero al cerrar el stream). En vivo, los frames de audio empiezan a llegar antes del `done` del LLM.

9. **Captura de micrófono en el navegador.**
   `micWorklet.ts` (procesador `AudioWorklet` que convierte Float32 a Int16 PCM 16kHz mono) y `useMicrophone.ts`: pide permiso con `getUserMedia`, expone `{ state: 'idle'|'recording'|'processing'|'denied'|'unsupported', start, stop }` y empuja los frames al socket de `useConversation` (que expone un `sendBinary` nuevo). Push-to-talk por `pointerdown`/`pointerup`, con `pointercancel` y `blur` de la ventana cerrando la grabación.
   *Verificación:* test de Vitest con `getUserMedia` mockeado para el camino de permiso denegado. En vivo, presionar y soltar produce `audio_start`/frames/`audio_end` en la pestaña de red.

10. **Reproducción y estados del botón.**
    `useAudioPlayback.ts`: cola de `AudioBuffer` con Web Audio API, cada chunk decodificado y encolado para sonar apenas termina el anterior, sin esperar el audio completo. `Composer` recibe props nuevas y pinta los cinco estados de §4.7 (reposo / hover / grabando `--danger` con `animation: pulse 1s infinite` y halo / procesando con spinner / denegado con icono tachado y tooltip). Agregar `@keyframes pulse` y un bloque `prefers-reduced-motion` a `src/styles/index.css` (§6 exige que desactive el pulso del mic y el blink del typing). El botón queda deshabilitado mientras `isStreaming` o mientras la cola de audio no está vacía. El estado se anuncia por texto además de por color (§6). `Bubble.tsx` gana el flag `🔊 Leído en voz alta` abajo, mono 10.5px `--accent`, cuando `who === 'assistant' && isVoice`. Subir los iconos del composer de 16px a 19px (§7).
    *Verificación:* la matriz visual de §4.7 estado por estado, y el flag de TTS visible en la burbuja del asistente.

11. **Fallback Web Speech API.**
    Con `provider: 'webspeech'`, `useMicrophone` usa `SpeechRecognition` (`lang: 'es-CO'`) y manda el texto final por el `user_message` de siempre; `useAudioPlayback` usa `speechSynthesis` sobre el texto del turno completo. El backend no ve audio en este modo. Si el navegador no soporta `SpeechRecognition`, el estado es `unsupported` y el chat sigue en texto. Anotar las fricciones en `plan/01-jueves/D1-jue-06-ago.md`.
    *Verificación:* cambiar `VOICE_PROVIDER=webspeech` y reiniciar la API permite hablar y escuchar **sin que Deepgram participe** — verificable porque `GET /voice/metrics` no registra nada nuevo.

---

## Criterios de aceptación

### Contrato y arranque

- [x] `packages/shared` exporta los cinco eventos nuevos; `pnpm --filter shared build` los deja en `dist/`.
- [x] `pnpm lint`, `pnpm typecheck` y `pnpm test` pasan en todos los workspaces.
- [x] `docker compose down -v && docker compose up` arranca los tres servicios con `VOICE_PROVIDER=off` y sin `DEEPGRAM_API_KEY`.
- [x] Con `VOICE_PROVIDER=deepgram` y sin key, la API falla al arrancar con un mensaje que nombra la variable faltante.
- [x] `GET /voice/config` devuelve el proveedor y los dos modelos activos.

### No regresión de SPEC 05

- [x] Con `VOICE_PROVIDER=off`, el recorrido completo de SPEC 05 funciona igual: escribir, respuesta en streaming, cerrar sesión, verla en el dashboard. Verificado el tramo de streaming (`turn_saved`→`delta`×N→`done`) contra el stack Docker real con un socket crudo; cierre de sesión y dashboard no reverificados en este spec (sin cambios en esa ruta).
- [ ] El micrófono se ve deshabilitado con `VOICE_PROVIDER=off`, sin errores en consola. *(No verificado en navegador — pendiente de prueba manual.)*
- [ ] Un frame binario recibido sin `audio_start` previo se descarta con log, sin tumbar el socket. *(Lógica implementada en el gateway, sin test dedicado ni verificación en vivo.)*
- [x] Los mensajes de texto siguen viajando por el envelope `{event, data}` y siendo validados por Zod.

### Voz con Deepgram

*(Bloque completo pendiente de verificación en vivo — requiere navegador con micrófono. La key de Deepgram se recibió pero no se ejerció el circuito real durante la implementación. El código está cubierto por `voice.service.spec.ts` con el SDK mockeado.)*

- [ ] Presionar el micrófono y hablar en `/paciente` produce un turno del paciente con el texto transcrito y el flag `🎙 TRANSCRITO DE AUDIO`.
- [ ] El turno queda persistido con `isVoice: true` — verificable en `GET /sessions/:id`.
- [ ] La respuesta del asistente **suena** con acento colombiano (`aura-2-celeste-es`) y su burbuja lleva el flag `🔊 Leído en voz alta`.
- [ ] El audio empieza a sonar **antes** de que el LLM termine de generar: la primera frase se escucha mientras el texto sigue creciendo en pantalla.
- [ ] Soltar el micrófono sin haber dicho nada muestra `stt_status: 'failed'` y **no** persiste ningún turno.
- [ ] Denegar el permiso de micrófono deja el botón en estado denegado con tooltip de instrucción, y el modo texto sigue utilizable.
- [ ] El botón queda deshabilitado mientras el asistente responde o mientras suena el audio, y vuelve a reposo al terminar.
- [ ] `GET /voice/metrics` reporta duración de STT y de TTS por llamada tras una conversación hablada (RA.9).
- [ ] Un fallo de Deepgram a mitad de turno emite `stt_status: 'failed'` y la conexión sigue viva: un mensaje de texto después funciona.

### Fallback

- [ ] Con `VOICE_PROVIDER=webspeech`, hablar y escuchar funciona sin que `GET /voice/metrics` registre nada (R0.4 / RA.5). *(No verificado en navegador.)*
- [ ] En un navegador sin `SpeechRecognition`, el botón queda en estado no soportado y el chat sigue en texto. *(No verificado en navegador.)*

### Fidelidad visual y accesibilidad

*(Bloque completo pendiente de verificación visual en navegador.)*

- [ ] Los cinco estados del botón de micrófono coinciden con la tabla de `DESIGN.md` §4.7.
- [ ] Los flags de voz coinciden con §4.6: entrante arriba en mono 10.5px `--muted`, TTS abajo en mono 10.5px `--accent`.
- [ ] `prefers-reduced-motion: reduce` desactiva el pulso del micrófono y el blink del typing (§6).
- [ ] El estado del micrófono se anuncia por texto, no solo por color (§6).
- [ ] Sin scroll horizontal en 390px, 768px, 1024px y 1440px con el botón en estado grabando.

### Higiene

- [x] `grep -rn "anthropic\|openai\|@google" apps/api/src --include=*.ts` no encuentra SDKs de LLM fuera de `modules/llm` (R0.1 / RA.1).
- [x] `grep -rn "deepgram" apps/api/src --include=*.ts` solo encuentra referencias dentro de `modules/voice`.
- [x] El diff no toca ningún archivo de `apps/api/src/modules/llm/`.
- [ ] `git log -p` del rango del spec no contiene la key de Deepgram ni la de Groq. *(Pendiente hasta el commit final — verificar antes de abrir el PR.)*

---

## Decisiones tomadas y descartadas

### 1. El audio viaja binario por el mismo socket `/ws`

`handleConnection` engancha `client.on('message')` y bifurca por `isBinary`; los mensajes de texto siguen intactos por el `WsAdapter`. Un solo socket, cero overhead de encoding.

**Descartado:** base64 dentro del envelope JSON. Habría sido tipado de punta a punta con Zod, pero cuesta +33% de bytes y CPU de encode/decode en el camino más sensible a latencia del proyecto. **Descartado también:** un segundo path `/ws/audio`. Más aislado, pero son dos conexiones que abrir, cerrar y correlacionar por `sessionId`, y duplica el manejo de desconexión.

### 2. `isVoice` se reutiliza en ambos roles

`isVoice: true` significa "este turno pasó por voz". En `patient` se pinta como transcrito; en `assistant`, como leído en voz alta.

**Descartado:** un campo `spokenAloud` nuevo. Semánticamente más limpio, pero cuesta migración de Drizzle, cambio de contrato, rebuild de `shared` y tocar la vista read-only del médico — para distinguir dos casos que hoy nunca se separan.

### 3. `modules/voice` propio, no dentro de `conversation`

`VoiceService`, `VoiceMetricsService` y `VoiceController` viven aparte; `ConversationService` los inyecta. Espeja la separación que ya funcionó con `modules/llm`: el proveedor externo aislado, el orquestador limpio.

**Descartado:** todo dentro de `modules/conversation`. Menos cableado, pero mete un SDK de terceros en la carpeta que SPEC 07 también va a tocar para la ingesta — tres specs escribiendo en el mismo directorio.

### 4. `VoiceMetricsService` nuevo, no extender el del LLM

`LlmMetricsService` calcula costo con `priceFor(model)` sobre tokens; Deepgram cobra por minuto de audio y por caracteres. Son unidades distintas.

**Descartado:** agregar `method: 'stt'|'tts'` a `recordCall`. Un endpoint menos, pero ensucia un servicio que SPEC 04 dejó verificado y que SPEC 05 declaró explícitamente fuera de su diff.

### 5. El socket de Deepgram vive lo que dura la pulsación

Se abre en `audio_start` y se cierra en `audio_end`. Push-to-talk es discreto por naturaleza.

**Descartado:** un socket por sesión de chat con `KeepAlive`. Ahorra ~100ms de handshake por pulsación, pero obliga a mandar keepalives cada <10s y deja una conexión facturando si el evaluador olvida la pestaña abierta.

### 6. Solo se pinta la transcripción final

Nova-3 emite interinos, pero la burbuja aparece con el texto ya cerrado.

**Descartado:** pintar parciales en vivo. Se ve más reactivo, pero agrega un estado de burbuja mutable que `DESIGN.md` §4.6 no define, y §4.6 es contrato congelado.

### 7. Sin barge-in: el micrófono se deshabilita mientras el asistente habla

Estado "procesando" de §4.7 mientras `isStreaming` o mientras la cola de audio no está vacía.

**Descartado:** permitir interrumpir. Es más natural, pero exige cancelar la cola de Web Audio, decidir si el turno a medias se persiste truncado, y coordinar con un stream de LLM que sigue llegando. El plan original ya asignó barge-in a D4.

### 8. El fallback se decide por `VOICE_PROVIDER` en el backend, consultado por `GET /voice/config`

Una sola fuente de verdad en el `.env` de la API.

**Descartado:** un `VITE_VOICE_PROVIDER`. Duplicaría la configuración en `.env.example` y `docker-compose.yml`, exactamente lo que la decisión 10 de SPEC 05 descartó para la URL del WebSocket. **Descartado también:** degradación automática al fallar Deepgram. Se prueba solo lo que pasa de verdad, pero RA.5 pide que sea intercambiable **por configuración**, y sin variable no hay forma de demostrarlo en la sustentación.

### 9. El fallback es simétrico: Web Speech cubre STT y TTS

Si Deepgram cae, la sesión entera sigue en voz local.

**Descartado:** fallback asimétrico (solo TTS local, STT sigue remoto). Menos código, pero deja un modo mixto más que probar a cambio de poco.

### 10. La segmentación por frase corta en `.`, `?`, `!` o salto de línea, con mínimo de 20 caracteres

El mínimo evita sintetizar fragmentos sueltos como "Sí." de forma aislada.

**Descartado:** sintetizar la respuesta completa al recibir el `done`. Trivial de implementar, pero mata el punto de que `LlmPort.stream()` exista: el paciente esperaría la respuesta entera en silencio.

### 11. El plan B (`MediaRecorder` + batch) queda como riesgo, no como paso

Si el streaming no fluye, se cambia sobre la marcha y se anota como fricción.

**Descartado:** construirlo como paso obligatorio del plan. Duplica el trabajo si el streaming funciona, que es lo esperable con el SDK oficial.

---

## Riesgos identificados

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| **La bifurcación binaria rompe el pipeline de texto de SPEC 05.** El `WsAdapter` y un `client.on('message')` manual conviviendo en el mismo socket es territorio no explorado. | Media | Se verifica en el paso 6, cuando todavía no hay STT ni TTS: si falla, falla barato. El criterio de no regresión es explícito y se corre antes de seguir. Si no convive, la salida es el segundo path `/ws/audio` (opción ya evaluada). |
| **El `AudioWorklet` consume la tarde entera.** Es el bloque que el plan original marcó como el más riesgoso del día. | Alta | Se ataca en el paso 9, con el backend ya probado por consola. Si a las dos horas no fluye, se cae a `MediaRecorder` + Deepgram batch (decisión 11) y se refina después — tener voz imperfecta vale más que no tener voz. |
| **`aura-2-celeste-es` no existe o cambió de nombre.** El modelo se verificó en documentación el 2026-08-06, no contra la API. | Baja, consecuencia media | El modelo es una variable de entorno con default, no una constante. Si el nombre cambió, se corrige el `.env` sin tocar código. Verificar el listado de voces al arrancar el paso 8. |
| **El permiso de micrófono en `localhost` sin HTTPS.** Chrome lo permite, otros navegadores no. | Baja | Verificar temprano en Chrome, que es el navegador de la demo. El estado `denied` está contemplado en el botón, así que el fallo es visible y no silencioso. |
| **Costo de Deepgram.** STT $0.0058/min, TTS $0.030 por 1k caracteres, sobre $200 de crédito gratis. | Baja | Estimado del reto completo bajo $5. Poner límite de gasto en el dashboard al empezar. `GET /voice/metrics` acumula minutos y caracteres para verlo sin entrar al dashboard. |
| **La key de Deepgram se commitea.** El repositorio es público y la key se compartió por chat. | Baja, consecuencia alta | `.env` en `.gitignore` desde SPEC 01. `.env.example` lleva la variable vacía. Revisar `git log -p` del rango del spec como criterio de aceptación. Rotar la key al cerrar el reto. |

---

## Ajustes post-implementación (feedback en vivo, 2026-08-08)

Tras la primera pasada, prueba manual en navegador reveló cuatro problemas de experiencia y uno pedido nuevo. Los cinco se implementaron en la misma rama, antes de dar el spec por cerrado:

1. **Control de velocidad de reproducción (0.75x/1x/1.25x/1.5x).** `useAudioPlayback` aplica `AudioBufferSourceNode.playbackRate` por chunk encolado; `useWebSpeechFallback.speak()` aplica `SpeechSynthesisUtterance.rate`. Un solo estado (`speechRate` en `PacientePage`) alimenta los dos caminos. UI: `SpeedControl.tsx`, franja fina arriba del `ChatView`, solo visible con voz activa.
2. **Bug real: la síntesis de TTS bloqueaba el streaming de texto.** El `for await` de deltas en `ConversationService.handleUserMessage` hacía `await synthesizeAndEmit(phrase)` **dentro** del loop — cada round-trip a Deepgram TTS (cientos de ms) frenaba también la emisión del siguiente `delta`, lo cual se sentía como "la voz dudando" (en realidad era el texto tartamudeando). Corregido con una cadena de promesas (`ttsChain = ttsChain.then(...)`) que sintetiza en segundo plano, en orden, sin bloquear el loop: el texto ahora fluye a la velocidad real del LLM y el audio empieza a sonar apenas la primera frase está lista, no cuando todo el texto terminó.
3. **El agente ahora responde siempre en voz y en texto**, sin importar si el paciente escribió o habló. Antes `shouldSpeak` dependía de `isVoice` (solo hablaba si el turno del paciente fue de voz); ahora depende solo de `voiceService.isAvailable`. El gateway pasa `emitAudio` también desde el camino de `user_message` (texto), no solo desde `audio_end`. `isVoice` del turno del paciente sigue reflejando el modo real de entrada (para el flag `🎙`); `isVoice` del turno del asistente sigue reflejando si efectivamente sonó (`spoke`), ahora sin importar el origen del turno.
4. **Markdown roto en pantalla y en voz.** El LLM devolvía `**negritas**`, viñetas `- ` y encabezados `#` que se veían literales en la burbuja (nunca hubo un renderer de Markdown) y sonaban mal leídos en voz alta. Doble mitigación: `SYSTEM_PROMPT` ahora prohíbe explícitamente cualquier marcado, y `text-sanitizer.ts` (`sanitizeAssistantText`) limpia cada chunk de delta antes de emitirlo, persistirlo y sintetizarlo — defensa en profundidad por si el LLM no obedece la instrucción.
5. **Light/sepia mode, fuera del alcance original de este spec.** Toggle sol/luna en `Topbar` (`ThemeToggle.tsx`, `shared/components/`), paleta nueva en `tokens.css` bajo `:root[data-theme='light']`, persistida en `localStorage`. Aplica a toda la app, no solo a `/paciente` — decisión del usuario de implementarlo ya, en esta rama, en vez de abrir un spec propio pese a que toca `DESIGN.md` (contrato de diseño congelado según `CLAUDE.md`). Queda anotado como deuda de proceso, no de código: `DESIGN.md` no se actualizó con la nueva paleta ni con el toggle — si un futuro spec toca diseño visual, sincronizar `DESIGN.md` con lo que ya existe en `tokens.css`.

Cobertura de tests nueva: `text-sanitizer.spec.ts` (5 casos), un test en `conversation.service.spec.ts` que fija que TTS suena con `isVoice:false`, y el test de sintetización por frase se ajustó para no asumir un orden estricto entre `delta` y `tts_*` (ya no está garantizado por diseño). Verificado además en vivo contra Groq + Deepgram reales: mensaje de texto → texto limpio + 5 tramos de audio (`tts_start`/`tts_end`) + flag `🔊 Leído en voz alta` en la burbuja, confirmado con captura de pantalla en Chrome en modo sepia.

### Segunda ronda de feedback (mismo día)

Cuatro correcciones más, todas sobre la misma interacción "el agente responde":

6. **Composer bloqueado mientras el asistente responde.** Antes solo el mic se deshabilitaba durante `busy`; el textarea y el botón de enviar seguían activos, dejando mandar un segundo mensaje mientras el primero todavía se estaba pintando o sonando. `Composer` ahora recibe `disabled` y lo aplica al `<textarea>` (con placeholder `"Esperando respuesta del asistente…"`) y al botón de enviar, además del mic — los tres se bloquean y desbloquean juntos.
7. **El ícono de "procesando" del mic tenía un spinner (`Loader2` girando) que se leía como "el mic está haciendo algo por su cuenta".** No era eso — era solo el estado "no disponible ahora mismo". Se quitó el spinner: el estado `processing` ahora se ve igual que `denied`/`unsupported`/`off` (círculo apagado, sin animación), con el título actualizado a "Espera a que termine de responder".
8. **Rango de velocidades ajustado a 0.75x/1x/1.25x/1.5x** (antes 0.5x–2x). 2x se consideró inaudible/inútil; 0.5x, demasiado lento para el caso de uso.
9. **El selector de velocidad se bloquea mientras el asistente responde, igual que el mic y el composer.** Cambiarla a mitad de una respuesta no tenía ningún efecto real sobre el audio que ya estaba sonando o por sintetizarse, y dejaba la sensación de un control roto ("elijo 1.5x y no pasa nada"). Ahora la preferencia solo se puede tocar en reposo, y así el próximo turno completo — texto y voz — respeta la velocidad elegida de punta a punta. Para sostener esto sin crear una dependencia circular (el hook de mic necesita saber si está "ocupado" para bloquear su propio arranque, pero el estado de "hablando" del fallback local depende de ese mismo hook), `PacientePage` separa dos señales: `busyForMic` (streaming de texto + audio de Deepgram + transcripción en curso — lo que alimenta a los hooks de mic) e `isResponding` (`busyForMic` más `webSpeech.isSpeaking` — lo que efectivamente deshabilita `Composer` y `SpeedControl`).

Verificado en vivo contra Groq + Deepgram reales con captura de pantalla: al enviar, el composer completo queda visualmente apagado (placeholder cambiado, botón de enviar y velocidad atenuados) hasta que el audio termina de sonar del todo — con una respuesta de 5 frases, eso tomó cerca de 30 segundos por la latencia real de las llamadas REST secuenciales a Deepgram TTS (no es un bug, es el costo de mantener el orden de las frases; ver riesgo ya anotado sobre por qué la síntesis es secuencial).

### Tercera ronda de feedback (mismo día)

Dos ajustes más, ambos sobre comunicar al paciente qué está pasando durante esa espera:

10. **Indicador "🔊 Procesando audio…" en la burbuja del asistente mientras el texto ya está completo pero el audio todavía se está sintetizando.** Antes de esto, entre que el texto terminaba de pintarse y el turno se persistía (lo que puede tardar hasta ~30s, ver punto 9), la burbuja se quedaba quieta sin ninguna señal de que faltaba algo — el "punto muerto" que el usuario señaló. Se resolvió **sin agregar ningún evento nuevo al contrato WS**: `useConversation` ya recibía `tts_start` por cada frase sintetizada pero lo ignoraba; ahora ese primer `tts_start` prende `isSynthesizingVoice`, que se apaga en `done`/`error`. `Bubble` recibe un prop `processingAudio` nuevo y lo pinta con el mismo estilo mono 10.5px y blink de los demás indicadores de voz. Costo aceptado: como la síntesis ahora arranca en paralelo con el streaming de texto (fix del punto 2), el indicador puede aparecer *mientras el texto todavía se está terminando de escribir*, no estrictamente después — se consideró preferible a la alternativa (un evento `text_done` dedicado) por no tocar el contrato.
11. **Tooltips explicando por qué el mic, el input, el botón de enviar y el selector de velocidad están bloqueados**, en lenguaje llano ("El asistente está hablando. Espera un momento y podrás escribir de nuevo."), sin mencionar streaming, TTS ni ningún término técnico. `Composer` y `SpeedControl` ponen `title` en los elementos deshabilitados; en `SpeedControl` el `title` vive en el contenedor (`role="group"`) porque los botones no tienen `title` propio y el navegador lo hereda del ancestro más cercano al pasar el mouse.

### Cuarta ronda de feedback (mismo día): tooltip instantáneo y acumulación de voz estilo Wispr Flow

Dos pedidos, uno de corrección y uno de rediseño:

12. **El `title` nativo del punto 11 tardaba ~1s en aparecer** — delay controlado por el sistema operativo del navegador, no por CSS, imposible de acortar desde el lado de la aplicación. Reemplazado por `shared/components/Tooltip.tsx`, un tooltip propio. Primera versión (`group-hover` + `transition-opacity duration-75`, hijo `absolute` del trigger) apareció al instante pero se recortaba contra el borde del composer — el `<main>` del chat tiene `overflow-hidden` (necesario para el scroll), y eso recorta cualquier hijo posicionado que se salga del borde **sin importar el z-index**: z-index solo decide qué queda arriba, no si algo se recorta contra un ancestro con overflow. Corregido de raíz con un portal: `createPortal` a `document.body`, posición `fixed` calculada con `getBoundingClientRect()` del trigger en `onMouseEnter`/`onFocus`. Al vivir fuera del árbol del composer, ya no hay overflow ancestro que lo recorte. Efecto colateral positivo de la versión con portal: el trigger del hover es un `<span>` no deshabilitado envolviendo al botón real, así que también evita el problema conocido de Safari de no disparar eventos de mouse sobre botones nativos `disabled`.
13. **Rediseño del flujo de voz: de auto-envío a acumulación editable, estilo Wispr Flow.** Hasta acá, soltar el mic disparaba el turno directo al LLM (`audio_end` → `ConversationService.handleUserMessage` de una). El usuario pidió lo contrario: que grabar solo *transcriba hacia el composer*, sin enviar nada, para poder grabar varias veces, editar a mano, mezclar con texto escrito, y decidir cuándo mandar. Cambios:
    - **Contrato:** `stt_result: { text: string }` nuevo en `ServerEventSchema` — el texto transcrito ya no dispara nada solo, vuelve al cliente. `user_message` en `ClientEventSchema` gana `isVoice: z.boolean().default(false)`, para que un mensaje que mezcló dictado y texto a mano siga marcándose como `isVoice` en el turno persistido.
    - **Gateway:** `handleAudioEnd` ya no llama a `handleUserMessage` — solo emite `stt_result` con la transcripción. El envío real pasa siempre por `handleUserMessage` (el mismo handler de `user_message`), que ahora lee `isVoice` del propio evento en vez de recibir un booleano fijo.
    - **Frontend:** el texto del composer se sube de `Composer` a `PacientePage` (`draft`, controlado) para que el mic pueda acumular ahí. `appendTranscript` concatena con un espacio; se usa tanto para `stt_result` (Deepgram) como para `onFinalTranscript` del fallback local (mismo destino, ninguno auto-envía). `draftHasVoice` rastrea si el mensaje actual incluyó algo dictado, para pasarlo como `isVoice` al enviar.
    - **Textarea nunca se deshabilita** — se puede escribir y editar en cualquier momento, incluso mientras el asistente responde. Solo el mic, el botón de enviar y el selector de velocidad siguen bloqueados durante `isResponding`, sin cambios respecto a la ronda anterior. Esto además resuelve gratis el riesgo de eco acústico que se había planteado (¿grabar mientras suena el audio del asistente?): como el mic solo se habilita cuando el asistente **no** está hablando, nunca hay grabación y reproducción simultáneas por los mismos parlantes.
    - **Descartado:** dejar el mic usable también mientras el audio suena (lo que el usuario pidió originalmente en el mensaje anterior). Al replantear el flujo completo, el propio usuario lo simplificó: bloquear el mic durante toda la respuesta es más simple, evita el eco de raíz, y no le quita nada — igual puede seguir escribiendo a mano en ese lapso.

Verificado en vivo contra Docker con Groq + Deepgram reales, con captura de pantalla: se escribió texto en el input **mientras la burbuja del asistente todavía mostraba "🔊 Procesando audio…"** (textarea nunca se bloqueó), con el tooltip de "Espera un momento…" visible al instante sobre los controles atenuados (mic, enviar, velocidad). La grabación real de voz con micrófono físico queda pendiente de que el usuario la pruebe a mano — no es simulable desde este entorno.

---

## Lo que **no** entra en este spec

- Barge-in, VAD y manos libres. → D4
- Transcripción parcial en vivo.
- Subida y borrado de conocimiento, chip `KB vN` dinámico, turno `who:'system'`. → SPEC 07
- RAG, citas reales y chips de cita. → D3
- Reconexión del socket, sesiones concurrentes, persistencia de métricas de voz. → D5

Cada uno, si llega, va en su propio spec.
