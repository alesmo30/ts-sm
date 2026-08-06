# SPEC 02 — Contratos compartidos, persistencia y API de datos

> **Estado:** Aprobado
> **Depende de:** SPEC 01
> **Fecha:** 2026-08-06
> **Objetivo:** Sustituir el andamiaje vacío por datos reales — contratos Zod compartidos, esquema Postgres con Drizzle, tres módulos REST en Nest y semilla idempotente del prototipo, consumibles desde el front con TanStack Query.

---

## Contexto — por qué existe este spec

SPEC 01 dejó tres servicios corriendo y dos rutas vacías. Este spec es el bloque M1+M2 del plan D1: la capa que todo lo demás consume. Las 4 vistas del médico (SPEC 03), la persistencia de la sesión de voz (SPEC 05) y el conocimiento en caliente (SPEC 06) leen y escriben contra lo que se define aquí.

Dos cosas se aseguran hoy y no después:

- **R0.3** — el evaluador no puede llegar a una app vacía. La semilla corre sola en el arranque del contenedor, sin comando manual.
- **El modelado anticipado.** `TranscriptTurn` con `who:'system'`, `kbVersion` e `ingest_jobs` se modelan hoy aunque su lógica llegue en D3. Retrofitear un campo que atraviesa cinco tablas cuesta el triple.

Los datos semilla salen del prototipo `voice-agent-prototype/medico.html` — 5 sesiones (`SES-4821`…`SES-4825`), 3 pacientes prioritarios, 5 referencias. Se portan con su texto literal en español.

---

## Alcance

**Dentro:**

- `packages/shared`: esquemas **Zod** de `Session`, `TranscriptTurn`, `Citation`, `PriorityPatient`, `Reference`, `IngestJob`, `SessionSummary`, más los tipos inferidos. Fuente única de verdad para api y web.
- `ZodValidationPipe` en `apps/api/src/common/pipes/`, reemplazando el `ValidationPipe` de class-validator que instaló SPEC 01.
- Esquema Drizzle con seis tablas en el schema `app`: `sessions`, `transcripts`, `priority_patients`, `references`, `ingest_jobs`, `kb_state`.
- Migración generada por `drizzle-kit` y versionada en `apps/api/src/database/migrations/`.
- Tres módulos Nest siguiendo la regla de capas de SPEC 01 (`controller` → `service` → `repository` → `drizzle`):
  - `modules/sessions` — listado con búsqueda, detalle con hilo, creación de sesión y de turnos.
  - `modules/patients` — pacientes con atención personalizada.
  - `modules/knowledge` — referencias y estado de la KB.
- Script `pnpm seed` idempotente con los datos literales del prototipo.
- Entrypoint del contenedor `api` que corre migraciones y semilla antes de `main.ts`.
- En `apps/web`: `shared/lib/apiClient.ts`, `shared/lib/queryClient.ts`, `QueryClientProvider` en `providers.tsx` y los hooks `useSessions`, `useSession`, `usePriorityPatients`, `useReferences`.
- Tests: Jest sobre cada service con el cliente Drizzle mockeado; Vitest sobre un hook con el `fetch` mockeado.

**Fuera de alcance (para specs posteriores):**

- Toda la UI del médico: tablas, panel inferior, modales, tags. Hoy los hooks se verifican con un render crudo de lista. → SPEC 03
- `LLMPort` y sus drivers. Ningún campo de estas tablas se llena con un LLM hoy. → SPEC 04
- WebSockets, micrófono, STT, TTS, y el consumo real de `POST /sessions/:id/turns` desde una sesión de voz. → SPEC 05
- Subida y borrado real de referencias, incremento de `kbVersion`, progreso de ingesta. Las tablas existen; nadie las escribe salvo la semilla. → SPEC 06
- RAG: embeddings, chunking, vector store, retrieval. La columna `citations` se modela y queda vacía. → D3
- `SessionSummary` generado. El esquema Zod existe; el valor viene de la semilla. → D3
- Paginación, ordenamiento por columna, autenticación, roles, RLS.
- Envío de correo (Resend) y `speechSynthesis` de "Simular llamada". → SPEC 03

