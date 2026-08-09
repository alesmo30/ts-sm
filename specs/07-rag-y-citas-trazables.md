# SPEC 07 — RAG clínico con citas trazables

> **Estado:** Implementado (2026-08-08)
> **Depende de:** SPEC 02, SPEC 04, SPEC 05
> **Fecha:** 2026-08-08
> **Objetivo:** Que cada respuesta clínica del agente se construya sobre fragmentos recuperados del corpus real y quede rastreable hasta el documento que la sustenta, usando búsqueda de texto completo en español de Postgres.

---

## Contexto — por qué existe este spec

SPEC 05 dejó `/paciente` con una conversación completa sobre `LlmPort`, y SPEC 06 le puso voz. Pero el agente responde hoy **solo con su `SYSTEM_PROMPT`**: no consulta ningún documento. `conversation.service.ts` persiste `citations: []` fijo en el turno del paciente (`:49`) y en el del asistente (`:163`), y `references.chunks` sigue en `0` para todas las filas. La columna `transcripts.citations` (jsonb) y el contrato `Citation` existen desde SPEC 02 esperando exactamente a este spec.

Esto es lo que cierra los 20 pts de *RAG, precisión clínica y conocimiento vivo* de la rúbrica, y lo que habilita el SPEC 08 (subida y borrado de documentos desde la consola del médico).

**Hallazgo que cambia el diseño previsto en `plan/nuevos-enfoques/01-rag-y-citas.md`.** Ese plan asumía que el corpus estaba en español y que bastaba con `to_tsvector('spanish', ...)`. La inspección de `dataset-reto/dataset/textos/` desmiente el supuesto: son **107 PDFs, ~55 en español y ~52 en inglés, mezclados en las mismas carpetas** (`Apendicitis.pdf` convive con `Acute Appendicitis Evidence Based Medicine Guideline.pdf`). Una consulta en español nunca hace match por FTS contra un documento en inglés, sin importar la configuración de stemming.

La salida elegida es traducir los fragmentos en inglés al español **una sola vez, offline, a través de `LlmPort`**. Es el mismo y único LLM permitido por REGLAS.md — no se introduce un segundo modelo generativo. El coste queda horneado en el seed: cero tokens y cero latencia en runtime, que es donde la rúbrica mide.

---

## Alcance

**Dentro:**

- Tabla `app.reference_chunks` con `tsvector` en español generado e índice GIN. Se deja preparada la columna `embedding vector(768)` **nullable y vacía**, para que la rama densa sea aditiva.
- `apps/api/src/modules/knowledge/chunker.ts`: fragmentación por párrafos, función pura, sin tokenizador.
- `apps/api/src/database/kb-ingest.ts` (`pnpm kb:ingest`): extrae texto de los PDFs de `KNOWLEDGE_LOCAL_DIR`, detecta idioma, fragmenta y llena `references` + `reference_chunks`.
- `apps/api/src/database/kb-translate.ts` (`pnpm kb:translate`): traduce al español los chunks marcados como `english` vía `LlmPort`, de forma **reanudable**, conservando el original.
- `apps/api/src/modules/knowledge/retrieval.service.ts`: `search(query, k)` → `Citation[]`, con el cálculo del score en una función aislada.
- Enriquecimiento de la consulta: se busca con la última pregunta del asistente **más** el texto del paciente, no solo con el del paciente.
- Inyección del contexto recuperado en el mensaje `system` de la conversación, y persistencia de las `Citation[]` en el turno del asistente.
- Honestidad ante el vacío: sin material relevante, el agente declara el límite y redirige al médico en vez de improvisar.
- `apps/api/src/database/kb-cache/`: un `.md` por documento traducido, versionado en git, escrito incrementalmente por `kb:translate` y consultado antes de cada llamada al LLM.
- `apps/api/src/database/kb-dump.ts` (`pnpm kb:dump`) → `seed-data/kb-corpus.json.gz`, que `seed.ts` carga para que `docker compose up` arranque con el corpus listo.
- `pnpm dataset:fetch` y la variable `KNOWLEDGE_LOCAL_DIR` en `.env.example`.
- Dependencia nueva en `apps/api`: `unpdf`.

