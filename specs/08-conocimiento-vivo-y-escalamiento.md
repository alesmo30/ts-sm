# SPEC 08 — Conocimiento vivo y escalamiento al médico

> **Estado:** Aprobado
> **Depende de:** SPEC 02, SPEC 03, SPEC 05, SPEC 06, SPEC 07
> **Fecha:** 2026-08-09
> **Objetivo:** Que subir un documento desde la consola lo deje consultable por el agente sin reiniciar nada ni bloquear la conversación, que deshabilitarlo lo haga olvidar al instante, y que cuando el agente encuentre un síntoma de alarma o un límite de su conocimiento lo escale a un médico con trazabilidad completa.

---

## Contexto — por qué existe este spec

Cierra **G5**, la compuerta eliminatoria del kit: *"Subes un documento desde tu consola de administración y el agente lo usa; lo eliminas y el agente lo olvida. Se verifica con un documento de prueba que no forma parte de ningún corpus entregado."* Si esto no funciona, la entrega no se puntúa. El kit exige además la consola explícitamente: *"Puedes ofrecer además API, CLI o una carpeta que el sistema vigile, pero la consola es exigida."*

SPEC 07 dejó el RAG funcionando sobre un corpus estático de 107 documentos, con `retrieval.service.ts` filtrando por `active = true` precisamente para que este spec pudiera hacer instantáneo el olvido. `ingest_jobs` está modelada desde SPEC 02 y nunca tuvo una fila; `who: 'system'` existe en el contrato y en la tabla esperando al separador de conocimiento; `priority_patients` está modelada y solo la puebla el seed. Este spec es quien por fin escribe todo eso desde la aplicación.

Es un spec grande y deliberadamente no partido: el conocimiento vivo y el escalamiento comparten el canal de WebSocket, el ciclo de vida de la sesión y el registro del médico. Su ejecución ocupa un día completo, no un bloque de dos horas.

---

## Alcance

**Dentro — ingesta asíncrona**

- `POST /knowledge/references` — acepta texto pegado (`application/json`) o un archivo (`multipart/form-data`, uno por envío). Responde `202 Accepted` con el `IngestJob` recién creado; **no espera a que termine la ingesta**.
- Tipos aceptados: `.pdf`, `.md`, `.txt`, `.json`. Máximo **10 MB** por archivo. Cualquier otro tipo o tamaño → `400` sin crear job.
- `GET /knowledge/jobs/:id` — estado de un job (`stage`, `pct`, `error`). Es lo que sondea la UI.
- `GET /knowledge/jobs` — jobs no terminales, para que una consola recién abierta recupere lo que quedó corriendo.
- Pipeline de ingesta en proceso (fire-and-forget dentro del mismo Node de `api`), con las etapas de `IngestStage` que ya están en `packages/shared`: `Recibido` → `Extrayendo texto` → `Fragmentando` → `Generando embeddings` → `Indexado`. Cada transición se persiste en `ingest_jobs`.
- Extracción por tipo: `unpdf` para PDF (pasa a dependencia de runtime de `api`), lectura directa para `.md`/`.txt`, y para `.json` una pasada por `LlmPort` que lo convierte en prosa continua antes de fragmentar.
- Detección de idioma reutilizando la heurística de stopwords de `kb-ingest.ts`. Si el documento es inglés, se traduce al español vía `LlmPort` chunk a chunk, con la misma concurrencia acotada y backoff de `kb-translate.ts`, escribiendo `database/kb-cache/<slug>.md` **antes** de tocar la base. El job avisa en la UI que un documento en inglés tarda más.
- `PATCH /knowledge/references/:id` con `{ active: boolean }` — deshabilitar y rehabilitar. Soft delete puro: no borra filas, no borra chunks, no borra caché. Aplica igual al corpus semilla y a lo subido.
- Incremento atómico de `kb_state.version` en la **misma transacción** que escribe los chunks al terminar la ingesta, y en la misma transacción del `PATCH`.
- Columna `references.origin` (`'corpus' | 'upload'`) para separar las dos pestañas de la consola.
- Bind mount de `database/kb-cache/` en el servicio `api` de `docker-compose.yml`, para que una traducción hecha en runtime sobreviva a recrear el contenedor y se pueda commitear.

**Dentro — consola del médico**

- Habilitar el ítem `Agregar conocimiento` del sidenav (`Sidenav.tsx:22`, hoy `view: null` con `title="Disponible próximamente"`).
- Vista nueva con dos pestañas: **Subidos** (`origin = 'upload'`) y **Base** (`origin = 'corpus'`, los 107 documentos del dataset).
- Formulario de alta: textarea de texto pegado + selector de archivo, con el estado del job visible (etapa, barra, nombre truncado) y confirmación de "procesado y disponible".
- Cada documento de ambas pestañas ofrece deshabilitar / rehabilitar, con su estado visible.

**Dentro — paciente en sesión**

- Cablear el botón `Actualizar conocimiento` del topbar de `PacientePage.tsx:190` a un modal contra los mismos endpoints.
- Chip `KB vN` reflejando la versión vigente, con el pulso a `--accent-soft` de DESIGN.md §4.13 al incrementar.
- Separador `who: 'system'` insertado en todas las sesiones abiertas al completar cualquier ingesta, con el formato exacto de DESIGN.md §4.13: `── Base de conocimiento actualizada · <nombre> · <hora> ──`. Sin burbuja, sin fondo. Persistido con la transcripción y renderizado igual en la vista read-only del médico.

**Dentro — citas**

- Chips de cita bajo la burbuja del asistente en `/paciente` y en `SessionDetail` del médico, alimentados por las `Citation[]` que SPEC 07 ya persiste.
- Al hacer clic: modal con el fragmento, el nombre del documento, su `version` y la `kbVersion` del turno.

**Dentro — pre-sesión y datos de contacto**

- `PreSesion.tsx` deja de ser un botón con paciente fijo (`useSessionLifecycle.ts:8-11`) y pasa a un formulario de cuatro campos obligatorios: **nombre completo, procedimiento, correo y teléfono**. Validación con Zod: correo con formato, teléfono por longitud mínima.
- Columnas `email` y `phone` en `app.sessions`, y en `SessionSchema`. Es lo que hace accionable la escalada: sin contacto, el registro del médico no sirve.

**Dentro — escalamiento**

