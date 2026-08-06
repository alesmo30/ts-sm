# D1 — Jueves 6 de agosto · día completo

> **Objetivo del día:** front navegable con datos mock y voz funcionando end-to-end contra un LLM falso. Al cerrar hoy, el sistema completo funciona salvo que el "cerebro" es un stub — y eso se cambia el viernes con dos variables de entorno.

**Principio rector de hoy:** todo se construye con `LLM_PROVIDER=mock`. Cero gasto, cero dependencia del anuncio del viernes.

---

## Bloque mañana (4h) — Vista médico completa

### M1 · Contratos compartidos (45 min)

`packages/shared` con esquemas **Zod** que sirven de contrato front↔back y de validación en runtime:

```ts
SessionSchema       // id, fecha, hora, paciente, procedimiento, estado, kbVersion
TranscriptTurn      // who: 'patient'|'assistant'|'system', text, isVoice, at, citations[], kbVersion
Citation            // docId, docName, chunkId, version, score, snippet
PriorityPatient     // name, proc, solicitadoPor, estado, llmSummary, resultado, duracion, caso
Reference           // id, name, type: PDF|MD|TXT|JSON|NOTA, addedAt, size, active, version, chunks
IngestJob           // id, stage, pct, fileName, error?
SessionSummary      // el resumen estructurado completo, con métricas
```

> El `TranscriptTurn` con `who:'system'` es el separador de actualización de conocimiento. **Modelarlo desde hoy** aunque su lógica real llegue en D3 — retrofitearlo después cuesta el triple.

### M2 · Mock server y datos semilla (45 min)

- Módulo `sessions` en Nest sirviendo las estructuras **exactas** del prototipo (`sessions`, `priorityPatients`, `references` de `medico.html`).
- Persistencia real en Postgres desde ya (no arrays en memoria): tablas `sessions`, `transcripts`, `priority_patients`, `references`, `ingest_jobs`.
- Script `pnpm seed` idempotente que carga los datos del prototipo. **Debe correr solo al arrancar el contenedor** — el evaluador no puede llegar a una app vacía (R0.3).
- TanStack Query en el front para el fetching.

### M3 · Dashboard de control (1h)

- Tabla con las 6 columnas: fecha, hora, ID sesión, paciente, procedimiento, estado.
- Search bar filtrando por paciente, ID y procedimiento (debounce 250ms).
- Tags de estado con las tres variantes (`ok`/`attn`/`fail`).
- **Clic en fila** → vista de conversación read-only: burbujas, back-link, tag de resultado y caja de "Resumen de recomendaciones enviado al paciente".
- **Panel inferior** con el detalle de la sesión seleccionada.
- Estados obligatorios: cargando (skeleton de filas), vacío, error, sin resultados de búsqueda.

### M4 · Pacientes con atención personalizada (45 min)

- Tabla: paciente, procedimiento, solicitado por, estado.
- Clic → detalle en `detail-grid` de dos columnas: resumen LLM, `kv` con resultado/duración/nombre/procedimiento, y la card de "Resumen del caso".
- Dos acciones: **Simular llamada** (usa `speechSynthesis` leyendo el resumen — sin Twilio, sin costo) y **Enviar correo** (Resend; si no hay API key, modo simulado con toast).
- Panel inferior actualizado con el paciente seleccionado.

### M5 · Agregar conocimiento + Referencias (45 min)

- **Agregar conocimiento:** textarea de texto crudo + dropzone para PDF/MD/TXT/JSON con lista de archivos y chips removibles.
- **Referencias:** listado con badge de tipo, checkbox de selección, seleccionar todo, borrado individual y bulk.
- Visor en modal ancho (680px) según el tipo de archivo; texto plano en el cuerpo mono con `pre-wrap`.
- Barra de progreso del RAG con las 5 etapas, simulada por WebSocket hoy.

---

## Bloque tarde (4h) — Vista paciente y voz real

### T1 · Capa agnóstica de LLM (1h) 🔴 **lo más importante del día**

`apps/api/src/modules/llm/`:

```
llm.port.ts        // interfaz: stream(), structured(), embed() NO va aquí
drivers/
  mock.driver.ts       // respuestas deterministas + delay simulado
  anthropic.driver.ts  // Messages API, tool_use, streaming, cache_control
  openai.driver.ts     // chat.completions, tool_calls, json_schema
registry.ts        // selecciona por LLM_PROVIDER
parse.ts           // parser JSON tolerante (portado de invoice-system)
metrics.ts         // AsyncLocalStorage: tokens, latencia, costo, TTFT
```

Puntos que la interfaz debe normalizar entre proveedores:
- `system` separado (Anthropic) vs rol en el array (OpenAI)
- `tool_use`/`tool_result` vs `tool_calls`/`role:tool`
- `structured()` con JSON schema nativo, **con fallback al parser tolerante** si el driver no lo soporta
- `usage.input_tokens` vs `prompt_tokens`
- Eventos de streaming normalizados a un `Delta` propio