---

## Modelo de datos

### Contratos Zod

Viven en `packages/shared/src/contracts/`, un archivo por agregado, reexportados en el barrel.

```ts
// session.contract.ts
export const SessionStatus = z.enum(['ok', 'attn', 'fail']);

export const CitationSchema = z.object({
  docId: z.string().uuid(),
  docName: z.string(),
  chunkId: z.string(),
  version: z.number().int(),
  score: z.number(),
  snippet: z.string(),
});

export const TranscriptTurnSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  seq: z.number().int(),
  who: z.enum(['patient', 'assistant', 'system']),
  text: z.string(),
  isVoice: z.boolean(),
  at: z.coerce.date(),
  citations: z.array(CitationSchema).default([]),
  kbVersion: z.number().int(),
});

export const SessionSchema = z.object({
  id: z.string().uuid(),
  code: z.string().regex(/^SES-\d{4}$/),   // SES-4821 — visible en la tabla
  date: z.string(),                         // 'YYYY-MM-DD'
  time: z.string(),                         // 'HH:mm'
  patientName: z.string(),
  procedure: z.string(),
  status: SessionStatus,
  kbVersion: z.number().int(),
  summary: z.string().nullable(),           // caja "Resumen de recomendaciones enviado al paciente"
  structuredSummary: SessionSummarySchema.nullable(), // null en D1, se llena en D3
  createdAt: z.coerce.date(),
});
```

```ts
// summary.contract.ts — esquema declarado hoy, productor en D3
export const SessionSummarySchema = z.object({
  recommendations: z.array(z.string()),
  alerts: z.array(z.string()),
  escalated: z.boolean(),
  metrics: z.object({
    turns: z.number().int(),
    durationSeconds: z.number().int(),
    ttftMs: z.number().int().nullable(),
    inputTokens: z.number().int(),
    outputTokens: z.number().int(),
    costUsd: z.number(),
  }),
});
```

```ts
// patient.contract.ts
export const PriorityPatientSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid().nullable(),  // enlaza con la sesión que lo escaló
  patientName: z.string(),
  procedure: z.string(),
  requestedBy: z.string(),                  // 'Asistente de voz' | 'Paciente'
  status: SessionStatus,
  llmSummary: z.string(),
  outcome: z.string(),                      // 'Escalado a atención humana'
  durationSeconds: z.number().int(),        // 372 → la UI formatea '6 min 12 s'
  caseNotes: z.string(),
});
```

```ts
// knowledge.contract.ts
export const ReferenceType = z.enum(['PDF', 'MD', 'TXT', 'JSON', 'NOTA']);

export const ReferenceSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  type: ReferenceType,
  addedAt: z.coerce.date(),
  sizeBytes: z.number().int().nullable(),   // null en NOTA → la UI pinta '—'
  active: z.boolean(),
  version: z.number().int(),
  chunks: z.number().int(),                 // 0 hasta que exista RAG (D3)
  body: z.string(),                         // contenido del visor modal
});

export const IngestStage = z.enum([
  'Recibido', 'Extrayendo texto', 'Fragmentando', 'Generando embeddings', 'Indexado',
]);

export const IngestJobSchema = z.object({
  id: z.string().uuid(),
  referenceId: z.string().uuid().nullable(),
  fileName: z.string(),
  stage: IngestStage,
  pct: z.number().int().min(0).max(100),
  error: z.string().nullable(),
});

export const KbStateSchema = z.object({ version: z.number().int() });
```

Las cinco etapas de `IngestStage` son literales de `DESIGN.md` §4.10, en ese orden y con ese texto.

### Tablas Drizzle

En `apps/api/src/database/schema/`, todas bajo el schema `app`.