- Dos disparadores, un solo mecanismo: **bandera roja clínica** detectada por el agente (sangrado desproporcionado, dolor severo, fiebre alta, signos de infección) y **petición explícita del paciente** de ser remitido.
- El agente señala la escalada emitiendo una marca `[[ESCALAR]]` al final de su respuesta, que `text-sanitizer.ts` elimina antes de la burbuja y del TTS —igual que ya limpia el markdown— y que el servidor traduce en un `ServerEvent` nuevo.
- Creación **idempotente** del `PriorityPatient`: una vez por sesión, con `requestedBy: 'Agente de voz'` y `status: 'attn'`.
- Modal de cuenta regresiva de 10 s en `/paciente`: expira → cierra la sesión; cancelar → la conversación sigue y la modal no vuelve a aparecer.
- Actualización continua del registro mientras la conversación siga: `llmSummary`, `caseNotes`, `outcome` y `durationSeconds`.
- Cierre de sesión por **inactividad** (sin turnos durante 10 minutos) y por desconexión del WebSocket sin reconexión dentro de esa misma ventana. Ambos generan el resumen definitivo y lo vuelcan al registro.
- El registro aparece en la vista **Pacientes con atención personalizada** del médico, que ya existe (`PriorityView`, `PriorityTable`, `PriorityDetail` de SPEC 03) y hoy solo lee datos sembrados.

**Fuera:**

- **Borrado físico de documentos.** Deshabilitar es reversible por decisión; un `DELETE` real no aporta a G5 y destruiría trabajo de traducción ya pagado.
- **Guardar el binario subido.** Se extrae el texto y se descarta el archivo; `body` conserva el preview de 500 caracteres y el caché el texto completo. Sin volumen nuevo, sin descarga.
- **WebSocket o SSE para el progreso de ingesta.** Sondeo HTTP con `refetchInterval`; el WebSocket de la conversación no se toca.
- **Sheet lateral responsive del panel de citas** (DESIGN.md §4.13). Se implementa como modal en todos los anchos.
- **Versionado por documento con historial.** `references.version` existe pero no acumula revisiones.
- **Subida múltiple en un envío.** Un job por archivo.
- **Traducción de la consulta del paciente en runtime.** Sigue fuera desde SPEC 07.
- **Embeddings de los chunks recién subidos.** La etapa `Generando embeddings` existe en el contrato y el pipeline la atraviesa, pero la columna `embedding` sigue vacía hasta SPEC 09.
- **Notificación real al médico** — correo, SMS o llamada. El registro aparece en su consola y él contacta manualmente por los canales que ya usa. Un servicio de envío es una cuenta externa más, y REGLAS.md limita las dependencias del arranque.
- **Reapertura de una sesión cerrada.** Cerrar es terminal; una consulta nueva es una sesión nueva.
- **Que el médico responda dentro del sistema.** La consola es de lectura y triage visual, no un canal de mensajería.
- **Cierre por inactividad configurable desde la UI.** Los 10 minutos son una constante del servidor.

---

## Flujo canónico de escalada

| Momento | Qué ocurre |
| --- | --- |
| **Disparo** — bandera roja detectada, o el paciente pide ser remitido | Se crea el `PriorityPatient` (`status: 'attn'`, `requestedBy: 'Agente de voz'`). **Una sola vez por sesión.** Aparece la modal con cuenta regresiva de 10 s. |
| **Timer expira sin acción** | Se cierra la sesión y se escala. |
| **El paciente cancela** | La sesión sigue. La modal **no vuelve a aparecer** en esa sesión — el registro ya existe. |
| **Conversación posterior** | Cada turno actualiza `llmSummary`, `caseNotes`, `outcome` y `durationSeconds` del registro ya creado. El médico ve el caso evolucionar. |
| **El paciente pide escalar de nuevo** | El agente responde que el médico ya está informado y ofrece cerrar o seguir. Sin modal nueva, sin registro nuevo. |
| **Cierre final** — inactividad, navegador cerrado, o petición explícita | Se genera el resumen definitivo y se vuelca al registro. |

La idea que lo sostiene: **la cancelación evita el cierre, no el aviso.** Un síntoma de alarma no deja de existir porque el paciente pulse "cancelar", y el médico es quien decide qué hacer con esa información.

Los dos ejes son ortogonales y no deben mezclarse:

| | **Bandera roja clínica** | **Vacío de conocimiento** |
| --- | --- | --- |
| Disparador | Síntoma de alarma: sangrado desproporcionado, dolor severo, fiebre alta, signos de infección | El retrieval no devuelve material relevante |
| Urgencia | Vida o muerte | Ninguna |
| Conducta | Redirige **de inmediato**, sin preguntar | Declara el límite y **ofrece** redirigir |
| Depende de lo que sepa el corpus | No — dispara aunque haya material | Sí, por definición |

---

## Modelo de datos

Ninguna tabla nueva. Columnas añadidas a cuatro tablas existentes, y dos tablas que estaban modeladas sin usarse —`ingest_jobs` y, en la práctica, `priority_patients`— que por fin se escriben desde la aplicación.

### `app.references` — una columna nueva

```
+ origin  text NOT NULL DEFAULT 'corpus'   -- 'corpus' | 'upload'
  references_origin_idx  btree (origin)
```

`DEFAULT 'corpus'` evita el backfill: las 107 filas del dataset quedan clasificadas sin tocarlas, y `kb-ingest.ts` sigue escribiendo sin mencionar la columna. El servicio de subida escribe `'upload'` explícito.

`origin` **no controla permisos** — ambos orígenes se deshabilitan y rehabilitan igual. Solo separa las dos pestañas de la consola.

Sin cambios: `active` sigue siendo el único interruptor que ve el retrieval, `chunks` lo llena la ingesta, `body` guarda 500 caracteres de preview, y `name` conserva su `UNIQUE`, que es lo que hace detectable subir dos veces el mismo documento.

### `app.ingest_jobs` — dos columnas nuevas

Existe desde SPEC 02 y nunca tuvo una fila. Le faltan dos cosas para ser fuente de verdad de un proceso asíncrono:

```
+ created_at  timestamptz NOT NULL DEFAULT now()
+ updated_at  timestamptz NOT NULL DEFAULT now()
  ingest_jobs_created_idx  btree (created_at DESC)
```

`updated_at` se refresca en cada transición de etapa. Es lo que distingue un job vivo de uno huérfano: si `api` se reinicia a mitad de una ingesta, la fila queda congelada, y un job no terminal con `updated_at` de hace más de 10 minutos se reporta como fallido en vez de girar para siempre en la UI.