**Fuera de alcance (para specs posteriores):**

- **La rama vectorial del score.** Este spec deja el terreno listo: la columna existe y el score es una función aislada. → SPEC 09
- Índice vectorial (HNSW/IVFFlat). Sin datos no aporta nada. → SPEC 09
- Subir y eliminar documentos desde la consola del médico. → SPEC 08
- Mostrar los chips de cita en la UI. El dato ya se persiste aquí. → SPEC 08
- Turno `who:'system'` de actualización de conocimiento y chip `KB vN` dinámico. → SPEC 08
- Reranking y reformulación de la consulta con el LLM.
- Traducción en runtime de la consulta del paciente.
- Persistir métricas de retrieval en base de datos.

---

## Modelo de datos

Una sola tabla nueva. Nada existente cambia de forma.

```
app.reference_chunks
  id           uuid    PK default gen_random_uuid()
  reference_id uuid    NOT NULL  FK → app.references(id) ON DELETE CASCADE
  seq          integer NOT NULL            -- orden dentro del documento
  text         text    NOT NULL            -- el fragmento, siempre en español
  source_text  text    NULL                -- original en inglés; NULL si el documento ya era español
  lang         text    NOT NULL            -- 'spanish' | 'english' — idioma ORIGINAL del documento
  translated   boolean NOT NULL default false
  tsv          tsvector GENERATED ALWAYS AS (to_tsvector('spanish', text)) STORED
  embedding    vector(768) NULL            -- vacía hoy; la llena SPEC 09

  reference_chunks_tsv_idx   GIN   (tsv)
  reference_chunks_ref_idx   btree (reference_id, seq)
```

Convenciones:

- `text` **siempre** acaba en español, por eso `tsv` usa una única configuración (`spanish`) y no hace falta `regconfig` dinámico.
- `lang` describe el documento de origen, no el contenido actual de `text`. Un chunk con `lang='english'` y `translated=true` tiene `text` en español y `source_text` en inglés.
- `translated=false` con `lang='spanish'` es el estado normal de un documento hispano: no hay nada que traducir.
- `references.body` guarda los primeros ~500 caracteres del documento como preview legible. No duplica el corpus.
- La columna `chunks` de `references` deja de ser decorativa: la llena la ingesta.

El contrato `Citation` (`packages/shared/src/contracts/session.contract.ts:8-15`) ya tiene exactamente los campos necesarios — `docId`, `docName`, `chunkId`, `version`, `score`, `snippet` — y **no se toca**. `TranscriptTurnSchema` ya acepta `citations`; el cableado consiste en dejar de pasar `[]`.

---

## Plan de implementación