**Criterio de éxito:** cambiar `LLM_PROVIDER=mock` a `openai` no requiere tocar un solo archivo fuera de `modules/llm`.

### T2 · Pipeline de voz end-to-end (1h 30min)

```
AudioWorklet (PCM 16kHz) → WS → Deepgram streaming → transcripción parcial + final
    → LLMPort.stream(mock) → segmentador por frase → Azure TTS → chunks de audio → parlante
```

- Gateway WebSocket de Nest para la sesión de voz.
- Captura con `AudioWorklet`, no con `MediaRecorder` (mejor control de latencia).
- Deepgram con **keyterm prompting** cargado con vocabulario clínico inicial.
- Azure TTS `es-CO-SalomeNeural`, streaming por frase (no esperar la respuesta completa).
- **Fallback a Web Speech API** activable por env var, probado hoy (R0.4/RA.5).
- **Instrumentar latencias desde el primer minuto**: TTFT, tiempo de STT, tiempo de TTS, E2E. Se miden hoy, no el domingo.

### T3 · Vista paciente completa (1h)

- Pre-sesión → botón "Iniciar sesión" → chat activo.
- Push-to-talk: mantener presionado para hablar, con el botón en estado `--danger` pulsante.
- Burbujas con flag `TRANSCRITO DE AUDIO` (entrante) y `Leído en voz alta` (asistente).
- Indicador de escritura con los tres puntos animados.
- Modo texto siempre disponible en el composer (R0.6 de accesibilidad + respaldo del evaluador).
- Modal de cambio de vista que **finaliza y guarda** la sesión.
- Historial en memoria durante la sesión; persistencia completa al cerrar.

### T4 · Conocimiento en caliente desde la vista paciente (30 min)

- Botón `Actualizar conocimiento` en el topbar, a la izquierda del switch.
- Modal con las tres opciones: texto crudo, subida de archivos, **eliminar** referencias existentes.
- Chip de progreso flotante, **no bloqueante** — el chat sigue vivo mientras indexa.
- Separador de sistema insertado en el hilo al completar.
- Chip `KB v1` en el header del chat.
- Todo contra mocks hoy; el pipeline real es D3.

---

## Alcance

**Dentro:** las 4 vistas del médico, la vista paciente, voz real STT/TTS, `LLMPort` con 3 drivers, UI de conocimiento en caliente.

**Fuera:**
- RAG real (embeddings, vector store, retrieval) → D3
- Triage clínico y escalamiento real → D3
- VAD, manos libres, barge-in → D4
- Delta Share → D2
- Resumen estructurado real (hoy es un stub) → D3

---

## Criterios de aceptación

- [ ] Hablo por micrófono en `/paciente`, veo mi texto transcrito con su flag de audio
- [ ] Escucho la respuesta en voz con acento colombiano
- [ ] Al cerrar la sesión aparece un registro nuevo en el dashboard del médico
- [ ] Clic en ese registro muestra la conversación completa read-only
- [ ] Las 4 vistas del médico navegan y el panel inferior refleja la selección
- [ ] Subo un archivo desde el modal del paciente y el chat **no se bloquea** mientras "procesa"
- [ ] Aparece el separador de sistema en el hilo al terminar
- [ ] `LLM_PROVIDER=openai` con una key de prueba funciona sin tocar código fuera de `modules/llm`
- [ ] El log de cada turno reporta TTFT, tokens y latencia E2E
- [ ] Sin scroll horizontal en 390px, 768px, 1024px y 1440px
- [ ] Gasto del día: **$0** (todo con mock + créditos gratis de Deepgram/Azure)

---

## Riesgos

| Riesgo | Mitigación |
|---|---|
| El pipeline de audio consume toda la tarde | Es el bloque más riesgoso: se ataca a las 14:00, no a las 18:00. Si a las 16:00 no fluye, se cae a `MediaRecorder` + Deepgram batch y se refina el domingo |
| Deepgram o Azure piden verificación de cuenta | **Crear las cuentas hoy en la mañana**, no en la tarde. Poner límites de gasto al crearlas |
| Permisos de micrófono en localhost | Chrome permite `getUserMedia` en `localhost` sin HTTPS. Verificar temprano |
| Sobrediseñar el mock | El mock devuelve 4 respuestas fijas rotativas. No más |

---

## Nota de cierre del día

Antes de dormir, dejar escrito en un archivo `NOTAS-D1.md`: qué quedó a medias, qué fricción apareció y qué hay que hacer primero mañana. El viernes arranca con lectura de la ficha técnica y no hay tiempo para recordar.