Un job es **terminal** cuando `stage = 'Indexado'` (éxito) o `error IS NOT NULL` (fallo). No hace falta columna de estado: la combinación ya lo dice.

### `app.sessions` — cuatro columnas nuevas

```
+ email             text        NOT NULL DEFAULT ''
+ phone             text        NOT NULL DEFAULT ''
+ closed_at         timestamptz NULL
+ last_activity_at  timestamptz NOT NULL DEFAULT now()
```

- `email` y `phone` vienen del formulario de pre-sesión. `DEFAULT ''` para que la migración no falle con las sesiones ya sembradas; el contrato los exige no vacíos en el alta, así que el default solo aplica a datos históricos.
- `closed_at` distingue una sesión viva de una cerrada **sin inventar un estado nuevo**. `status` (`'ok' | 'attn' | 'fail'`) es un juicio clínico sobre el desenlace, no el ciclo de vida — mezclarlos rompería `PriorityTable` y `SessionTable`, que ya pintan ese campo como semáforo.
- `last_activity_at` se refresca en cada turno. Es lo que consulta el barrido de inactividad.

**Corrección de un supuesto del plan original:** no existe ningún estado `'live'` en `sessions.status` (`schema/sessions.ts:23`). "Sesión activa" significa dos cosas distintas y hay que usar cada una donde toca: para **emitir por WebSocket**, es tener un socket registrado en el gateway; para **cerrar por inactividad**, es `closed_at IS NULL`. El separador de conocimiento se persiste en las sesiones abiertas y se emite solo a las conectadas.

### `app.priority_patients` — sin cambios de forma

Modelada en SPEC 02 con exactamente los campos que el escalamiento necesita, y hasta hoy solo poblada por el seed. La aplicación empieza a escribirla:

| Columna | De dónde sale |
| --- | --- |
| `sessionId` | La sesión que escaló. Es lo que hace idempotente la creación: una fila por sesión. |
| `patientName`, `procedure` | Copiados de la sesión (formulario de pre-sesión). |
| `requestedBy` | `'Agente de voz'` — el disparador siempre es el agente, sea por bandera roja o a petición del paciente. |
| `status` | `'attn'` al crear. Pasa a `'fail'` si el cierre lo detonó un síntoma no resuelto, se queda en `'attn'` en el resto de casos. |
| `llmSummary` | Resumen generado vía `LlmPort`, **regenerado en cada actualización**, no solo al crear. |
| `outcome` | Frase corta del desenlace: escalada aceptada, cancelada y conversación continuada, o cerrada por inactividad. |
| `durationSeconds` | `now() - sessions.created_at`, recalculado en cada actualización. |
| `caseNotes` | El motivo del disparo —síntoma detectado o pregunta sin material— más lo relevante de la conversación posterior. |

**Un `UNIQUE` nuevo sobre `session_id`** es lo que garantiza la idempotencia a nivel de base, no solo de código: dos escaladas concurrentes en la misma sesión no pueden crear dos filas. Requiere que el índice tolere `NULL` (el seed inserta filas con `sessionId` nulo), cosa que Postgres hace por defecto: los `NULL` no colisionan entre sí en un índice único.

### `app.transcripts` — sin cambios de forma

El separador de conocimiento es una fila normal con `who = 'system'`, `citations = []` y el `kbVersion` **ya incrementado**. Su `text` se compone en el servidor con el formato de DESIGN.md §4.13:

```
Base de conocimiento actualizada · <name del documento> · <HH:mm>
```

Sin los guiones: los dibuja el componente, no el dato. La hora se formatea en el servidor para que la vista read-only del médico muestre exactamente lo que vio el paciente.

### `app.kb_state` — sin cambios de forma

Singleton con `CHECK(id = 1)` desde SPEC 02. `version` se incrementa con `UPDATE ... SET version = version + 1 RETURNING version` dentro de la transacción del alta o del `PATCH`: atómico, sin lectura previa, sin carrera entre dos ingestas.

### Contratos en `packages/shared`

```ts
// knowledge.contract.ts
export const ReferenceOrigin = z.enum(['corpus', 'upload']);
// ReferenceSchema  += origin: ReferenceOrigin
// IngestJobSchema  += createdAt / updatedAt (z.coerce.date())

export const CreateReferenceTextSchema = z.object({
  name: z.string().min(1).max(200),
  body: z.string().min(1).max(200_000),
});
export const UpdateReferenceActiveSchema = z.object({ active: z.boolean() });

// session.contract.ts
// SessionSchema += email, phone, closedAt (nullable), lastActivityAt
export const CreateSessionSchema = z.object({
  patientName: z.string().min(1).max(120),
  procedure: z.string().min(1).max(160),
  email: z.string().email(),
  phone: z.string().min(7).max(20),
});

// conversation.contract.ts — ServerEvent gana dos miembros
{ type: 'knowledge_updated', turn: TranscriptTurnSchema, kbVersion: z.number().int() }
{ type: 'escalation_started', reason: z.enum(['red_flag', 'patient_request']), countdownSeconds: z.number().int() }

// conversation.contract.ts — ClientEvent gana uno
{ type: 'escalation_cancelled', sessionId: z.string().uuid() }
```

La subida de archivo no lleva schema de body: la valida el interceptor de Nest por tipo y tamaño, y `name` sale del nombre del archivo.

Dos trampas operativas documentadas en `CLAUDE.md` que este spec pisa de lleno: tras tocar contratos hay que correr `pnpm --filter shared build`, y **añadir miembros a una unión discriminada exige limpiar la caché de pre-bundle de Vite del contenedor `web`** — si no, el cliente rechaza los eventos nuevos con `invalid_union_discriminator` aunque `dist/` esté correcto.

---

## Plan de implementación

Cada paso deja el sistema corriendo y commitable. Tres bloques: **A. Conocimiento vivo** (1-10), **B. Escalamiento** (11-14), **C. Cierre** (15). El bloque A cierra G5 por sí solo — si el tiempo aprieta, es el que no se negocia.

### A. Conocimiento vivo

1. **Migración de esquema.** `origin` en `schema/references.ts` con su índice; `createdAt`/`updatedAt` en `schema/ingest-jobs.ts`; `email`, `phone`, `closedAt`, `lastActivityAt` en `schema/sessions.ts`; `UNIQUE (session_id)` en `schema/priority-patients.ts`. Todo en una migración. `pnpm --filter api db:generate` y `db:migrate`. Actualizar los contratos de `packages/shared` del apartado anterior y `pnpm --filter shared build`. **Verificación:** `\d app.references` muestra `origin` con default `'corpus'` y las 107 filas sembradas lo tienen; `pnpm typecheck` pasa; el seed sigue corriendo limpio sobre base nueva.