| Tabla | Claves e índices |
|---|---|
| `sessions` | pk `id` uuid · único `code` · índice en `patient_name`, `procedure` para el `ILIKE` |
| `transcripts` | pk `id` · fk `session_id` on delete cascade · único (`session_id`, `seq`) · `citations` jsonb default `[]` |
| `priority_patients` | pk `id` · fk `session_id` nullable on delete set null |
| `references` | pk `id` · índice en `active` |
| `ingest_jobs` | pk `id` · fk `reference_id` nullable |
| `kb_state` | pk `id` smallint con `CHECK (id = 1)` · `version` int not null default 1 |

### Contrato REST

Todas las respuestas se validan contra los esquemas de arriba.

| Método | Ruta | Notas |
|---|---|---|
| `GET` | `/sessions?q=` | `q` opcional, `ILIKE` sobre `patient_name`, `code`, `procedure`. Sin `q` devuelve todo. Sin turnos |
| `GET` | `/sessions/:id` | sesión + `turns: TranscriptTurn[]` ordenados por `seq` |
| `POST` | `/sessions` | body `{ patientName, procedure }`. Asigna `code` siguiente y `kbVersion` vigente. 201 |
| `POST` | `/sessions/:id/turns` | body `TranscriptTurn` sin `id`/`seq`/`kbVersion`. El servidor los asigna. 201 |
| `PATCH` | `/sessions/:id` | solo `{ status, summary }` — el cierre de sesión de SPEC 05 |
| `GET` | `/patients/priority` | listado completo |
| `GET` | `/patients/priority/:id` | detalle |
| `GET` | `/knowledge/references` | solo `active = true` |
| `GET` | `/knowledge/state` | `{ version }` para el chip `KB v1` |

El siguiente `code` sale de `SELECT max(code) FROM app.sessions` dentro de la misma transacción del `INSERT`. Con un solo escritor es suficiente; no hay secuencia de Postgres porque el formato es de presentación.

---

## Plan de implementación

Cada paso deja el sistema arrancable y es commiteable por sí solo.

**1. Contratos Zod en `packages/shared`**
`zod` como dependencia del paquete. Cinco archivos en `src/contracts/`: `session.contract.ts`, `summary.contract.ts`, `patient.contract.ts`, `knowledge.contract.ts`, y el barrel `index.ts` que reexporta esquemas y tipos inferidos. `health.contract.ts` no se toca.
_Verificación:_ `pnpm typecheck` pasa en las tres workspaces.

**2. `ZodValidationPipe` y retiro de class-validator**
`common/pipes/zod-validation.pipe.ts`: recibe un `ZodSchema`, devuelve el valor parseado, lanza `BadRequestException` con los `issues` aplanados. En `main.ts` se quita el `ValidationPipe` global de SPEC 01. `health.dto.ts` se migra al contrato de shared. `class-validator` y `class-transformer` salen de `package.json`.
_Verificación:_ `curl localhost:3000/health` sigue devolviendo `{"status":"ok","db":"connected"}`.

**3. Esquema Drizzle y migración**
Seis archivos en `database/schema/` (`sessions.ts`, `transcripts.ts`, `priority-patients.ts`, `references.ts`, `ingest-jobs.ts`, `kb-state.ts`) más el barrel. `drizzle.config.ts` en `apps/api`. `pnpm --filter api db:generate` produce el SQL en `database/migrations/`, que se commitea.
_Verificación:_ `pnpm --filter api db:migrate` contra la db local; `\dt app.*` lista las seis tablas.

**4. Script de semilla**
`apps/api/src/database/seed.ts` con los datos literales de `medico.html`. Idempotente: `INSERT ... ON CONFLICT DO NOTHING` sobre `code` en `sessions` y sobre `name` en `references`; `kb_state` arranca en `version = 1`. Script raíz `pnpm seed`.
_Verificación:_ correr `pnpm seed` dos veces seguidas deja 5 sesiones, 3 pacientes prioritarios y 5 referencias — no 10, 6 y 10.