1. **Schema + migración.** Crear `database/schema/reference-chunks.ts` y exportarlo desde `schema/index.ts`. `tsvector` y `vector(768)` se declaran con `customType` de Drizzle. Generar con `pnpm --filter api db:generate` y **editar a mano el archivo generado** para añadir: `CREATE EXTENSION IF NOT EXISTS vector` defensivo, la cláusula `GENERATED ALWAYS AS ... STORED` de `tsv`, y el índice GIN. Es el primer SQL manuscrito del repositorio — dejar un comentario en la migración explicando por qué (`schemaFilter: ['app']` en `drizzle.config.ts:13` hace invisibles las extensiones a Drizzle, y `docker/db/init.sql` solo corre en volumen nuevo). Verificación: `pnpm --filter api db:migrate` aplica limpio y `\d app.reference_chunks` muestra las dos columnas especiales.
2. **`pnpm dataset:fetch` y variables.** Script en el `package.json` raíz que hace `git clone --depth 1` de `github.com/TechSphere2026/ParticipantArtifacts` a `dataset-reto/` si no existe. Añadir `KNOWLEDGE_LOCAL_DIR=./dataset-reto/dataset/textos` a `.env.example` y documentar el flujo en el README. Verificación: borrar `dataset-reto/`, correr el script, recuperar los 107 PDFs.
3. **Fragmentador.** `modules/knowledge/chunker.ts` con `chunkByParagraphs(text, maxChars, overlap)`, portado de `invoice-system`: divide por `\n\n` sin cortar párrafos, con techo de caracteres y solape pequeño. Función pura sin dependencias. Su `chunker.spec.ts` en el mismo commit. Verificación: `pnpm --filter api test -- chunker` en verde.
4. **Script de ingesta.** `database/kb-ingest.ts`, ejecutado con `tsx` igual que `seed.ts` (mismo patrón de `Pool` + `drizzle` + transacción). Recorre `KNOWLEDGE_LOCAL_DIR` recursivamente (las carpetas tienen espacios en el nombre), extrae texto con `unpdf`, detecta idioma por frecuencia de stopwords, calcula `body` = primeros 500 caracteres, fragmenta y escribe `references` + `reference_chunks`, y actualiza `references.chunks`. Idempotente por `references.name` con `onConflictDoNothing`, igual que el seed actual. Los archivos sin capa de texto (hay al menos un PDF escaneado en `Appendicitis/`) se **registran en el reporte final sin abortar**. Script `"kb:ingest"` en `apps/api/package.json` y en el raíz. Verificación: correrlo dos veces seguidas y comprobar que la segunda no duplica filas.
5. **Caché en disco.** `database/kb-cache.ts`: `readCache(docSlug)` y `appendCache(docSlug, entry)` sobre `database/kb-cache/<slug-del-documento>.md`. Formato por chunk: una sección `## chunk NNNN` con `hash: <sha1 de los primeros 512 caracteres del texto original>`, un bloque con el original y otro con la traducción. Markdown legible, para poder revisar a ojo una traducción sospechosa. Su `kb-cache.spec.ts` (round-trip escribir → leer) en el mismo commit.
6. **Traductor reanudable.** `database/kb-translate.ts`: selecciona los chunks con `lang='english' AND translated=false`. Por cada uno, **primero consulta el caché por `hash`**; si acierta, usa esa traducción sin llamar al LLM. Si falla, llama a `LlmPort.complete()` con una instrucción de traducción literal es-CO y **escribe el caché antes de tocar la base**. Luego actualiza la fila en una sola sentencia: `source_text = text`, `text = <traducción>`, `translated = true`. Commit por chunk, concurrencia acotada (4 en vuelo, ~42% del TPM de la cuenta) y reintento con backoff ante error de red o `429`. Imprime progreso `n/total` distinguiendo aciertos de caché de llamadas reales. Script `"kb:translate"`. Verificación: matarlo a mitad, relanzarlo, y confirmar que retoma sin retraducir; y borrar la base entera, reingerir y relanzarlo, confirmando que **cero llamadas al LLM** ocurren.
7. **Servicio de retrieval.** `modules/knowledge/retrieval.service.ts` con `search(query: string, k = 4): Promise<Citation[]>`: `plainto_tsquery('spanish', $1)` contra `tsv`, `ts_rank` para ordenar, `JOIN app.references` filtrando **`active = true`** (obligatorio: es lo que hace que "eliminar un documento" en SPEC 08 sea instantáneo sin reindexar), `LIMIT k`. Devuelve el contrato `Citation` directo, sin tipo intermedio; `snippet` es el `text` del chunk recortado. El cálculo del score vive en una función propia y aislada, para que SPEC 09 le sume el término denso en una línea. **Exportar el provider en `knowledge.module.ts`** — hoy el módulo no exporta nada. Su `retrieval.service.spec.ts` con el cliente Drizzle mockeado, en el mismo commit.
8. **Cableado en la conversación.** En `conversation.service.ts`, antes de armar los mensajes: construir la **consulta enriquecida** concatenando el texto del último turno del asistente con el del paciente, llamar a `retrieval.search(...)`, e inyectar los fragmentos como bloque de contexto en el mensaje `system`. Pasar las `Citation[]` a `addTurn` del turno del asistente, reemplazando el `[]` de `:163` (el turno del paciente conserva `[]`). `conversation.prompt.ts` pasa de constante plana a `buildSystemPrompt(citations: Citation[]): string`, añadiendo la instrucción de fundamentar la respuesta en el contexto y de **declarar el límite y redirigir al médico cuando no hay material** — es lo que la rúbrica observa. Respetar la restricción de texto plano sin markdown que SPEC 06 impuso por TTS. Loguear la consulta enviada al retrieval. `kbVersion` **no se toca**: lo sigue resolviendo `sessions.repository.ts:118-119` dentro de su transacción.
9. **Volcado del seed.** `database/kb-dump.ts` (`pnpm kb:dump`) escribe `database/seed-data/kb-corpus.json.gz` con las filas de `references` y `reference_chunks`. `seed.ts` lo lee si existe y lo inserta dentro de su transacción con `onConflictDoNothing`, sin tocar `docker-entrypoint.sh` ni añadir `psql` a la imagen. Verificación: `docker compose down -v && docker compose up` arranca con el corpus cargado.
10. **Tests de conversación.** Extender `conversation.service.spec.ts`: que la consulta enviada al retrieval contenga el texto del asistente y el del paciente, y que las citas devueltas lleguen a `addTurn`. Verificación: `pnpm lint`, `pnpm typecheck` y `pnpm test` en verde.