2. **Repositorio de conocimiento.** `knowledge.repository.ts` gana `findReferences({ origin?, includeInactive? })` —`findActiveReferences` se conserva delegando, para no romper `ReferencesView`—, `createReference(input, tx)`, `setReferenceActive(id, active)` que incrementa `kb_state.version` **en la misma transacción**, y el CRUD de `ingest_jobs` (`createJob`, `updateJobStage`, `findJob`, `findOpenJobs`). **Verificación:** cubierto por el spec del servicio del paso 6.

3. **Extractores de texto.** `modules/knowledge/extractors/` con una función por tipo tras una firma común `extract(buffer, fileName): Promise<string>`: `unpdf` para PDF —pasa a dependencia de runtime de `apps/api`, hay que revisar el `Dockerfile` si su etapa de runtime instala solo producción—, lectura UTF-8 para `.md`/`.txt`, y para `.json` una llamada a `LlmPort.complete()` que lo convierte en prosa continua en español. El texto pegado no pasa por extractor. **Verificación:** `extractors.spec.ts` con un `.txt` y un `.json` (`LlmPort` mockeado) en verde.

4. **Traductor reutilizable.** Extraer de `database/kb-translate.ts` la lógica de traducir un chunk —consulta al caché por hash, llamada a `LlmPort`, escritura del caché **antes** de la base, backoff ante `429`— a `modules/knowledge/chunk-translator.ts`, inyectable como provider. `kb-translate.ts` pasa a consumir esa misma función: una sola implementación. **Verificación:** `pnpm kb:translate` sobre base ya traducida sigue reportando 100% de aciertos de caché.

5. **Pipeline de ingesta.** `modules/knowledge/ingestion.service.ts` con `ingest(input): Promise<IngestJob>`: crea el job en `Recibido`, **devuelve de inmediato**, y sigue en background recorriendo y persistiendo etapas — `Extrayendo texto`, `Fragmentando` (`chunker.ts` de SPEC 07), traducción si el idioma detectado es inglés, `Generando embeddings` (etapa atravesada sin trabajo hasta SPEC 09), e `Indexado`, que escribe `references` + `reference_chunks` + `references.chunks` **e incrementa `kb_state.version` en una sola transacción**. Cualquier excepción escribe `error` en el job y **no** incrementa la versión. Cola en memoria con un job en vuelo a la vez, para no competir por el TPM con el chat. **Verificación:** subir un `.txt` en español deja el job en `Indexado` en segundos y la versión +1; el chat responde con normalidad durante todo el proceso.

6. **Endpoints de conocimiento.** `knowledge.controller.ts` gana `POST /knowledge/references` (`202` + `IngestJob`; JSON validado con `ZodValidationPipe` y `CreateReferenceTextSchema`, o `multipart/form-data` con `FileInterceptor`, límite de 10 MB y lista blanca de extensiones), `PATCH /knowledge/references/:id`, `GET /knowledge/jobs/:id`, `GET /knowledge/jobs`, y el filtro por query en `GET /knowledge/references`. `knowledge.service.ts` orquesta; el controlador no toca Drizzle ni el pipeline. Extender `knowledge.service.spec.ts` con alta, deshabilitar, rehabilitar e incremento de versión. **Verificación:** el guion de G5 completo con `curl`, sin UI.

7. **Broadcast del separador de sistema.** El gateway solo responde al socket que le habló: cada handler recibe `client: WebSocket` y `emit` (`conversation.gateway.ts:149`) escribe solo ahí; el único mapa persistente (`sttSessions`, `:18`) va de socket a sesión de audio, no de `sessionId` a socket. La ingesta la dispara un `POST` HTTP —quizá desde el navegador del médico, sin WebSocket abierto— y el separador tiene que aterrizar en el hilo de un paciente que no pidió nada. Se construye:
   - **Registro `Map<string, Set<WebSocket>>`** de `sessionId` a sockets, poblado en `handleStartConversation` (`:78`) —único evento donde `sessionId` y socket coexisten— y limpiado en `handleDisconnect` (`:40`), junto a `sttSessions`. `Set` porque la misma sesión puede tener dos pestañas abiertas: es el caso de la demo.
   - **`broadcastKnowledgeUpdate(referenceName)`**, invocado al cerrar la transacción de `Indexado`: por cada sesión con `closed_at IS NULL`, `createTurn` con `who: 'system'` y el texto de §4.13 —que le estampa el `kbVersion` ya incrementado, porque `sessions.repository.ts:118-119` lee `kb_state` en su propia transacción, posterior a la de la ingesta— y emisión a los sockets registrados. Sin sockets conectados la fila igual queda persistida: quien abra después la ve.
   - **Inversión de dependencia con `EventEmitter2`** (`@nestjs/event-emitter`): `conversation` ya importa `knowledge` por `RetrievalService`, así que llamar directo sería un ciclo. La ingesta emite `knowledge.updated`, el gateway escucha con `@OnEvent`, ninguno importa al otro. `forwardRef` funcionaría pero deja el acoplamiento.

   **Verificación:** con dos pestañas en `/paciente`, un `POST` desde `curl` hace aparecer el separador en ambas sin recargar.

8. **Endurecer el prompt.** `buildSystemPrompt(citations)` ya recibe las citas y ya instruye declarar el límite (SPEC 07). Se le añade: no ofrecer subir documentos ni mencionar la consola, no cerrar la sesión ni disparar acciones al declarar un límite, no comentar la actualización de conocimiento por su cuenta, y no arrastrar el disclaimer cuando sí hay material. Respetando la restricción de texto plano sin markdown que impuso SPEC 06 por el TTS. **Verificación:** los criterios de honestidad ante el vacío, comprobados a mano.

9. **Consola del médico.** Habilitar el ítem del sidenav (`Sidenav.tsx:22`: `view: 'knowledge'`, fuera el `title="Disponible próximamente"`; añadir `'knowledge'` a `MedicoView` en `features/medico/types.ts`). `KnowledgeView.tsx` con dos pestañas —**Subidos** y **Base**—, formulario de alta (textarea + selector de archivo) y toggle de activo por documento; `ReferenceList` gana el estado visual de deshabilitado. Hooks nuevos: `useCreateReference`, `useSetReferenceActive` (`useMutation`, invalidando `['references']` y `['knowledge','state']`) y `useIngestJob(jobId)` con `refetchInterval` de 2 s mientras el job no sea terminal. **Verificación:** el guion de G5 completo desde el navegador.