**5. Módulo `sessions`**
`sessions.controller.ts` · `sessions.service.ts` · `sessions.repository.ts` · `dto/`. Los cinco endpoints de la tabla de contratos. El repository es el único que importa Drizzle. Test Jest del service con el repository mockeado: búsqueda con `q`, detalle con turnos ordenados, asignación de `seq` y `kbVersion` al crear un turno.
_Verificación:_ `curl "localhost:3000/sessions?q=marcela"` devuelve 2 sesiones.

**6. Módulos `patients` y `knowledge`**
Misma estructura de cuatro archivos. `patients` sirve los prioritarios; `knowledge` sirve referencias activas y `GET /knowledge/state`. Test Jest de un service por módulo.
_Verificación:_ `curl localhost:3000/knowledge/state` devuelve `{"version":1}`.

**7. Arranque automático del contenedor**
`apps/api/docker-entrypoint.sh`: espera a la db, corre `db:migrate`, corre `seed`, luego `node dist/main.js`. Se referencia desde el `Dockerfile` de la api. El healthcheck del compose no cambia.
_Verificación:_ `docker compose down -v && docker compose up` deja la db poblada sin ningún comando manual.

**8. Capa de datos en `apps/web`**
`shared/lib/apiClient.ts` (wrapper de `fetch` con `VITE_API_URL`, que valida cada respuesta con su esquema Zod y lanza en caso de mismatch), `shared/lib/queryClient.ts`, `QueryClientProvider` en `providers.tsx`. Hooks en la feature que los usa: `features/medico/api/useSessions.ts`, `useSession.ts`, `usePriorityPatients.ts`, `useReferences.ts`.
_Verificación:_ una lista `<ul>` provisional en `MedicoPage` pinta los 5 `code` de sesión traídos de la API.

**9. Cierre**
Test Vitest de `useSessions` con `fetch` mockeado. `README.md`: sección de endpoints y nota de que la semilla corre sola. Anotar fricciones en `plan/01-jueves/D1-jue-06-ago.md`.

La lista `<ul>` provisional del paso 8 es andamio deliberado: la reemplaza la tabla real de SPEC 03. Está ahí para que este spec tenga verificación visual propia y no dependa del siguiente.

---

## Criterios de aceptación

- [ ] `docker compose down -v && docker compose up` deja la API respondiendo con datos, sin ningún comando manual intermedio
- [ ] `docker compose exec db psql -U postgres -d tssm -c "\dt app.*"` lista las seis tablas: `sessions`, `transcripts`, `priority_patients`, `references`, `ingest_jobs`, `kb_state`
- [ ] `curl localhost:3000/sessions` devuelve exactamente 5 sesiones con los códigos `SES-4821` … `SES-4825`
- [ ] `curl "localhost:3000/sessions?q=marcela"` devuelve 2 sesiones; `?q=SES-4823` devuelve 1; `?q=zzz` devuelve `[]`
- [ ] `curl localhost:3000/sessions/<id>` de `SES-4821` devuelve 4 turnos con `seq` 0,1,2,3 y `who` alternando `patient`/`assistant`
- [ ] `POST /sessions` con `{"patientName":"Prueba","procedure":"Control"}` devuelve 201 y `code: "SES-4826"`
- [ ] `POST /sessions/:id/turns` dos veces seguidas produce turnos con `seq` 0 y 1, ambos con el `kbVersion` vigente
- [ ] `POST /sessions` con body vacío devuelve 400 y el cuerpo nombra los campos faltantes
- [ ] `curl localhost:3000/patients/priority` devuelve 3 registros, el primero Jorge Restrepo con `status: "attn"`
- [ ] `curl localhost:3000/knowledge/references` devuelve 5 referencias, una por cada tipo del enum
- [ ] `curl localhost:3000/knowledge/state` devuelve `{"version":1}`
- [ ] `pnpm seed` corrido dos veces deja 5 sesiones, 3 pacientes prioritarios y 5 referencias
- [ ] `grep -rn "class-validator\|class-transformer" apps/api/src package.json apps/api/package.json` no devuelve nada
- [ ] `grep -rn "drizzle" apps/api/src/modules --include="*.service.ts" --include="*.controller.ts"` no devuelve nada
- [ ] `/medico` pinta los 5 códigos de sesión traídos por `useSessions`, sin datos hardcodeados en el componente
- [ ] Con la API caída, `/medico` no rompe: el hook expone el estado de error
- [ ] Una respuesta que no cumpla su esquema Zod hace fallar `apiClient` con un error explícito, no propaga datos inválidos
- [ ] `pnpm lint`, `pnpm typecheck` y `pnpm test` pasan en las tres workspaces
- [ ] Los tests incluyen al menos un Jest por cada uno de los tres services y un Vitest sobre `useSessions`
- [ ] `curl localhost:3000/health` sigue devolviendo `{"status":"ok","db":"connected"}`

