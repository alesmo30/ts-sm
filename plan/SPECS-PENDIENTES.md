# Specs pendientes de D1 — material de arranque

> Este archivo existe para sobrevivir un borrado de contexto. Antes de correr `/spec` para cualquiera de los cuatro specs de abajo, léelo entero — trae las decisiones ya tomadas, las referencias exactas a `DESIGN.md`/`REGLAS.md`, y las preguntas que probablemente haga la Fase 2 de `/spec` para que ya tengas la respuesta pensada.
>
> **Estado al 2026-08-06 (fin de sesión):** SPEC 01, SPEC 02 y **SPEC 03 implementados**. SPEC 01 y 02 ya están mergeados a `main` (PR #1 y PR #3). **SPEC 03 NO está mergeado todavía** — vive en la rama `spec-03-vistas-medico`, 11 commits, estado del archivo `specs/03-vistas-medico.md` puesto en `Implementado`, los 28 criterios de aceptación verificados uno por uno (navegador + `grep` + tests). **Falta el `git push` y el `gh pr create` contra `main`** — no se hizo en esta sesión porque pushear/abrir PR requiere confirmación explícita del usuario cada vez, y no se pidió. SPEC 04, 05 y 06 siguen sin redactar.
>
> ### Cómo retomar en la próxima sesión
>
> 1. Confirmar que la rama `spec-03-vistas-medico` sigue teniendo sus 11 commits (`git log --oneline main..spec-03-vistas-medico`).
> 2. Si el usuario quiere abrir el PR: `git push -u origin spec-03-vistas-medico` y `gh pr create` contra `main` — **pedir confirmación antes**, es una acción visible/compartida.
> 3. Una vez el PR de SPEC 03 esté **mergeado** a `main`: `git checkout main && git pull`, y recién ahí arrancar SPEC 04 con `/spec 04-llm-port` (el usuario lo corre, `/spec` tiene `disable-model-invocation` y no se puede invocar por agente).
> 4. `packages/shared` tiene build step (`tsc → dist/`) — cualquier cambio a un contrato exige `pnpm --filter shared build` antes de que `api`/`web` lo vean. Ver `CLAUDE.md` para el resto de fricciones ya resueltas (no las repitas).
>
> ### Sobre paralelizar specs 04/05/06 con agentes en worktree (decisión de la sesión anterior)
>
> Evaluado y **descartado para la redacción**, viable con matices para la **implementación**:
> - `/spec` no se puede invocar desde un agente (`disable-model-invocation`) — cada spec se redacta a mano, uno a la vez, con el usuario respondiendo la Fase 2.
> - El grafo de dependencias limita el paralelismo real: `SPEC 05` depende de `04`, `SPEC 06` depende de `03` + `05`. Hoy (con 03 ya implementado) solo `04` está desbloqueado — no hay nada que correr en paralelo con él todavía.
> - Implementación en worktree es razonable **una vez el spec esté `Aprobado`**, pero con un checkpoint de revisión humana antes del PR — el ritmo paso-a-paso de SPEC 03 atrapó dos bugs reales en vivo (`children` como array en `BottomPanel`, dos veces) que un agente sin ese loop de verificación en navegador probablemente no habría atrapado.

---

## Orden y dependencias

```
SPEC 03 (vistas médico)  ──depende de──▶  SPEC 02 (ya implementado)   [IMPLEMENTADO · PR pendiente]
SPEC 04 (LLMPort)        ──independiente, se puede hacer en paralelo con 03
SPEC 05 (voz + paciente) ──depende de──▶  SPEC 04 + SPEC 02
SPEC 06 (KB en caliente)  ──depende de──▶  SPEC 03 + SPEC 05
```

SPEC 04 es el bloque 🔴 más importante del día según el plan original (ventaja competitiva real: cambiar `LLM_PROVIDER` sin tocar código fuera de `modules/llm`) — si el tiempo aprieta, priorizarlo sobre 03.

---

## SPEC 03 — Vistas del médico (dashboard, prioridad, conocimiento de solo-lectura)

> ✅ **Implementado y validado:** `specs/03-vistas-medico.md`, estado `Implementado` (2026-08-06). Rama `spec-03-vistas-medico`, PR contra `main` abierto el mismo día. Los 28 criterios de aceptación se verificaron uno por uno. Lo que sigue queda como registro de dónde salió y qué se decidió en Fase 2.

**Cubre del plan original:** M3 (Dashboard de control) + M4 (Pacientes con atención personalizada) + M5, la mitad de solo-lectura (Referencias — la subida real de documentos es SPEC 06).

### Objetivo en una frase

Reemplazar la `<ul>` provisional de `MedicoPage` (andamio explícito de SPEC 02, paso 8) por las tres vistas reales del médico — dashboard, pacientes prioritarios, referencias — pixel-fieles a `DESIGN.md`, consumiendo los hooks de TanStack Query que SPEC 02 ya dejó listos.

### Ya resuelto — no reabrir en Fase 2 de `/spec`

- **Los hooks de datos ya existen.** `apps/web/src/features/medico/api/{useSessions,useSession,usePriorityPatients,useReferences}.ts`. Este spec es de **presentación**, no de fetching.
- **Backend completo y probado.** Los 9 endpoints de SPEC 02 (`/sessions`, `/sessions/:id`, `/patients/priority`, `/knowledge/references`, `/knowledge/state`) ya responden con datos reales. No hay trabajo de API en este spec salvo, quizás, si Fase 2 destapa que falta un campo — improbable, los contratos Zod ya cubren toda la superficie del prototipo.
- **Componentes compartidos a crear en `shared/components/`** (de `DESIGN.md` §4.13 y el resto del capítulo 4): `StatusTag` (4.4), `SessionTable` (4.3), `KbVersionChip` (4.13) — este último aunque hoy solo muestre `v1` estático, porque D1 T4/SPEC 06 lo va a necesitar dinámico.
- **Estados obligatorios de tabla** (DESIGN.md §4.3): cargando = skeleton de filas (nunca spinner), vacío = mensaje centrado en `--muted`, error = mensaje + botón de reintento, sin resultados de búsqueda = *"Sin resultados para «X»"* (distinto del vacío). TanStack Query ya expone `isLoading`/`isError`/`data` — el trabajo es mapear esos cuatro estados a los cuatro estados visuales exactos.
- **Search bar con debounce 250ms**, filtra server-side vía `?q=` (ya implementado en el backend). El componente solo debounce-ea el input antes de pasarlo a `useSessions(q)`.
- **Panel inferior**: oculto por defecto (DESIGN.md §3.1), aparece al seleccionar fila/paciente. Texto de reposo: *"Selecciona una sesión o un paciente para ver su información aquí."* — copy literal, no parafrasear.
- **Asimetría de burbujas ya documentada** (DESIGN.md §3.2, con ⚠️ explícito): en la vista médico (read-only) el asistente va a la derecha con acento, el paciente a la izquierda. Es intencional, no es un bug a corregir.

### Decisiones cerradas en Fase 2 (2026-08-06)

Las diez preguntas se resolvieron al redactar el spec. El detalle y la justificación están en la sección "Decisiones tomadas y descartadas" de `specs/03-vistas-medico.md`; acá queda solo el resultado.

1. **Navegación:** estado local en `MedicoPage` (`view` + `selected`). La URL sigue siendo `/medico`. Sin rutas anidadas, sin deep-linking.
2. **`Simular llamada` y `Enviar correo`:** **fuera**, las dos. El detalle del paciente prioritario no lleva botones. Cae con ellas el componente `Toast` de §4.12.
3. **Referencias:** listado + visor modal de 680px, todo lectura. Sin checkboxes, sin borrado — eso exige un `DELETE /knowledge/references` que no existe y es de SPEC 06.
4. **Responsive:** **dentro**. Cards bajo 768px y tabs horizontales en el sidenav bajo 920px. La matriz de 9 anchos es criterio de aceptación.
5. **Ítem `03 Agregar conocimiento`:** deshabilitado con `title="Disponible próximamente"`. Ni placeholder ni clic mudo.
6. **Panel inferior:** compartido, refleja sesión y paciente. Las referencias abren modal y no lo tocan.
7. **Clic en fila de sesión:** hace **las dos cosas** — reemplaza el content pane con la conversación read-only *y* llena el panel inferior.
8. **`KbVersionChip`:** se crea y se cablea a un hook nuevo `useKbState` contra `GET /knowledge/state`. Se descartó la idea de crearlo estático con `v1`: un componente sin montar no lo verifica ningún criterio.
9. **Ubicación:** `StatusTag`, `Modal`, `BottomPanel`, `KbVersionChip`, `SearchInput` y `TableStates` en `shared/components/`. Las tres tablas viven en `features/medico/components/`.
10. **Tablas:** **tres independientes** (`SessionTable`, `PriorityTable`, `ReferenceList`), no un `DataTable<T>` genérico. Solo se comparte `TableStates`, que renderiza los cuatro estados no-felices y no conoce columnas.

**Corrección a la línea de arriba sobre componentes compartidos:** este documento proponía un `SessionTable` en `shared/components/`. Quedó descartado — las tablas son específicas de la feature médico y cada una tiene columnas y cards propias.

**Hallazgo de Fase 2 con efecto fuera del spec:** `GET /patients/priority/:id` queda **sin consumidor**, porque `patients.repository.ts` hace `select()` sin proyección y el listado ya trae `llmSummary`, `outcome`, `durationSeconds` y `caseNotes`. No se borra hoy (SPEC 05 podría necesitarlo). La auditoría de endpoints huérfanos quedó registrada en `plan/05-lunes/D5-lun-10-ago.md`, Bloque 6.

### Verificación de referencia (para Fase 3, acceptance criteria)

- 6 columnas de la tabla: fecha, hora, ID sesión, paciente, procedimiento, estado — con las 5 sesiones sembradas.
- Clic en fila → conversación read-only con burbujas, back-link, tag de resultado, caja "Resumen de recomendaciones enviado al paciente" (`session.summary` del contrato, ya poblado por la semilla).
- 3 pacientes prioritarios sembrados (Jorge Restrepo `attn`, Luis Fernández `fail`, Diana Salazar `attn`) se ven en la tabla de M4 con sus 4 columnas (paciente, procedimiento, solicitado por, estado).
- Detalle de paciente prioritario en `detail-grid` de dos columnas (colapsa a una bajo 1180px, DESIGN.md §5): resumen LLM, `kv` con resultado/duración/nombre/procedimiento, card "Resumen del caso".
- 5 referencias sembradas se ven con su badge de tipo correcto (`PDF`/`MD`/`TXT`/`JSON`/`NOTA`).
- Sin scroll horizontal en la matriz completa de DESIGN.md §5 (9 anchos, desde 360×800 hasta 1920×1080).

---

## SPEC 04 — Capa agnóstica de LLM (`LLMPort` + drivers)

**Cubre del plan original:** T1, marcado 🔴 como "lo más importante del día".

### Objetivo en una frase

Construir los tres drivers (`mock`, `anthropic`, `openai`) detrás del `LlmPort` que SPEC 01 dejó como contrato vacío, con un `registry.ts` que selecciona por `LLM_PROVIDER`, de forma que cambiar de mock a un proveedor real no toque un solo archivo fuera de `modules/llm`.

### Ya resuelto — no reabrir en Fase 2

- **El contrato base ya existe.** `apps/api/src/modules/llm/llm.port.ts` tiene `LlmPort.complete()`; `llm.types.ts` tiene `LlmMessage`, `LlmCompletion`, `LlmUsage`. Este spec **extiende** esos tipos, no los reinventa — revisar si el `complete()` único alcanza o si hace falta separar `stream()`/`structured()`/`embed()` como sugiere el plan original (el plan dice explícitamente que `embed()` **no** va en este contrato).
- **R0.1 es innegociable** (REGLAS.md): "Todo acceso a LLM pasa por `modules/llm`. Cada llamada loguea el `model` usado." El `LlmCompletion.model` ya es obligatorio en el tipo actual — mantenerlo.
- **Puntos que la interfaz debe normalizar entre proveedores** (del plan original, no renegociar):
  - `system` separado (Anthropic) vs. rol dentro del array de mensajes (OpenAI).
  - `tool_use`/`tool_result` (Anthropic) vs. `tool_calls`/`role:tool` (OpenAI).
  - `structured()` con JSON schema nativo del proveedor, **con fallback a un parser tolerante** si el driver no lo soporta.
  - `usage.input_tokens` (Anthropic) vs. `prompt_tokens` (OpenAI) — normalizado ya en `LlmUsage` (`inputTokens`/`outputTokens`/`costUsd`).
  - Eventos de streaming normalizados a un `Delta` propio.
- **`parse.ts`**: parser JSON tolerante, "portado de invoice-system" según el plan original — si ese proyecto de referencia (`invoice-system`) no es accesible desde este entorno, construirlo desde cero seguirá el mismo criterio: LLMs a veces devuelven JSON con texto alrededor o comillas mal escapadas, el parser debe recuperar el objeto de todas formas o fallar con un error explícito.
- **`metrics.ts`**: `AsyncLocalStorage` para tokens, latencia, costo, TTFT — es lo que alimenta RA.9 de REGLAS.md ("las métricas se emiten automáticamente por turno, no se calculan a mano").
- **El mock devuelve 4 respuestas fijas rotativas. No más** — riesgo ya identificado en el plan original ("sobrediseñar el mock").
- **Grep de verificación ya usado en SPEC 01**: `grep -rn "anthropic\|openai\|@google" apps/api/src` no debe encontrar SDKs importados fuera de `modules/llm` — repetir esa verificación como criterio de aceptación aquí también, ahora que sí hay SDKs reales.

### Preguntas que Fase 2 probablemente necesita hacer

1. **¿Qué credenciales de prueba hay disponibles hoy?** El modelo obligatorio se anuncia el 7 de agosto — hasta entonces, `mock` es el único driver verificable end-to-end. Los drivers `anthropic`/`openai` se pueden escribir y typecheckear, pero su prueba real con streaming/tool_use depende de tener una API key de alguno de los dos (cualquiera sirve para probar el patrón, el modelo real se decide el 7).
2. **¿`stream()` entra en este spec o se difiere a SPEC 05?** El pipeline de voz (T2/SPEC 05) es quien consume `stream()` de verdad (segmentación por frase). Recomendación: el contrato de `stream()` se define aquí (es parte de "la interfaz normaliza eventos de streaming a un `Delta` propio"), pero el consumo real en el pipeline de audio es SPEC 05.
3. **¿Dónde vive el registry — `modules/llm/registry.ts` selecciona en cada request, o se resuelve una sola vez al bootstrap vía `ConfigModule`?** El criterio de éxito del plan ("cambiar `LLM_PROVIDER=mock` a `openai` no requiere tocar un archivo fuera de `modules/llm`") sugiere resolución en bootstrap con un provider de Nest, no un `if` por request.

### Verificación de referencia

- `LLM_PROVIDER=mock` (default) responde con las 4 respuestas fijas, con delay simulado.
- Cambiar `.env` a `LLM_PROVIDER=openai` (o `anthropic`) con una key de prueba funciona sin editar nada fuera de `apps/api/src/modules/llm/`.
- El log de cada llamada reporta `model`, tokens, latencia — visible en consola o en un endpoint de métricas.
- `structured()` con un schema simple recupera JSON válido incluso si el driver no soporta JSON schema nativo (probar forzando el fallback del parser tolerante).

---

## SPEC 05 — Pipeline de voz end-to-end + vista paciente

**Cubre del plan original:** T2 (pipeline de voz, 1h30 — el bloque de mayor riesgo del día) + T3 (vista paciente completa).

### Objetivo en una frase

Conectar micrófono → STT (Deepgram) → `LlmPort.stream()` (mock, de SPEC 04) → TTS (Azure) → parlante en la vista `/paciente`, con push-to-talk, modo texto siempre disponible, y persistencia de la sesión completa al cerrar (usando `POST /sessions` y `POST /sessions/:id/turns` de SPEC 02).

### Ya resuelto — no reabrir en Fase 2

- **El riesgo más alto del día — atacarlo temprano, no al final.** El plan original es explícito: si a las 16:00 (hora de ese día) el audio no fluye, cae a `MediaRecorder` + Deepgram batch (no streaming) y se refina después. No perseguir streaming perfecto a costa de no tener nada funcionando.
- **`AudioWorklet`, no `MediaRecorder`**, para mejor control de latencia — decisión ya tomada, PCM 16kHz.
- **Deepgram con keyterm prompting** cargado con vocabulario clínico inicial (términos del dominio: nombres de procedimientos, medicamentos comunes de las referencias sembradas).
- **Azure TTS `es-CO-SalomeNeural`**, streaming por frase — no esperar la respuesta completa del LLM antes de empezar a hablar. Esto es lo que hace que `LlmPort.stream()` (definido en SPEC 04) importe de verdad aquí: el segmentador por frase consume el stream de deltas, no una respuesta completa.
- **Fallback a Web Speech API activable por variable de entorno** (R0.4/RA.5 de REGLAS.md — "el demo no puede depender de que una API externa esté viva"). Probarlo el mismo día que se construye, no dejarlo para D5.
- **Instrumentar latencias desde el minuto uno**: TTFT, tiempo de STT, tiempo de TTS, E2E — se mide en vivo, no se reconstruye después. Usa `metrics.ts` de SPEC 04.
- **Push-to-talk**: mantener presionado para hablar, botón en estado `--danger` pulsante mientras graba (DESIGN.md §4.7, tabla de estados del botón de micrófono: reposo/hover/grabando/procesando/denegado).
- **Burbujas con flags exactos** (DESIGN.md §4.6): `🎙 TRANSCRITO DE AUDIO` (entrante, mono 10.5px `--muted`) y `🔊 Leído en voz alta` (asistente, mono 10.5px `--accent`). Indicador de escritura: tres puntos con `blink` 1.2s y retardos .2s/.4s.
- **Modo texto siempre disponible en el composer** — no es un fallback oculto, es un control de accesibilidad de primera clase (R0.6 + respaldo del evaluador si su micrófono falla).
- **Modal de cambio de vista finaliza y guarda la sesión** — al cambiar a `/medico`, la sesión activa se cierra (usa `PATCH /sessions/:id` de SPEC 02 para `status`/`summary`) y el historial en memoria se persiste turno a turno (ya venía insertándose vía `POST /sessions/:id/turns` durante la conversación, no solo al final — así una sesión que se corta abruptamente no pierde todo).
- **Historial en memoria durante la sesión, persistencia completa al cerrar** — matiz: los turnos individuales SÍ se persisten en vivo (cada `POST /sessions/:id/turns`), lo que se consolida al cerrar es el `status` final y el `summary`.
- **Copy literal de DESIGN.md §8** para pre-sesión, topbar paciente, nota de micrófono, modal de salida — no parafrasear.

### Preguntas que Fase 2 probablemente necesita hacer

1. **¿Cuentas de Deepgram/Azure ya existen, o se crean al arrancar este spec?** El plan original marcaba esto como riesgo: "crear las cuentas hoy en la mañana, no en la tarde. Poner límites de gasto al crearlas." Verificar que sigan activas si ya pasó tiempo desde que se planeó.
2. **¿El gateway WebSocket vive en `modules/voice` (nuevo) o dentro de `modules/sessions`?** El plan original prevé un módulo `voice` que SPEC 01 explícitamente decidió NO crear vacío ("carpetas vacías... ensucian el commit inicial"). Este spec es quien lo crea con contenido real.
3. **¿El `LlmPort.stream()` de SPEC 04 ya soporta el mock con delay simulado realista para probar el segmentador por frase, o hace falta ajustar el mock aquí?** Si SPEC 04 ya se implementó, verificar antes de asumir.

### Verificación de referencia

- Hablar por micrófono en `/paciente`, ver el texto transcrito con su flag de audio.
- Escuchar la respuesta en voz con acento colombiano.
- Al cerrar la sesión aparece un registro nuevo en el dashboard del médico (SPEC 03) — end-to-end real, no solo el backend.
- Clic en ese registro nuevo muestra la conversación completa read-only.
- Log de cada turno reporta TTFT, tokens, latencia E2E.
- Sin scroll horizontal en 390px/768px/1024px/1440px.
- Gasto del día: $0 (mock + créditos gratis de Deepgram/Azure).

---

## SPEC 06 — Conocimiento en caliente desde la vista paciente

**Cubre del plan original:** el resto de M5 (subida real de documentos, antes solo de-lectura en SPEC 03) + T4.

### Objetivo en una frase

Que el botón `Actualizar conocimiento` del topbar del paciente permita subir texto/archivos o eliminar referencias existentes sin bloquear el chat, insertando el separador de sistema en el hilo y actualizando el chip `KB vN` — todo contra mocks hoy (el pipeline real de RAG es D3).

### Ya resuelto — no reabrir en Fase 2

- **Tablas y columnas ya existen** (SPEC 02): `references` (con `active`, `version`, `chunks`) y `ingest_jobs` (con `stage`, `pct`, `error`), más `kb_state` como singleton de versión. Este spec **escribe** en esas tablas por primera vez — hasta ahora solo la semilla las poblaba.
- **`kbVersion` ya está en el modelo de datos** (SPEC 02): cada `TranscriptTurn` guarda el `kbVersion` vigente al momento de responder. Este spec es quien por fin **incrementa** `kb_state.version` al subir/borrar conocimiento — hasta ahora quedaba fijo en `1`.
- **`who: 'system'` en `TranscriptTurn` ya existe en el contrato** (modelado desde SPEC 02 "aunque su lógica real llegue en D3, retrofitearlo después cuesta el triple" — cita literal del plan original). Este spec es quien por fin lo usa: insertarlo al completar una actualización de conocimiento.
- **Separador de sistema — texto y forma exactos** (DESIGN.md §4.13): línea horizontal con texto centrado mono 10.5px `--muted`, formato `── Base de conocimiento actualizada · <nombre-archivo> · <hora> ──`. **No es un mensaje del asistente**, no lleva burbuja ni fondo. Se persiste con la transcripción y se ve igual en la vista read-only del médico (SPEC 03).
- **Chip `KB vN`** (DESIGN.md §4.13): pill mono 11px en el header del chat. Al incrementar, pulso breve a `--accent-soft` y vuelta al reposo — animación sutil, "nunca compite visualmente con la conversación".
- **Chip de progreso flotante, no bloqueante** (DESIGN.md §4.13): esquina inferior derecha sobre el composer, etapa actual + barra 4px + nombre de archivo truncado. Al completar: confirmación verde 2s y se desvanece. El chat sigue vivo mientras esto ocurre — criterio de aceptación explícito del plan original.
- **5 etapas del pipeline, orden y texto exactos** (DESIGN.md §4.10, ya en el contrato `IngestStage` de SPEC 02): `Recibido` → `Extrayendo texto` → `Fragmentando` → `Generando embeddings` → `Indexado`.
- **Barra de progreso simulada por WebSocket** — mismo mecanismo de tiempo real que SPEC 05 ya construyó para el gateway de voz; reutilizar el patrón, no inventar uno nuevo.
- **Modal con tres opciones** (texto crudo, subida de archivos, eliminar referencias existentes) — dropzone y filechip con estilos ya definidos en DESIGN.md §4.9.
- **R0.5 de REGLAS.md es la compuerta que este spec cierra**: "Subir/eliminar conocimiento desde consola funciona — el agente aprende y olvida". Demo en vivo: preguntar → subir → cambia la respuesta → borrar → vuelve a la anterior. **Sin reiniciar.**

### Preguntas que Fase 2 probablemente necesita hacer

1. **¿La consola de subida vive solo en `/paciente` (topbar) o también en `/medico` (sidenav ítem "Agregar conocimiento", pendiente de SPEC 03)?** El plan original las trata como dos entradas al mismo backend — decidir si este spec cubre ambas UIs o solo la de paciente (T4 explícito) y la de médico se hace en un ajuste de SPEC 03.
2. **¿El incremento de `kb_state.version` es atómico con la inserción de referencias/borrado, o dos pasos separados?** Dado que SPEC 02 ya modeló `kb_state` como singleton con `CHECK(id=1)` pensando en incrementos atómicos (ver sus "Decisiones tomadas y descartadas"), seguir ese mismo criterio aquí.
3. **¿Qué pasa con `chunks` de `Reference` cuando no hay RAG real todavía?** SPEC 02 lo dejó en `0` explícitamente ("hasta que exista RAG, D3"). Confirmar que sigue en `0` en este spec también — la ingesta "real" con embeddings es D3, no D1.

### Verificación de referencia

- Botón `Actualizar conocimiento` en el topbar del paciente, a la izquierda del switch (posición ya definida en DESIGN.md §4.1).
- Subir un archivo desde el modal → el chat **no se bloquea** mientras "procesa".
- Al terminar, aparece el separador de sistema en el hilo con el nombre del archivo y la hora.
- El chip `KB vN` incrementa y pulsa brevemente.
- Eliminar una referencia existente desde el mismo modal reduce la lista de `GET /knowledge/references` (que ya filtra por `active`, SPEC 02) sin reiniciar nada.
- La demo completa de R0.5 (preguntar → subir → cambia → borrar → vuelve) es reproducible en una sola sesión sin reiniciar el contenedor.

---

## Nota de proceso

Sigue usando `/spec <slug>` uno a la vez, en el orden de dependencias de arriba, con Fase 2 (preguntas) completa aunque este archivo ya adelante las respuestas más probables — puede haber matices que solo salgan al preguntar en el momento. Este archivo acelera la Fase 1 (contexto) y reduce las vueltas de la Fase 2, no las reemplaza.

Cuando cada spec quede `Aprobado`, correr `/spec-impl NN-slug`, seguir el ritmo paso-a-paso con confirmación y commit por paso que ya se usó en SPEC 02, y cerrar con PR contra `main` — **nunca merge directo** (ver `CLAUDE.md`).