10. **Modal del paciente y chip `KB vN`.** Cablear el botón de `PacientePage.tsx:190` a un modal con el mismo formulario. Los hooks compartidos entre `medico` y `paciente` bajan a `shared/api/`: `CLAUDE.md` prohíbe que una feature importe de otra. El chip consume el `kbVersion` del evento `knowledge_updated` y hace el pulso a `--accent-soft` de §4.13. **Verificación:** subir desde el modal del paciente actualiza el chip y deja el separador en el hilo.

### B. Escalamiento

11. **Formulario de pre-sesión.** `PreSesion.tsx` deja de ser un botón: cuatro campos obligatorios —nombre, procedimiento, correo, teléfono— validados con `CreateSessionSchema`. `useSessionLifecycle.ts` pierde `DEMO_PATIENT` (`:8-11`) y recibe los datos por argumento. `POST /sessions` los persiste. **Verificación:** una sesión creada desde la UI trae correo y teléfono en base; enviar el formulario incompleto no crea nada.

12. **Detección de la escalada.** El system prompt gana la instrucción de emitir `[[ESCALAR]]` como última línea cuando detecte un síntoma de alarma —sangrado desproporcionado, dolor severo, fiebre alta, signos de infección— o cuando el paciente pida explícitamente ser remitido. `text-sanitizer.ts` elimina la marca del stream **antes de la burbuja y del TTS**, igual que ya limpia el markdown; ojo con el caso de marca partida entre dos chunks de delta, que el sanitizer actual acepta fallar (`text-sanitizer.ts:5-6`) — aquí no puede, así que la detección se hace sobre el texto acumulado del turno, no chunk a chunk. **Verificación:** `text-sanitizer.spec.ts` extendido; la marca nunca aparece en la burbuja ni se escucha en el audio.

13. **Servicio de escalamiento.** `modules/escalation/` con su servicio y repositorio: `escalate(sessionId, reason)` crea el `PriorityPatient` **una sola vez por sesión** —apoyado en el `UNIQUE (session_id)`, con `onConflictDoNothing`— copiando `patientName` y `procedure` de la sesión, `requestedBy: 'Agente de voz'`, `status: 'attn'`, y `caseNotes` con el motivo; y `refresh(sessionId)` que regenera `llmSummary`, `outcome`, `caseNotes` y `durationSeconds` a partir de la transcripción completa. `refresh` se invoca al cerrar la sesión y cada N turnos posteriores a la escalada. El gateway emite `escalation_started` al detectar la marca, y acepta `escalation_cancelled` del cliente para anotar que la conversación siguió. **Verificación:** su `escalation.service.spec.ts`; dos escaladas seguidas en la misma sesión producen **una** fila.

14. **Modal de cuenta regresiva.** En `/paciente`, al recibir `escalation_started`: modal con 10 s de cuenta atrás y el texto *"Terminando sesión. Tu caso será consultado con un médico. Mantente pendiente de tu correo y de tu teléfono."* Expira → `close()` y pantalla de cierre. Cancelar → emite `escalation_cancelled`, la conversación sigue y **la modal no vuelve a aparecer en esa sesión**. Si el paciente pide escalar de nuevo, el agente responde que el médico ya está informado y ofrece cerrar o continuar — instrucción de prompt, no código. **Verificación:** cancelar deja el registro creado y visible en la vista del médico mientras el chat sigue vivo.

### C. Cierre y verificación

15. **Cierre por inactividad y verificación final.** `lastActivityAt` se refresca en cada turno; una tarea de `@nestjs/schedule` cada minuto cierra las sesiones con `closed_at IS NULL` y sin actividad en 10 minutos, generando el resumen y llamando a `refresh` si hubo escalada. La desconexión del WebSocket no cierra por sí sola —una recarga desconecta— sino que cae bajo la misma ventana de inactividad. `PriorityView`, `PriorityTable` y `PriorityDetail` (SPEC 03) pasan a mostrar los registros reales. Chips de cita: el componente del chip y su modal viven en `shared/components/`, se renderizan en `Bubble.tsx` bajo la burbuja del asistente **(10a)** y en `SessionDetail.tsx` **(10b, recortable)**, mostrando fragmento, `docName`, `version` del documento y `kbVersion` del turno. **Verificación:** `pnpm lint`, `pnpm typecheck` y `pnpm test` en verde, y los dos guiones —G5 y escalamiento— ensayados de una sentada sin reiniciar contenedores.

---

## Criterios de aceptación

### G5 — el guion de la demo, reproducible en una sola sesión sin reiniciar el contenedor

- [ ] Preguntar al agente algo cuya respuesta **no** está en el corpus → declara el límite y ofrece redirigir, sin inventar contenido clínico.
- [ ] Subir un documento con esa información desde la consola del médico.
- [ ] `POST /knowledge/references` responde `202` con un `IngestJob` **antes** de que la ingesta termine.
- [ ] La consola muestra la etapa del job avanzando y termina en un estado visible de "procesado y disponible".
- [ ] Volver a preguntar lo mismo → **la respuesta usa el documento nuevo y lo cita con su nombre real**.
- [ ] Deshabilitar ese documento desde la consola.
- [ ] Preguntar por tercera vez → vuelve a declarar el límite; el documento ya no aparece en las citas.
- [ ] Rehabilitarlo lo devuelve a las citas sin reingerir ni reiniciar nada.
- [ ] El documento de prueba usado queda anotado en el plan del día.

### Honestidad ante el vacío — el agente no improvisa ni actúa por su cuenta

- [ ] Sin material relevante, el agente **declara el límite explícitamente** y **ofrece** redirigir a un médico, en forma de pregunta. Nunca produce contenido clínico no sustentado en un fragmento recuperado.
- [ ] Al declarar un límite, el agente **no** cierra la sesión, **no** escala por su cuenta y **no** dispara ninguna acción sobre el sistema. Solo responde.
- [ ] El agente **no** pide que suban un documento ni menciona la consola de administración. Subir conocimiento es una decisión humana tomada fuera de la conversación.
- [ ] Si el paciente declina el ofrecimiento, la conversación continúa con normalidad.
- [ ] Al completar una ingesta, el aviso al paciente es **únicamente** el separador `who: 'system'` y el chip `KB vN`. El agente **no** emite un turno anunciándolo ni retoma la pregunta anterior sin que se lo pidan.
- [ ] Repetida la pregunta tras la ingesta, responde con el documento nuevo y lo cita — sin mencionar que antes no sabía ni que "acaban de subirle" información.
- [ ] Una respuesta con material recuperado no arrastra el disclaimer de límite: la honestidad ante el vacío no se vuelve muletilla.