---

## Decisiones tomadas y descartadas

**Contratos y validación**

- **Sí:** Zod en `packages/shared` como fuente única. Los mismos esquemas validan en la api y en el `apiClient` del front. Un cambio de contrato rompe la compilación de ambos lados en el mismo commit.
- **Sí:** `ZodValidationPipe` reemplaza el `ValidationPipe` de class-validator que instaló SPEC 01. Mantener las dos obliga a escribir cada contrato en dos sintaxis y a mantenerlas sincronizadas a mano.
- **No:** class-validator con clases DTO. Es el canónico en NestJS, pero sus decoradores no se pueden compartir con el front.
- **Sí:** el `apiClient` valida la respuesta contra el esquema y lanza si no cumple. Un backend que devuelve basura debe fallar en la frontera, no tres componentes más adentro.

**Nombres y forma de los datos**

- **Sí:** campos en inglés, valores en español. `patientName`, `procedure`, `status`, `requestedBy`. Consistente con `HealthResponse` y `LlmPort` de SPEC 01.
- **No:** campos en español literales al prototipo (`paciente`, `proc`, `estado`). Ahorra una traducción de una sola vez y deja el código en dos idiomas para siempre.
- **Sí:** `durationSeconds: 372` en vez de `'6 min 12 s'`. La DB guarda el dato, la UI decide el formato. El string del prototipo no es ordenable ni sumable.
- **Sí:** `uuid` como pk más columna `code` legible (`SES-4821`). El formato `SES-NNNN` es de presentación y no debe ser la llave.
- **No:** `SES-NNNN` como pk. Ata el modelo a un formato de UI y complica el enlace desde `transcripts` y `priority_patients`.
- **Sí:** el siguiente `code` sale de `max(code)` dentro de la transacción del insert. Un solo escritor, cero infraestructura. Si en D4 hay sesiones concurrentes, se cambia a una secuencia de Postgres.

**Persistencia**

- **Sí:** tabla `transcripts` con una fila por turno. La sesión de voz de SPEC 05 inserta turno a turno; un jsonb obligaría a reescribir el hilo completo en cada intervención.
- **No:** el hilo como columna jsonb en `sessions`. Menos tablas, pero las `citations` quedan fuera del alcance de cualquier consulta en D3.
- **Sí:** `citations` como jsonb dentro de `transcripts`. Se leen siempre junto a su turno y nunca se consultan por separado; una tabla propia sería un join sin beneficio.
- **Sí:** `kb_state` como tabla singleton con `CHECK (id = 1)`. Un lugar único donde leer la versión vigente e incrementarla atómicamente en SPEC 06.
- **No:** tabla `kb_versions` con historial. Más trazable para el informe, pero nadie la consume en D1 y son dos tablas más que sembrar.
- **Sí:** `ingest_jobs` y `IngestJob` se crean hoy sin lógica. Mismo criterio que `TranscriptTurn` con `who:'system'`: el campo que atraviesa varias tablas se modela antes, no después.
- **Sí:** `structuredSummary` declarado y `null` en D1. El esquema queda fijado hoy; el productor llega en D3 sin migración adicional.
- **Sí:** filtrado en servidor con `ILIKE` y `?q=`. Con 5 filas da igual, con 500 no, y retrofitear el hook de TanStack Query cuesta más que escribir el `WHERE`.
- **No:** filtrar el array en el cliente como hace el prototipo.
- **No:** paginación. Cinco registros. Se agrega cuando exista el problema.

