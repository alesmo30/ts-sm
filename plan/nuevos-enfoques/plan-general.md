# Plan general — 11 horas hasta la entrega

> **Escrito:** 2026-08-08, tras leer el kit oficial y validar el cambio de modelo.
> **Reemplaza** a `plan/PLAN-RENOVADO-KIT.md` en el cronograma (su análisis del kit sigue vigente; su plan de horas asumía casi el doble de tiempo disponible).

## El presupuesto real

| Día | Horas | Bloque |
|---|---:|---|
| Sábado 8 (hoy) | **2 h** | RAG léxico con citas |
| Domingo 9 | **4 h** *(ampliable)* | Conocimiento vivo (2 h) + triage y escalamiento (2 h) |
| Domingo 9, extra | *si hay energía* | Embeddings fase 2 (1.5 h) · **deploy en la nube (2–2.5 h)** |
| Lunes 10 | **5 h** | Métricas y README (1.5 h) + diagrama (0.5 h) + informe (1.5 h) + video (1.5 h) |
| | **11 h base** | |

Once horas base para cerrar tres compuertas y cuatro entregables. **Todo lo que no cierre una compuerta o no sume puntos directos queda fuera del núcleo.** Este plan es un ejercicio de recorte, no de ambición.

Las horas del domingo son ampliables si hay energía. **Orden de recuperación, en este orden estricto:** deploy → embeddings (fase 2) → evaluador de los 160 casos. Pero trasnochar antes de una entrega tiene un costo real: los 3 finalistas sustentan **en vivo el 5 de septiembre**, con el panel dictando qué probar en el momento. Entender bien lo entregado vale más que haber construido más.

## La restricción que manda

De las cinco compuertas eliminatorias, hoy:

| Compuerta | Estado | Dónde se cierra |
|---|---|---|
| G1 — 4 entregables | 🔴 falta diagrama, informe, video | Lunes |
| G2 — levantable en ≤15 min | 🟡 funciona, falta README real | Lunes |
| G3 — modelo permitido | ✅ **cerrada hoy** (`llama-3.3-70b-versatile`) | — |
| G4 — voz en tiempo real | 🟡 verificada en navegador (TTS suena, chat fluye) | — |
| G5 — conocimiento vivo | 🔴 no existe | Domingo (plan 02) |

**G5 es la única compuerta que todavía puede hundir la entrega**, y depende del RAG. Por eso el RAG es lo primero, hoy.

De los 100 puntos, 40 están en RAG (20) y decisión/escalamiento (20) — exactamente lo que no existe. Los 15 de repositorio y proceso están prácticamente cobrados por el trabajo de las seis specs anteriores.

## Los planes específicos

**Núcleo — no negociable:**

| Plan | Cuándo | Horas | Cierra |
|---|---|---:|---|
| [`01-rag-y-citas.md`](01-rag-y-citas.md) | Hoy | 2 h | 20 pts de RAG · habilita G5 |
| [`02-conocimiento-vivo.md`](02-conocimiento-vivo.md) | Domingo | 2 h | **G5** · consola exigida por el kit |
| [`03-triage-y-escalamiento.md`](03-triage-y-escalamiento.md) | Domingo | 2 h | 20 pts de decisión |
| [`04-metricas-y-entregables.md`](04-metricas-y-entregables.md) | Lunes | 5 h | **G1 · G2** · 30 pts de video y repo |

**Opcionales — solo si el núcleo cerró, en este orden:**

| Plan | Cuándo | Horas | Aporta |
|---|---|---:|---|
| [`06-deploy.md`](06-deploy.md) | Domingo noche | 2–2.5 h | **G2** en 0 min · las keys nunca salen al README |
| [`05-embeddings-fase-2.md`](05-embeddings-fase-2.md) | Domingo | 1.5 h | Calidad del retrieval con lenguaje coloquial |

> **El deploy va antes que los embeddings**, aunque tenga número mayor: cierra una compuerta eliminatoria y resuelve el riesgo de credenciales; los embeddings solo mejoran puntos que ya se están ganando.

Cada plan está escrito para correrse con `/spec` directamente: trae objetivo en una frase, decisiones ya cerradas (para que la Fase 2 sea corta), y criterios de aceptación booleanos.

## Las tres decisiones técnicas que definen el plan

### 1. Búsqueda híbrida sobre Postgres, construida en dos fases

**Fase 1 (hoy): léxica con `to_tsvector('spanish')`.** Verificado funcionando en nuestra instancia — `pg_ts_config` trae `spanish` de fábrica y `plainto_tsquery('spanish', 'dolor fiebre')` hace match correcto sobre texto clínico.