### Ingesta

- [ ] Un `.txt` o `.md` en español queda `Indexado` sin ninguna llamada al LLM.
- [ ] Un `.pdf` en español se ingiere y sus chunks son consultables.
- [ ] Un `.pdf` en inglés se traduce al español y **su cita responde a una pregunta hecha en español**.
- [ ] Durante la ingesta de ese PDF en inglés, el chat responde con normalidad — **el chat no se bloqueó**.
- [ ] Un `.json` se convierte en prosa vía `LlmPort` y sus chunks son legibles, no un volcado de llaves.
- [ ] Texto pegado en el textarea se ingiere sin extractor y queda con `type = 'NOTA'`.
- [ ] Un tipo no aceptado y un archivo de más de 10 MB devuelven `400` **sin crear job**.
- [ ] Un archivo corrupto o sin capa de texto deja el job con `error` poblado y **no** incrementa `kb_state.version`.
- [ ] `references.chunks` refleja el número real de fragmentos, nunca `0`.
- [ ] La traducción hecha en runtime queda en `database/kb-cache/` y sobrevive a `docker compose down && up`.
- [ ] Subir dos veces un documento con el mismo `name` reporta el conflicto en el job sin romper nada.

### Versión y separador

- [ ] `kb_state.version` incrementa **una sola vez por ingesta completada**, en la transacción que escribe los chunks.
- [ ] Incrementa en cada deshabilitar y en cada rehabilitar.
- [ ] Un job fallido **no** incrementa la versión.
- [ ] El chip `KB vN` refleja el valor nuevo sin recargar, con el pulso a `--accent-soft`.
- [ ] Con dos pestañas de `/paciente` en la misma sesión, el separador aparece en **ambas**.
- [ ] Con dos sesiones abiertas distintas, aparece en las dos.
- [ ] El separador se persiste: recargar lo sigue mostrando, en su posición cronológica.
- [ ] Se ve igual en la vista read-only del médico y **no** parece un mensaje del asistente — sin burbuja, sin fondo.
- [ ] El turno `who: 'system'` tiene el `kbVersion` **ya incrementado**, no el anterior.

### Consola

- [ ] El ítem `Agregar conocimiento` ya no está deshabilitado ni muestra `title="Disponible próximamente"`.
- [ ] La pestaña **Base** lista el dataset y **Subidos** lo cargado desde la consola; ningún documento aparece en las dos.
- [ ] Los deshabilitados siguen visibles en su pestaña, con estado distinguible y opción de rehabilitar.
- [ ] Un documento del corpus semilla se deshabilita igual que uno subido.
- [ ] Recargar la consola con una ingesta en curso recupera el job y sigue mostrando su progreso.
- [ ] La vista `Referencias` existente funciona igual que antes de este spec.
- [ ] El modal del paciente sube contra los mismos endpoints con idéntico resultado.

### Pre-sesión

- [ ] `/paciente` pide nombre, procedimiento, correo y teléfono antes de empezar; los cuatro son obligatorios.
- [ ] Un correo con formato inválido o un teléfono demasiado corto impiden crear la sesión, con mensaje claro.
- [ ] La sesión creada persiste los cuatro datos, y el médico los ve en el detalle.
- [ ] Ya no existe ningún paciente fijo de demostración en el código.

### Escalamiento

- [ ] Un síntoma de alarma —sangrado desproporcionado, dolor severo, fiebre alta, signos de infección— dispara la escalada **aunque haya material en el corpus sobre ese síntoma**.
- [ ] Una petición explícita del paciente de ser remitido dispara la escalada igual.
- [ ] La marca `[[ESCALAR]]` **nunca** aparece en la burbuja ni se escucha en el audio, ni siquiera cuando el streaming la parte entre dos chunks.
- [ ] Al dispararse se crea **una** fila en `priority_patients` con `requestedBy = 'Agente de voz'` y `status = 'attn'`.
- [ ] Dos disparos en la misma sesión producen **una sola** fila — verificado también lanzando dos escaladas concurrentes.
- [ ] El registro aparece en la vista **Pacientes con atención personalizada** del médico, con nombre, procedimiento y datos de contacto reales.
- [ ] La modal de cuenta regresiva aparece con 10 s y el texto acordado.
- [ ] Dejar expirar el contador cierra la sesión y muestra la pantalla de cierre.
- [ ] **Cancelar no borra el registro**: la conversación sigue, el chat acepta mensajes y el caso permanece visible para el médico.
- [ ] Tras cancelar, la modal **no vuelve a aparecer** en esa sesión, ni siquiera si se cumple otra vez la condición.
- [ ] Si el paciente vuelve a pedir escalar tras cancelar, el agente responde que el médico ya está informado y ofrece cerrar o continuar — sin modal nueva y sin registro nuevo.
- [ ] La conversación posterior a la escalada actualiza `llmSummary`, `caseNotes`, `outcome` y `durationSeconds` del registro existente: el médico ve el caso evolucionar.
- [ ] El agente **no** afirma haber enviado un correo ni haber hecho una llamada. Dice que el médico fue informado, que es lo que efectivamente ocurrió.

### Cierre de sesión

- [ ] Una sesión sin turnos durante 10 minutos se cierra sola, con `closed_at` poblado.
- [ ] Cerrar la pestaña **no** cierra la sesión de inmediato: una recarga dentro de la ventana la recupera con su historial.
- [ ] El cierre genera el resumen definitivo y, si hubo escalada, lo vuelca al registro del médico.
- [ ] Una sesión cerrada no acepta mensajes nuevos.
- [ ] `sessions.status` sigue siendo un semáforo clínico y no se usa como estado de ciclo de vida.

### Citas

- [ ] Un turno del asistente con `citations` no vacío muestra un chip por cita bajo la burbuja.
- [ ] El clic abre el modal con fragmento, nombre del documento, su `version` y la `kbVersion` del turno.
- [ ] Un turno sin citas no muestra chips ni deja hueco en el layout.
- [ ] Los chips se ven también en `SessionDetail` del médico *(recortable — paso 10b)*.