Cada paso deja el sistema corriendo y commitable.

### Dónde viven las traducciones

Importa porque son ~$1 y ~15 minutos de trabajo que no se quieren repetir. Cada traducción cae en **tres** sitios, en este orden:

| Orden | Dónde | Cuándo | Sobrevive a `down -v` | Sobrevive a perder la máquina |
| --- | --- | --- | --- | --- |
| 1 | `database/kb-cache/<doc>.md` | Antes de tocar la base, chunk a chunk | ✅ | ✅ (versionado) |
| 2 | `app.reference_chunks` en Postgres | Inmediatamente después, commit por chunk | ❌ | ❌ |
| 3 | `seed-data/kb-corpus.json.gz` | Al correr `kb:dump` | ✅ | ✅ (versionado) |

**El caché se escribe primero, y esa precedencia es el punto entero.** Si el proceso muere entre la escritura al caché y el `UPDATE`, la traducción ya está a salvo en disco y el relanzamiento la recupera desde ahí. El orden inverso perdería una llamada al LLM por cada muerte inoportuna.

Los tres artefactos tienen roles distintos y ninguno sustituye a los otros:

- **El caché es el seguro contra catástrofe.** Está indexado por hash del texto original, así que sirve aunque la base se borre entera, aunque cambie el esquema, y aunque `dataset-reto/` desaparezca. Guarda original **y** traducción, de modo que `source_text` —y con él la trazabilidad de la cita— se puede reconstruir sin los PDFs. Es markdown legible: sirve además para revisar a ojo una traducción sospechosa.
- **La base es el estado operativo**, lo que consulta el retrieval. `translated=true` es el marcador de progreso, por eso reanudar no necesita fichero de checkpoint.
- **El `.gz` es lo que arranca el `docker compose up` del jurado**, cargado por `seed.ts`.

Regla operativa: correr `pnpm kb:dump` y commitear `.gz` **y** `kb-cache/` en cuanto `kb:translate` termine. Con el caché versionado, el peor escenario ya no es "repetir $1 y 15 minutos", sino reingerir los PDFs y relanzar `kb:translate`, que resolverá los ~1.440 chunks desde disco sin una sola llamada al LLM.

---

## Criterios de aceptación