**Fase 2 (domingo, si el bloque de G5 y triage va bien): columna vectorial encima**, con embeddings por API. El score final combina ambas señales en una sola consulta SQL:

```sql
score = α · (1 - (embedding <=> $vec)) + (1-α) · ts_rank(tsv, q)
```

Es la misma fórmula del `HybridRetriever` de `invoice-system` (`alpha * vec_norm + (1 - alpha) * bm25_norm`), resuelta dentro de Postgres en vez de combinando dos sistemas en memoria.

**Por qué en dos fases y no directo a vectores:** si empezamos por embeddings y la API falla, la cuota se agota o la cuenta pide verificación, nos quedamos sin RAG. Con la rama léxica ya en pie, los vectores son una migración **aditiva** — una columna y un término más en el score, sin rehacer chunking, tabla, citas ni inyección al prompt.

**Proveedor de embeddings: Gemini `gemini-embedding-001`, 768 dimensiones.**

| Proveedor | Free tier | Español |
|---|---|---|
| **Gemini** ✅ | **1.500 req/día, sin tarjeta, se renueva a diario** | 1º en retrieval cross-lingual |
| Cohere `embed-v4` | 1.000 llamadas/**mes** — se agota solo con la ingesta | Puntero |
| Jina v4 | 1M tokens/mes | Bueno |
| OpenAI `text-embedding-3-large` | no hay | Flojo en lenguas europeas — descartado |

Nuestro consumo: ~600 chunks de ingesta (~300K tokens, una vez) y 1 request por turno. Cabe con holgura en el free tier de Gemini, que además soporta truncar dimensiones (Matryoshka) y encaja tal cual en `vector(768)`.

**Descartados:** modelos locales (`paraphrase-multilingual-MiniLM-L12-v2` ~500 MB, `BGE-M3` ~2.2 GB) porque hornearlos en la imagen ataca los 15 minutos de G2, que es compuerta eliminatoria. **ChromaDB** porque no resuelve el problema — es una base vectorial, no genera embeddings; su modelo por defecto (`all-MiniLM-L6-v2`) es esencialmente inglés, y el multilingüe devuelve los ~470 MB. Además sería un cuarto contenedor duplicando lo que `pgvector` ya hace, y no puede combinar léxico y vectorial en una sola query.

### 1-bis. El enriquecimiento de la consulta entra en la fase 1

Las guías clínicas **no tienen regionalismos** — están en español médico formal. Los regionalismos están en lo que dice el paciente. El problema real no es qué modelo entiende paisa, sino cerrar la brecha entre registro coloquial y registro clínico.

Lo que más mueve la aguja **no es el modelo, es la consulta**. El agente acaba de preguntar *"¿Cómo está la herida quirúrgica? ¿Tiene enrojecimiento, secreción o hinchazón?"* — esa pregunta ya trae los términos clínicos.

```
❌ query = "me arde ahí abajito"
✅ query = "herida quirúrgica enrojecimiento secreción hinchazón · me arde ahí abajito"
```

**Costo: cero** — ambos textos ya están en memoria. Beneficia igual a la rama léxica y a la vectorial, así que entra **hoy**, en la fase 1.

Reformular la consulta con el LLM funcionaría aún mejor, pero mete una segunda invocación por turno y la rúbrica exige reportar *"invocaciones al modelo por turno"* y la latencia P50/P95. Queda como mejora opcional, no como base.

### 2. El corpus se ingiere parcial y no se commitea

Los 107 PDFs pesan **127 MB** y sus derechos son de terceros (el README del kit lo dice explícito: *"conservan sus propios derechos"*). Nuestro repositorio es público MIT.

- **No entran al árbol versionado.** Se ingieren desde una carpeta local vía script.
- **Se ingiere un subconjunto** (~25–30 documentos, priorizando español y cubriendo los cinco procedimientos). El resto queda ingestable con el mismo comando, documentado.
- **El resultado sí se commitea**: el texto extraído y sus chunks como seed SQL. Así el arranque del jurado es una carga de datos, no un pipeline — G2 protegida.

### 3. Despliegue en la nube el domingo por la noche

**Decidido: sí.** G2 admite explícitamente una solución ya desplegada — *"siguiendo únicamente tu README —credenciales, URLs y accesos incluidos— la solución queda corriendo y accesible en 15 minutos o menos"*. Una URL en vivo son 0 minutos.

El beneficio grande no es el tiempo, es **que las keys nunca salen al README**. Viven en las variables de entorno del servidor. Desaparece el riesgo de que la key de Deepgram se agote entre el 10 y el 18 de agosto y el jurado no pueda probar la voz.

Reparto, porque **Vercel solo no alcanza**:

| Pieza | Dónde | Por qué |
|---|---|---|
| `apps/web` (Vite estático) | **Vercel** | Trivial, ~20 min |
| `apps/api` (NestJS + WebSocket) | **Railway / Render / Fly.io** | Vercel sacó WebSocket en beta (jun 2026) pero las conexiones quedan clavadas a una instancia, sin broadcast, y NestJS es un proceso persistente, no serverless. Ya tenemos Dockerfile. |
| Postgres + pgvector | Railway o Neon | Junto al API |

**El README ofrece las dos vías:** *"Opción A: URL en vivo (0 min). Opción B: `docker compose up`"*. Así G2 pasa por la rápida y el repositorio sigue siendo reproducible, que es lo que exige el criterio de repositorio y proceso.

**Cuándo:** domingo por la noche, con el código ya completo. No el lunes — el lunes es de entregables y los deploys siempre fallan la primera vez.

**Riesgo aceptado:** si el deploy se cae durante la ventana de evaluación, caen G2 y G4 a la vez. Por eso la opción B se mantiene viva y probada.

### 4. Todo el modelo de datos ya existe

Auditado hoy. SPEC 02 modeló de antemano casi todo lo que estos cuatro planes necesitan:

| Ya existe | Dónde | Lo usa |
|---|---|---|
| `references.body` (texto completo) | `database/schema/references.ts` | Plan 01 |
| `Citation` con `docId`/`chunkId`/`score`/`snippet` | `contracts/session.contract.ts` | Plan 01 |
| `transcripts.citations` (jsonb) | `database/schema/sessions.ts` | Plan 01 |
| `kb_state` singleton con `CHECK(id=1)` | `database/schema/kb-state.ts` | Plan 02 |
| `ingest_jobs` con las 5 etapas | `database/schema/ingest-jobs.ts` | Plan 02 |
| `who: 'system'` en transcripts | `contracts/session.contract.ts` | Plan 02 |
| `SessionSummarySchema` con `escalated`, `alerts`, `recommendations`, `metrics` | `contracts/summary.contract.ts` | Planes 03 y 04 |
| `sessions.status` (`ok`/`attn`/`fail`) | `database/schema/sessions.ts` | Plan 03 |
| `metrics.ts` con tokens, latencia, TTFT, costo | `modules/llm/metrics.ts` | Plan 04 |

**Lo único que falta crear en el modelo de datos es la tabla de chunks.** Todo lo demás es cablear cosas que ya están.

## Qué queda explícitamente fuera

Recortes conscientes, para que nadie los busque después:

- **Embeddings en el núcleo.** Entran como fase 2 el domingo, solo si el bloque de G5 y triage cerró. Ver decisión 1.
- **El evaluador de los 160 casos etiquetados con `label_ground_truth`.** Era la mejor relación puntos/hora del plan anterior, pero compite con entregables obligatorios y pierde. **Tercero en la cola de recuperación** — daría una matriz de confusión real para el informe.
- **Reformulación de la consulta con el LLM.** Mejoraría el retrieval, pero duplica las invocaciones al modelo por turno, que es una métrica que la rúbrica exige reportar. El enriquecimiento gratuito (pregunta del agente + respuesta del paciente) cubre buena parte del beneficio.
- **ChromaDB.** Evaluado y descartado; ver decisión 1.
- **Reemplazar la semilla actual por los 40 pacientes del dataset.** Cosmético; no cierra compuerta ni suma puntos.
- **Ingesta de los 107 PDFs completos.** Ver decisión 2.
- **Cualquier trabajo de UI que no sea la consola de conocimiento.** La rúbrica dice literal que *"la estética no puntúa"*.
- **`DELETE /sessions`** y la limpieza de las sesiones de prueba en la base de desarrollo.

## Regla de corte

**Lunes, hora 3 de 5: se congela el código.** Las últimas 2 horas son informe y video, sin excepción. Un bug documentado con honestidad cuesta menos puntos que un video sin grabar — 30 de los 100 puntos están en video y repositorio, y son los más baratos de conseguir.

Si el domingo a las 3.5 h el plan 03 no está en pie, se entrega sin triage estructurado y se documenta como limitación conocida. G5 y los entregables mandan sobre los puntos.