### Higiene

- [ ] `pnpm lint`, `pnpm typecheck` y `pnpm test` en verde.
- [ ] `docker compose down -v && docker compose up` arranca en menos de 15 minutos con el corpus cargado, y ambos guiones son reproducibles desde ese arranque limpio.
- [ ] Ninguna feature de `apps/web` importa de otra feature.
- [ ] Ningún módulo importa un SDK de LLM directamente: conversión de JSON, traducción, resumen y escalamiento pasan por `LlmPort`.
- [ ] Sin ciclo de dependencias entre `KnowledgeModule`, `ConversationModule` y `EscalationModule`.
- [ ] El seed sigue corriendo idempotente sobre una base ya poblada.

---

## Decisiones

**Tomadas:**

- **Sí:** un solo spec para conocimiento vivo y escalamiento, aun sabiendo que es grande. Comparten el canal de WebSocket, el ciclo de vida de la sesión y el registro del médico; partirlos obligaría a construir dos veces el registro de sockets del gateway y a que el segundo spec reescribiera el prompt del primero. Decisión explícita del usuario: menos ruido, más tiempo de ejecución.
- **Sí:** ingesta asíncrona con `202` inmediato y sondeo por HTTP. Un PDF en inglés puede tardar minutos traduciéndose; bloquear el handler haría fallar el criterio de que el chat no se interrumpe.
- **Sí:** fire-and-forget dentro del proceso de `api`, con cola en memoria de un job a la vez. Cero infraestructura nueva — G2 exige `docker compose up` en 15 minutos y un contenedor más juega en contra.
- **Sí:** `ingest_jobs` como fuente de verdad del progreso, con `updated_at`. Un job huérfano por reinicio se detecta por antigüedad, sin fichero de checkpoint ni estado en memoria.
- **Sí:** las cinco etapas de `IngestStage` se atraviesan aunque `Generando embeddings` no haga trabajo hasta SPEC 09. El contrato ya existe y cambiarlo dos veces cuesta más que atravesar una etapa vacía.
- **Sí:** `unpdf` entra al runtime de `api`. Revierte conscientemente la decisión de SPEC 07 (*"solo se usa en scripts `tsx` — nunca entra al runtime del servidor"*), y es inevitable: la consola acepta PDF y el kit exige que acepte lo que el jurado suba.
- **Sí:** el `.json` se convierte en prosa vía `LlmPort`. Un volcado de llaves fragmentado por párrafos produce chunks que el FTS no sabe rankear. Es el mismo y único modelo permitido, no un segundo generativo.
- **Sí:** la traducción en caliente reutiliza la función de `kb-translate.ts`, extraída a un provider. Dos implementaciones del mismo prompt divergen en una semana.
- **Sí:** el caché de traducción se monta en `docker-compose.yml` para el servicio `api`. Sin bind mount, una traducción pagada en runtime muere con el contenedor — exactamente lo que el caché de SPEC 07 existía para evitar.
- **Sí:** soft delete reversible como único verbo de borrado, para corpus y para subidas por igual. Es lo que G5 mide —"lo eliminas y el agente lo olvida"—, es instantáneo porque el retrieval ya filtra por `active`, y permite reensayar la demo sin resembrar.
- **Sí:** columna `origin` solo informativa. No controla permisos; separa las dos pestañas de la consola, que es un problema real cuando hay 107 documentos del dataset y tres subidos.
- **Sí:** `EventEmitter2` para que la ingesta avise al gateway. `conversation` ya importa `knowledge` por `RetrievalService`; llamar directo sería un ciclo, y `forwardRef` lo resolvería dejando el acoplamiento.
- **Sí:** registro `Map<sessionId, Set<WebSocket>>` en el gateway. Es la pieza que faltaba para que un `POST` HTTP pueda escribir en el hilo de un paciente que no pidió nada.
- **Sí:** `closed_at` para el ciclo de vida, no un valor nuevo en `status`. `status` es un semáforo clínico que `SessionTable` y `PriorityTable` ya pintan; mezclar los dos conceptos rompería ambas vistas.
- **Sí:** `[[ESCALAR]]` como marca en la salida del modelo, limpiada por `text-sanitizer.ts`. Cero tokens extra, cero latencia, y el sanitizer ya existe para exactamente este tipo de limpieza.
- **Sí:** la detección de la marca va sobre el texto acumulado del turno, no chunk a chunk. `text-sanitizer.ts:5-6` acepta fallar con un marcador partido entre dos deltas — cosmético para el markdown, fallo funcional aquí.
- **Sí:** `UNIQUE (session_id)` en `priority_patients`. La idempotencia vive en la base, no solo en el código: dos disparos concurrentes no pueden duplicar el caso.
- **Sí:** el registro se crea al disparar la escalada, y cancelar la cuenta regresiva no lo borra. Un síntoma de alarma no deja de existir porque el paciente pulse "cancelar"; el médico decide qué hacer con esa información.
- **Sí:** tras cancelar, la modal no vuelve a aparecer en esa sesión. Reaparecer sería acoso al paciente y no añade nada: el registro ya existe y se sigue actualizando solo.
- **Sí:** el registro se refresca mientras la conversación continúa. Un caso escalado a los dos minutos y una conversación de veinte más produce, si no, un `caseNotes` que miente por omisión.
- **Sí:** los cuatro campos de pre-sesión obligatorios. Una escalada sin datos de contacto no sirve para nada, y son cuatro campos.
- **Sí:** reutilizar `POST /sessions/:id/close`, que ya genera el resumen vía `LlmPort`, en lugar de una ruta de cierre paralela.
- **Sí:** cierre por inactividad a los 10 minutos con una tarea de `@nestjs/schedule`. La desconexión del WebSocket no cierra por sí sola: una recarga desconecta, y perder la sesión al refrescar sería un fallo obvio en la demo.
- **Sí:** el agente dice que el médico fue informado, nunca que se envió un correo o se hizo una llamada. Es lo único cierto: el registro aparece en la consola y el contacto lo hace el médico.
- **Sí:** los componentes compartidos entre features —hooks de conocimiento, chip y modal de cita— viven en `shared/`. `CLAUDE.md` prohíbe que una feature importe de otra, y aquí `medico` y `paciente` necesitan lo mismo.

**Descartadas:**

