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

---

## Fricciones de SPEC 01 (andamiaje)

Ejecutado el mismo día por delante del bloque de arriba — quedó registrado acá porque es el archivo que el spec señala para anotar fricciones.

- **`eslint-plugin-import` roto bajo ESLint 10.** Usa una API interna (`SourceCode.getTokenOrCommentBefore`) que ya no existe; crashea `pnpm lint` en cualquier archivo con imports desordenados, no solo avisa. Cambiado a `eslint-plugin-import-x` (fork mantenido para flat config + ESLint moderno). Si en D2+ se agrega algo que dependa del `eslint-plugin-import` original, revisar antes de instalar.
- **`rootDir` de TypeScript y el paquete `shared` sin build.** `apps/api/tsconfig.json` sin `rootDir` explícito hace que `tsc` infiera la raíz común (todo el monorepo) porque `health.dto.ts` importa `@ts-sm/shared` fuera de `apps/api/src`. Eso desplaza el `dist/main.js` a `dist/apps/api/src/main.js`, no `dist/main.js`. Ajustado en `nest-cli.json` (`entryFile`) y `package.json` (`start`). Si se agrega un segundo paquete compartido o se cambia la estructura, revisar esto de nuevo — es frágil.
- **Tailwind v4 en vez de `tailwind.config.ts`.** DESIGN.md y la spec asumen Tailwind clásico con `theme.extend`; se instaló Tailwind v4 (CSS-first, `@theme` en `index.css`). Mismo resultado, sintaxis distinta. Documentarlo para que D1+ no busque un `tailwind.config.ts` que no existe.
- **Colisión de nombre `--border`.** DESIGN.md usa `--border` para divisores (0.07 alpha) pero shadcn/ui usa convencionalmente la misma variable para bordes de input (0.14 alpha, nuestro `--border-mid`). Resuelto con namespacing bajo `--color-*` en el `@theme` de Tailwind en vez de declarar un `--border` crudo que pisara al del design system.
- **Topbar de paciente desbordaba a 360px.** Dos pills con texto largo ("Actualizar conocimiento" + "Cambiar a Dr") no entraban en 360px de ancho. DESIGN.md §5 ya prevé la regla (`<640px` → solo ícono con `aria-label`); solo faltaba implementarla. Verificado con un iframe de ancho exacto porque el `resize_window` de la extensión de Chrome no baja de forma confiable de ~600px en este entorno.
- **Repo y `LICENSE` ya existían al arrancar.** El repo público en GitHub y la autenticación de `gh` ya estaban resueltos antes de empezar — se saltó `gh repo create` del paso 1 y se fue directo a `git remote add` + primer commit.
- **Timebox de Docker (35 min) no se gastó.** El compose de los tres servicios levantó a la primera con healthchecks; no hizo falta el plan B de `db` en Docker + `api`/`web` locales.

---

## Fricciones de SPEC 02 (contratos, persistencia y API)

- **`@ts-sm/shared` nunca fue una dependencia real de `api` ni de `web`.** SPEC 01 lo consumía solo vía `import type`, que se borra al compilar — nunca hubo un `require`/`import` real en runtime, así que pnpm nunca creó el symlink en `node_modules`. Quedó enmascarado hasta que SPEC 02 metió el primer valor real (los esquemas Zod). Se agregó `"@ts-sm/shared": "workspace:*"` a `apps/api/package.json` y `apps/web/package.json`. Si se crea un segundo paquete compartido, declarar la dependencia desde el primer commit aunque el paquete arranque vacío.
- **`shared` sin build step no sobrevivió a tener código real.** La decisión de SPEC 01 ("se consume por source vía los paths del tsconfig, sin build") solo funcionaba porque `shared` no tenía runtime, solo tipos. Con Zod, Node no puede cargar TS multi-archivo crudo (ni con `type:module` ni sin él — `export *` tampoco sobrevive al `require(esm)` síncrono de Node). Se le dio a `shared` un build real: `tsc → dist/` (CommonJS), `package.json` apunta `main`/`types` ahí. El typecheck de tipos (`pnpm typecheck`) sigue siendo instantáneo porque usa los `paths` del tsconfig, no el build. Costo: tras editar un contrato hay que correr `pnpm --filter shared build` antes de que `api`/`web` lo vean (no hay watch mode todavía — evaluar si hace falta en D2+).
- **Vite tampoco resuelve paquetes de workspace enlazados sin ayuda.** Mismo síntoma, otra cara: Vite sirve `@ts-sm/shared` como fuente directa (no lo pre-empaqueta como hace con `node_modules` normales), y el `dist/index.js` CommonJS no es ESM válido para el navegador. Se agregó `optimizeDeps.include: ['@ts-sm/shared']` en `apps/web/vite.config.ts` para forzar la interop de esbuild. Si se agrega un segundo paquete compartido consumido desde `web`, agregarlo también ahí.
- **`docker-compose.yml` monta `web-node-modules` como volumen nombrado.** Al agregar dependencias nuevas a `apps/web/package.json` (TanStack Query, Zod, `@ts-sm/shared`), el volumen viejo seguía con el `node_modules` de antes. `docker compose down -v` fuerza a Docker a re-seedear el volumen desde la imagen recién construida. Si un rebuild de `web` no refleja un `package.json` nuevo, sospechar de esto primero.
- **Scripts `drizzle:generate`/`drizzle:migrate` de SPEC 01 nunca coincidieron con lo que terminó escribiendo el propio spec.** Renombrados a `db:generate`/`db:migrate` para que el plan y la verificación del spec fueran ejecutables tal cual están escritos.