- [ ] `pnpm dataset:fetch` recupera `dataset-reto/` en una máquina donde no existe.
- [ ] `pnpm kb:ingest` procesa la carpeta local y reporta documentos ingeridos, chunks creados y archivos sin texto extraíble, sin abortar por ninguno de estos últimos.
- [ ] Correr `pnpm kb:ingest` dos veces seguidas no duplica filas en `references` ni en `reference_chunks`.
- [ ] `references.chunks` deja de ser `0` para los documentos ingeridos.
- [ ] `pnpm kb:translate` es reanudable: interrumpirlo y relanzarlo no retraduce ningún chunk ya marcado.
- [ ] Tras completar `pnpm kb:translate`, `select count(*) from app.reference_chunks where lang='english' and translated=false` devuelve `0`.
- [ ] Para un chunk con `translated=true`, `source_text` conserva el texto original y ese texto existe literalmente en el PDF de origen.
- [ ] Para un chunk con `lang='spanish'`, el `snippet` de su cita existe literalmente en el documento citado.
- [ ] Matar `kb:translate` a mitad y consultar la base muestra los chunks ya traducidos con su texto en español: el progreso está persistido, no en memoria.
- [ ] Tras `pnpm kb:dump`, un `docker compose down -v && docker compose up` reconstruye la base con las traducciones intactas, sin volver a llamar al LLM.
- [ ] `database/kb-cache/` contiene un `.md` por documento traducido, y cada sección de chunk trae `hash`, texto original y traducción.
- [ ] Borrar la base entera, correr `pnpm kb:ingest` y luego `pnpm kb:translate` completa la traducción con **cero llamadas al LLM** — el reporte final indica 100% de aciertos de caché.
- [ ] Un chunk cuyo `.md` de caché se borra a mano vuelve a traducirse en la siguiente corrida; los demás no.
- [ ] Una pregunta clínica sobre un procedimiento del corpus (ej. cuidados tras colecistectomía) produce una respuesta cuyo contenido corresponde a un documento real del corpus.
- [ ] El turno del asistente queda persistido con `citations` no vacío, y cada cita trae `docName`, `chunkId`, `score` y `snippet`.
- [ ] Una pregunta fuera del corpus obtiene una respuesta que declara el límite y redirige al médico, sin inventar contenido clínico.
- [ ] `update app.references set active=false where id=...` hace que ese documento deje de aparecer en las citas, sin reindexar ni reiniciar el servicio.
- [ ] La consulta enviada al retrieval incluye la última pregunta del asistente y no solo el texto del paciente — verificable en el log.
- [ ] La columna `embedding vector(768)` existe, está vacía y no rompe ninguna consulta.
- [ ] `pnpm lint`, `pnpm typecheck` y `pnpm test` en verde.
- [ ] `docker compose down -v && docker compose up` arranca con el corpus ya cargado, sin correr la ingesta ni la traducción.

---

## Decisiones

**Tomadas:**