- **No:** borrado físico de documentos. Destruiría traducciones ya pagadas y no aporta nada a G5, que mide que el agente *olvide*, no que la fila desaparezca.
- **No:** guardar el binario del archivo subido. Exigiría un volumen nuevo para permitir una descarga que nadie pidió; `body` ya da preview y el caché conserva el texto completo.
- **No:** BullMQ + Redis para la cola de ingesta. Un contenedor más en el arranque, atacando directamente los 15 minutos de G2, para un sistema con un job en vuelo a la vez.
- **No:** WebSocket o SSE para el progreso de ingesta. El sondeo cada 2 s cumple el contrato del kit —"indicación visible de procesado y disponible"— sin tocar el WebSocket de la conversación, que es la pieza más delicada del sistema.
- **No:** la barra de cinco etapas animada del prototipo. Explícitamente fuera desde el plan: el kit pide indicación visible, no un pipeline animado.
- **No:** una segunda llamada al LLM para clasificar cada turno y decidir si escalar. Duplica tokens y latencia en **cada** mensaje, y esos tokens entran en las métricas de la rúbrica.
- **No:** *function calling* vía `LlmPort` para la escalada. Más limpio conceptualmente, pero `llm.port.ts` no expone herramientas y añadirlas es un spec en sí mismo.
- **No:** botones en la UI para aceptar la redirección. La cuenta regresiva con auto-aceptación cubre el caso mejor: un paciente con un síntoma grave puede no estar en condiciones de pulsar nada.
- **No:** un `PriorityPatient` por cada escalada. La vista del médico se llenaría de duplicados del mismo paciente y el triage visual dejaría de funcionar.
- **No:** notificación real por correo o SMS. Es una cuenta externa más en el arranque, que REGLAS.md limita, y el médico ya tiene los datos de contacto en su consola.
- **No:** cerrar la sesión al desconectarse el WebSocket. Una recarga desconecta; perder la conversación al refrescar sería un fallo visible en la demo.
- **No:** un estado `'live'` en `sessions.status`. No existe y no debe existir: ese campo es un semáforo clínico.
- **No:** que el agente ofrezca subir documentos o mencione la consola de administración cuando no sabe algo. Confunde los roles: el paciente no administra la base de conocimiento.
- **No:** que el vacío de conocimiento sirva de vía de escalada urgente. Son ejes ortogonales: un síntoma de alarma documentado en el corpus nunca pasaría por ahí.
- **No:** sheet lateral responsive para el panel de citas (DESIGN.md §4.13). El modal cubre la función en todos los anchos; el sheet es refinamiento visual con coste de layout.
- **No:** reapertura de sesiones cerradas. Cerrar es terminal; una consulta nueva es una sesión nueva.
- **No:** subida múltiple de archivos en un envío. `ingest_jobs` modela un job por archivo y el progreso por lote es otra UI entera.
- **No:** embeddings de los chunks recién subidos. La rama densa entera es SPEC 09; hacerlo a medias dejaría el corpus con unos chunks vectorizados y otros no.

---

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| El spec es grande y G5 es eliminatorio | El plan está ordenado para que los pasos 1-10 cierren G5 por sí solos. Lo que se caiga, se cae por el final: el escalamiento es nota, la compuerta no. |
| Un PDF en inglés de 40 páginas subido en vivo tarda minutos y arruina el ritmo de la demo | La ingesta es asíncrona y el chat sigue vivo — es un criterio de aceptación, no un efecto colateral. Para el video, el documento de prueba se elige en español; el PDF en inglés se demuestra aparte, sin cronómetro. |
| `unpdf` en el runtime engorda la imagen de `api` y arriesga los 15 minutos de G2 | Es un wrapper de pdf.js sin dependencias nativas. Medir el tiempo de arranque tras añadirlo; si estorba, el import se hace dinámico para que solo cargue al recibir un PDF. |
| El modelo emite `[[ESCALAR]]` cuando no toca, o no lo emite cuando sí | Es el riesgo funcional principal del bloque B. La instrucción va con ejemplos explícitos de síntomas de alarma en el prompt, y la detección sobre el texto acumulado evita el falso negativo por chunk partido. Ensayar los dos casos antes de grabar. |
| El modelo emite la marca en medio de la respuesta y no al final | El sanitizer la elimina esté donde esté; la posición solo afecta a la estética del prompt, no a la detección. |
| La ingesta compite por el TPM de Groq con el chat del paciente | Cola de un job en vuelo y la concurrencia acotada que `kb-translate.ts` ya respeta. La cuenta tiene 300.000 TPM verificados (SPEC 07); un documento suelto no se acerca. |
| Añadir miembros a `ServerEvent` rompe el cliente en Docker sin motivo aparente | Trampa documentada en `CLAUDE.md`: la caché de pre-bundle de Vite del contenedor `web` no se invalida al reconstruir `shared`. `rm -rf node_modules/.vite` y `docker compose restart web` tras cada cambio de contrato. |
| El bind mount del caché de traducción no funciona igual en Linux y macOS por permisos | El contenedor escribe con el usuario del `Dockerfile`. Verificar en ambos antes de dar por bueno el paso 5; si falla, la traducción sigue viva en base y solo se pierde el seguro ante catástrofe. |
| Cerrar sesiones por inactividad cierra la sesión del jurado a mitad de evaluación | Diez minutos sin **ningún** turno es mucho para una demo activa. Aun así, dejar la constante en un solo sitio del servidor para poder subirla el día de la presentación. |
| El formulario de pre-sesión añade fricción al arranque de la demo | Cuatro campos, sin cuenta ni verificación. Es además lo que hace creíble la escalada: sin contacto, el registro del médico no sirve. |
| `refresh` del registro en cada turno posterior a la escalada dispara llamadas al LLM y latencia | Se ejecuta cada N turnos y al cerrar, no en cada mensaje, y fuera del camino crítico de la respuesta. |
| El registro se crea aunque el paciente cancele, y alguien lo lee como un falso positivo del sistema | Es deliberado y está en `outcome`: el registro dice explícitamente que la escalada se ofreció y el paciente decidió continuar. El médico decide; el sistema no filtra por él. |

---

## Lo que **no** está en este spec

- La rama vectorial del score y el índice HNSW/IVFFlat. → SPEC 09
- Notificación real al médico por correo, SMS o llamada.
- Reapertura de sesiones cerradas y mensajería del médico dentro del sistema.
- Borrado físico de documentos y almacenamiento del binario subido.
- Historial de revisiones por documento.

Cada uno, si aterriza, va en su propio spec.