---

## Fricciones de SPEC 03 (vistas del médico)

- **El umbral de colapso del shell (`md:768`) heredado de SPEC 01 no coincidía con `DESIGN.md` §5, que pide `<920px`.** `MedicoPage.tsx` y `Sidenav.tsx` usaban Tailwind `md:` (768px) tanto para el grid de dos columnas como para nada relacionado a tabs horizontales, porque el Sidenav vertical de SPEC 01 no tenía variante horizontal. Corregido con el breakpoint arbitrario `min-[920px]:` en ambos archivos. Si se agrega un cuarto breakpoint no estándar de `DESIGN.md`, usar la misma sintaxis arbitraria en vez de forzar un valor de Tailwind por defecto que no coincida.
- **`resize_window` de la extensión de Chrome no controla el viewport real en este entorno.** Confirmado con `window.innerWidth` vía `javascript_tool`: seguía reportando 1920 después de pedir 1024×768. La verificación de la matriz de 9 anchos de `DESIGN.md` §5 se hizo con `<iframe width="Npx">` servidos desde un HTTP estático local (`python3 -m http.server` sobre el scratchpad) apuntando a `localhost:5173`, la misma técnica que SPEC 01 ya había dejado anotada para anchos <600px — se confirma que hace falta para **toda** la matriz, no solo los anchos móviles.
- **`contentDocument` de un iframe cross-origin (`localhost:8899` → `localhost:5173`) no es accesible desde JS.** La verificación automática de `scrollWidth` contra el ancho del iframe falló con `TypeError`. Se cambió a inspección visual por captura de pantalla. Si D2+ necesita verificar responsive por script, haría falta servir el HTML de prueba desde el mismo origen que Vite (o desactivar CORS del navegador de pruebas), no vale la pena para una verificación puntual.
- **`GET /patients/priority/:id` quedó sin consumidor.** El detalle de paciente prioritario se pinta con el objeto que ya trae el listado (`llmSummary`, `outcome`, `durationSeconds`, `caseNotes` completos), verificado leyendo `patients.repository.ts` antes de decidir. Registrado como tarea de auditoría en `plan/05-lunes/D5-lun-10-ago.md`, Bloque 6, en vez de borrarse ahora — SPEC 05 podría necesitarlo al escalar un paciente desde una sesión de voz.
- **La base de datos de desarrollo tiene una sexta sesión (`SES-4826 / Prueba`) fuera de las 5 sembradas**, resultado de haber corrido el `POST /sessions` de los criterios de aceptación de SPEC 02 contra esta misma instancia. No es un bug de SPEC 03: el criterio "exactamente 5 sesiones" de SPEC 02 se verifica contra una base recién sembrada (`docker compose down -v && up`), no contra el estado acumulado de desarrollo. Anotado para no confundirlo con una regresión al revisar manualmente.
- **`@testing-library/user-event` no está instalado.** El test de selección de fila en `MedicoPage.test.tsx` se escribió con `fireEvent.click` de `@testing-library/react` (ya presente) en vez de agregar una dependencia nueva a mitad de spec.

---

## Fricciones de SPEC 04 (capa agnóstica de LLM)

- **`apps/api/Dockerfile` y `apps/web/Dockerfile` rompían `docker compose up --build` desde limpio, sin relación con el LLM.** El stage `deps` de ambos copiaba solo `packages/shared/package.json` antes de `pnpm install --frozen-lockfile`; el `postinstall` de la raíz corre `pnpm --filter shared build` (`tsc`), pero `packages/shared/tsconfig.json` y `src/` todavía no existían en ese punto del build — `tsc` no encontraba config ni archivos y fallaba imprimiendo el `--help`. Bug preexistente desde SPEC 01/02, nunca disparado porque nadie había corrido un `docker compose up --build` completamente en limpio (sin cache de capas) hasta verificar el criterio de higiene de este spec. Corregido copiando también `tsconfig.json` y `src` de `packages/shared` en el stage `deps` de los dos Dockerfiles. Verificado con `docker compose up` limpio: los tres servicios arrancan.
- **No hubo key de Anthropic disponible durante la implementación**, solo la de Groq (usada para el driver `openai`). El driver `anthropic.driver.ts` quedó cubierto por `anthropic.driver.spec.ts` con el cliente del SDK mockeado (traducción de `system`, `role:'tool'`→`tool_result`, `usage.input_tokens`, `structured()` con tool forzado y fallback), pero no hay verificación end-to-end contra la API real, tal como el spec preveía como camino aceptado ("si no la hay, queda cubierto por test unitario"). Pendiente para cuando haya una `ANTHROPIC_API_KEY` real: correr `POST /llm/complete` con `LLM_PROVIDER=anthropic` una vez.
- **`zod-to-json-schema` combinado con un método genérico (`structured<T>(...)`) dispara `TS2589: Type instantiation is excessively deep and possibly infinite`** tanto en el driver `openai` como en el `anthropic`. La causa es la resolución de tipos de `zodToJsonSchema` chocando con el parámetro genérico `T` del método aunque el valor ya viene casteado a `ZodTypeAny`. Resuelto extrayendo una función `toJsonSchema(schema: any): Record<string, unknown>` fuera de la clase, con `// eslint-disable-next-line @typescript-eslint/no-explicit-any` en el único punto de frontera — el resto del archivo permanece tipado. Si SPEC 05 usa `structured()` con otro schema genérico y reaparece el mismo error, este es el patrón a repetir, no escalar a `any` en más sitios.