- **Sí:** `to_tsvector('spanish', ...)` + `ts_rank` + índice GIN. Verificado contra nuestra instancia: `pg_ts_config` trae `spanish` y `plainto_tsquery('spanish','dolor fiebre')` hace match sobre texto clínico.
- **Sí:** ingerir los 107 documentos, no un subconjunto. Los PDFs son la esencia del desarrollo: la cita tiene que poder nombrar el documento real que sustenta la respuesta.
- **Sí:** traducir al español los chunks en inglés, offline, vía `LlmPort.complete()`. Es **el mismo modelo ya configurado** — `llama-3.3-70b-versatile` sobre el driver `openai` apuntando al gateway de Groq (`OPENAI_BASE_URL=https://api.groq.com/openai/v1`), la familia que exige G3. `kb:translate` **no elige modelo**: hereda `LLM_MODEL`. `REGLAS.md:73` prohíbe un *segundo* modelo generativo para tareas auxiliares, no reutilizar el único. Coste medido sobre el corpus real — 51 documentos en inglés, **720 páginas** — : ~655k tokens de entrada y ~730k de salida, que con el precio de `pricing.ts:9` para ese modelo ($0.59/$0.79 por millón) son **~$1.00** en total (rango $0.80-$1.30), una sola vez.
- **No:** Claude, GPT ni ningún otro modelo para la traducción, ni siquiera por ser "solo traducir". Es literalmente el caso que `REGLAS.md:73` marca como descalificable.
- **Sí:** caché en disco de las traducciones, un `.md` por documento en `database/kb-cache/`, **versionado en git**. Es lo único que hace real la protección ante catástrofe: un `down -v`, un disco muerto o un clon nuevo se recuperan sin volver a pagar la traducción. ~2.5 MB de texto plano que git comprime y diffea bien, y es texto derivado de los mismos PDFs que el `.gz` que ya se iba a commitear — no añade exposición nueva.
- **Sí:** el caché se escribe **antes** del `UPDATE` a la base. Si el proceso muere en medio, la llamada al LLM ya está pagada y guardada; el orden inverso la perdería.
- **Sí:** clave del caché por hash del texto original, no por `chunkId`. Sobrevive a que se borre la base, a que cambie el esquema y a que se pierdan los PDFs.
- **Sí:** la traducción es un comando aparte y reanudable, no un paso dentro de `kb:ingest`. Un fallo a mitad no obliga a reprocesar nada, y el retrieval ya funciona sobre la mitad hispana mientras el traductor corre en background.
- **Sí:** conservar `source_text` además de `text`. Es lo que mantiene verificable el criterio "el snippet existe en el documento" para los documentos en inglés. Cuesta peso en el seed; la trazabilidad vale más.
- **Sí:** la columna `embedding vector(768)` se crea ahora, vacía. Cuesta nada hoy y convierte SPEC 09 en un `UPDATE` más un término en el score, en vez de una migración con datos en producción.
- **Sí:** el score vive en una función aislada desde el primer commit, por la misma razón.
- **Sí:** Top-K = 4. Suficiente contexto sin inflar el prompt — cada token de entrada se reporta en las métricas de la rúbrica.
- **Sí:** filtro `active = true` obligatorio en el retrieval. Es lo que hace que el borrado de SPEC 08 sea instantáneo y real, sin reindexar.
- **Sí:** `references.body` = primeros 500 caracteres. Deja un preview útil para la consola del médico sin duplicar el corpus.
- **Sí:** `kb-corpus.json.gz` leído por `seed.ts`. Reutiliza la idempotencia transaccional que el seed ya tiene y no obliga a meter `psql` en la imagen de `api`.
- **Sí:** `unpdf` para extraer texto. Wrapper moderno de pdf.js, sin dependencias nativas, y solo se usa en scripts `tsx` — nunca entra al runtime del servidor.
- **Sí:** chunking por párrafos con techo de caracteres y solape pequeño, sin tokenizador. FTS no necesita precisión de tokens.

**Descartadas:**

- **No:** glosario clínico bilinge para expandir la consulta. Era la alternativa barata a traducir, pero con todo el corpus en español deja de aportar y solo añade superficie de fallo.
- **No:** traducir la consulta del paciente en runtime. Suma latencia y tokens a **cada** turno, y esos tokens sí entran en las métricas de la rúbrica.
- **No:** traducir el documento entero antes de fragmentar. Mejor coherencia, pero documentos de 40k caracteres exceden la ventana de salida cómoda y el proceso deja de ser reanudable por partes.
- **No:** columna `lang` con `tsvector` por idioma y consulta a dos configuraciones. Resuelve el indexado pero no el problema real: una consulta en español sigue sin matchear vocabulario inglés.
- **No:** configuración FTS `simple` para todo. Evita la decisión al precio de perder stemming en español (`colecistectomía` dejaría de matchear `colecistectomías`).
- **No:** un `.sql` cargado por `docker-entrypoint.sh`. Exigiría cliente `psql` en la imagen de `api`, que hoy no lo tiene, y no reutilizaría la idempotencia del seed.
- **No:** correr `kb:ingest` dentro del entrypoint. Necesitaría `dataset-reto/` dentro de la imagen: está en `.gitignore` y pesa 127 MB, lo que ataca directamente los 15 minutos de G2.
- **No:** commitear los PDFs. Conservan sus propios derechos (README del kit) y este repositorio es público bajo MIT.
- **No:** que el caché `.md` sustituya al `kb-corpus.json.gz`. Un solo artefacto sería más limpio, pero parsear markdown dentro de `seed.ts` es más frágil que leer JSON, y comprime peor. Roles distintos: el caché protege la inversión en el LLM, el `.gz` arranca el contenedor.
- **No:** un archivo por chunk direccionado por hash (~1.440 ficheros). Máxima granularidad, pero ilegible para revisión humana y ensucia el árbol del repositorio. El hash va dentro del `.md` del documento, que da la misma granularidad.
- **No:** caché gitignorado. Protegería contra `docker compose down -v` pero no contra perder la máquina, que es justo el escenario que motivó el caché.
- **No:** índice vectorial hoy. Sin datos en la columna no sirve de nada.