**Arranque**

- **Sí:** entrypoint del contenedor que corre `migrate` y `seed` antes de `main.ts`. R0.3 exige que el evaluador ejecute un solo comando y encuentre datos.
- **No:** servicio `migrator` one-shot en el compose. Más limpio, pero Docker 20.10.22 con Compose v2.15.1 maneja peor el `depends_on: service_completed_successfully`, y SPEC 01 ya identificó esa versión como restricción.
- **No:** semilla en `docker/db/init.sql`. Solo corre al crear el volumen, no es idempotente entre rebuilds y duplicaría el esquema fuera de Drizzle.
- **Sí:** semilla idempotente por `ON CONFLICT DO NOTHING` sobre columnas naturales (`code`, `name`). Un `TRUNCATE` borraría sesiones creadas durante una demo.

**Módulos y front**

- **Sí:** tres módulos Nest (`sessions`, `patients`, `knowledge`) en vez del único `sessions` que decía el plan D1. `knowledge` es la frontera por donde entra el RAG en D3; nacer partido evita moverlo después.
- **Sí:** el setup de TanStack Query entra en este spec, no en SPEC 03. Sin él este spec no tiene verificación de punta a punta y SPEC 03 arrancaría sin datos.
- **Sí:** los hooks viven en `features/medico/api/`, no en `shared/`. La regla de capas de SPEC 01 permite que una feature tenga su propia carpeta `api/`; suben a `shared/` solo si SPEC 05 los necesita desde `paciente`.
- **Sí:** una lista `<ul>` provisional en `MedicoPage` como verificación del paso 8. Andamio explícito que SPEC 03 reemplaza; se documenta para que nadie lo confunda con la tabla real.

---

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Quitar el `ValidationPipe` global rompe el módulo `health` que ya funciona | El paso 2 no se cierra sin volver a verificar `curl localhost:3000/health`. Es criterio de aceptación, no revisión a ojo |
| El entrypoint corre antes de que Postgres acepte conexiones y el contenedor muere | El script espera a la db con reintentos antes de migrar. El `depends_on: condition: service_healthy` de SPEC 01 ayuda pero no garantiza que el socket acepte queries |
| La semilla falla a medias y deja la db en estado parcial | Toda la semilla corre dentro de una transacción. O entra completa o no entra |
| `drizzle-kit generate` desincronizado con el esquema TypeScript | La migración se commitea junto al esquema en el mismo paso 3. Nunca se usa `push` contra la db del contenedor |
| El `rootDir` frágil detectado en SPEC 01 se rompe al agregar contratos a `shared` | Ya está anotado como fricción en `plan/01-jueves/D1-jue-06-ago.md`. El paso 1 termina con `pnpm typecheck` en las tres workspaces antes de seguir |
| Se cuela UI del médico "ya que estamos" | El bloque "Fuera de alcance" es vinculante. La única UI de este spec es una `<ul>` provisional |
| Sobremodelar `SessionSummary` sin saber qué produce el LLM obligatorio | El esquema fija la forma mínima y el valor es `null` en D1. Si el modelo del 7 de agosto obliga a otra forma, se cambia un archivo de contrato y una columna jsonb |

---

## Lo que **no** entra en este spec

- Tablas, panel inferior, modales y tags de la vista médico. → SPEC 03
- `LLMPort` y sus drivers. Ningún campo se llena con un LLM hoy. → SPEC 04
- WebSockets, micrófono, STT, TTS. → SPEC 05
- Subida y borrado real de referencias, incremento de `kbVersion`, progreso de ingesta. → SPEC 06
- RAG: embeddings, chunking, vector store, retrieval. → D3
- Generación del resumen estructurado. → D3
- Paginación, ordenamiento, autenticación, roles, RLS.

Cada uno, si aterriza, va en su propio spec.