---

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| La extracción de PDF se come el presupuesto de tiempo | `unpdf` es una llamada de una línea. Si da guerra, ingerir primero los documentos que extraigan limpio: 10 documentos buenos demuestran el RAG igual que 30, y el resto entra después sin cambiar nada del diseño. |
| Coste y wall clock de `kb:translate` | ~$1.00 con `llama-3.3-70b-versatile` (720 páginas medidas). Corre desatendido y en background mientras avanza el resto del plan. Es reanudable, así que un corte no cuesta nada. El sistema funciona con la traducción a medias: solo baja el recall sobre la parte aún no procesada. |
| Límites de tasa de Groq | **Descartado como bloqueante.** Verificado contra la cuenta real (cabeceras `x-ratelimit-*` de `api.groq.com`): la key es on-demand, con **300.000 tokens/minuto y sin límite diario de tokens**. Los ~1.4M tokens del proceso son 4.7 minutos de cuota. Con concurrencia 4 (~127k TPM, 42% del tope) el proceso tarda ~11-15 min sin acercarse al límite, y deja margen para que el chat del paciente responda en paralelo. Aun así el script respeta el `429` con backoff, porque la reanudabilidad ya está y no cuesta nada. |
| El modelo de traducción cambia si alguien cambia `LLM_MODEL` | Es deliberado: `kb:translate` hereda el modelo configurado, igual que el resto del sistema. El script loguea el `model` usado, que es lo que R0.1 exige demostrar. |
| El `kb-corpus.json.gz` queda pesado para un repositorio público (~8-12 MB con `source_text`) | Gzip ya reduce ~4x. El clone crece una vez; la ingesta no corre en el arranque, así que G2 sigue cubierto. Si estorba, se reduce el número de documentos volcados sin tocar código. |
| El contexto inyectado infla los tokens de entrada de cada turno | Top-K 4 y techo de caracteres por chunk. Las métricas de `LlmMetricsService` lo van a exponer, así que conviene medirlo desde el primer día. |
| `ts_rank` devuelve resultados pobres ante preguntas coloquiales del paciente | El enriquecimiento de la consulta (paso 7) es gratis y aporta los términos clínicos que el paciente no usa. Lo que quede sin resolver es la razón concreta para la rama densa de SPEC 09. |
| `CREATE EXTENSION vector` no corre en un volumen de Postgres preexistente | La migración lo incluye de forma defensiva con `IF NOT EXISTS`, además del `docker/db/init.sql` que solo cubre volúmenes nuevos. |

---

## Lo que **no** está en este spec

- La rama vectorial del score y el índice HNSW/IVFFlat.
- Subir y eliminar documentos desde la consola del médico.
- Mostrar los chips de cita en la UI del médico o del paciente.
- El turno `who:'system'` de actualización de conocimiento y el chip `KB vN` dinámico.
- Reranking, reformulación de consulta y traducción en runtime.

Cada uno, si aterriza, va en su propio spec.
