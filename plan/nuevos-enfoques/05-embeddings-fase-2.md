# Plan 05 — Embeddings: la mitad densa de la búsqueda híbrida

> **Cuándo:** domingo 9, **solo si los planes 02 y 03 ya cerraron** · **Presupuesto:** 1.5 horas
> **Cierra:** sube la calidad de los 20 pts de RAG · da la mejor respuesta a la Pregunta 2 del video
> **Depende de:** plan 01 (que ya dejó la columna, el score aislado y la tabla)

> ⚠️ **Este plan es opcional por diseño.** Si G5 (plan 02) o el triage (plan 03) no están en pie, **no se abre**. Un RAG léxico que funciona puntúa; uno híbrido a medias, no.

## Objetivo en una frase

Añadir el término vectorial al score de retrieval usando la API de embeddings de Gemini, para que el agente encuentre el fragmento correcto aunque el paciente describa su síntoma en lenguaje coloquial.

> **Diagrama:** https://claude.ai/code/artifact/7c5fe42c-9886-480d-9fd6-33dc4745b763

## Por qué es aditivo y no un rediseño

El plan 01 dejó el terreno preparado a propósito:

- La columna `embedding vector(768)` **ya existe**, vacía.
- El cálculo del score **ya está en una función aislada**.
- El chunking, la tabla, las citas y la inyección al prompt **no se tocan**.

Lo único que cambia es: llenar la columna, añadir un término al score, y crear el índice.

```sql
-- fase 1 (ya funciona)
score = ts_rank(c.tsv, q)

-- fase 2 (este plan)
score = α * (1 - (c.embedding <=> $vec)) + (1-α) * ts_rank(c.tsv, q)
```

Es la fórmula del `HybridRetriever` de `invoice-system` (`alpha * vec_norm + (1 - alpha) * bm25_norm`), resuelta dentro de Postgres.

## Decisiones ya cerradas

- **Proveedor: Gemini `gemini-embedding-001`, 768 dimensiones.** Free tier de **1.500 requests/día sin tarjeta, que se renueva a diario** — no es una bolsa mensual que se agote. Primero en retrieval cross-lingual, que es exactamente el problema (consulta coloquial → documento formal). Soporta truncar dimensiones (Matryoshka), así que 768 encaja tal cual.
- **Descartados:** Cohere (1.000 llamadas/**mes**, se agota solo con la ingesta), Jina (1M tokens/mes, se agota si se reingiere varias veces), OpenAI `text-embedding-3-large` (flojo en lenguas europeas), y todos los modelos locales (~500 MB–2.2 GB atacan G2).
- **Consumo estimado:** ~600 chunks de ingesta (~300K tokens, una vez) y 1 request por turno. Holgado dentro del free tier.
- **α = 0.5 para arrancar.** Se ajusta probando, no teorizando.
- **La key vive solo en el backend**, como la de Deepgram. Nunca sale al navegador.
- **Índice:** HNSW sobre la columna vectorial, creado **después** de llenar los datos.

## Plan de implementación

1. **Cuenta y key.** Google AI Studio, sin tarjeta. Añadir `GEMINI_API_KEY` a `.env.example` con su comentario.
2. **Cliente de embeddings.** `modules/knowledge/embeddings.service.ts`: `embed(texts: string[]): Promise<number[][]>` con lotes y reintento simple. Es el equivalente de tu `get_embeddings_batch`.
3. **Llenar la columna.** Extender `pnpm kb:ingest` para que, tras escribir los chunks, pida los vectores por lotes y haga `UPDATE`. Idempotente: solo procesa los que tienen `embedding IS NULL`.
4. **Índice HNSW** en una migración, ya con datos dentro.
5. **Sumar el término al score** en la función aislada del plan 01, normalizando ambas señales antes de combinar.
6. **La ingesta en caliente del plan 02 también embebe.** Un documento subido por la consola tiene que quedar buscable por las dos vías, o G5 se comporta distinto según qué rama lo encuentre.
7. **Degradación explícita.** Si la API de embeddings falla o no hay key, el retrieval **cae a solo-léxico y sigue funcionando**. Nunca romper una conversación por un fallo de embeddings.
8. **Tests.** Extender `retrieval.service.spec.ts` con el caso híbrido y con el de degradación a léxico.

## Criterios de aceptación

- [ ] `pnpm kb:ingest` llena `embedding` en todos los chunks, en lotes, sin agotar la cuota.
- [ ] Una consulta coloquial (`me arde ahí abajito donde me cortaron`) recupera el fragmento clínico correcto, que la rama léxica sola **no** encontraba.
- [ ] El resultado de esa comparación queda anotado — es la evidencia para el informe y el video.
- [ ] Un documento subido desde la consola queda buscable por ambas ramas.
- [ ] **Sin `GEMINI_API_KEY`, el sistema arranca y responde igual, con solo-léxico.**
- [ ] La latencia añadida por turno queda medida (entra en las métricas del plan 04).
- [ ] `pnpm lint`, `pnpm typecheck` y `pnpm test` en verde.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| La cuenta de Gemini pide verificación y se pierde el bloque | **Por eso este plan va después de G5 y del triage.** Si falla, no se pierde nada crítico. |
| Rate limit al ingerir 600 chunks de golpe | Lotes con pausa. La ingesta es offline: puede tardar. |
| El round-trip añade latencia visible al turno | Se mide. Si pesa, la rama densa se usa solo cuando la léxica trae poco. En producción desplegada (decisión 3 del plan general) el salto es entre datacenters, no desde el portátil. |
| Se dispara `TS2589` o un choque de tipos con el cliente de Gemini | Mismo patrón que `openai.driver.ts`: aislar la frontera en una función con `any` puntual, no escalar al resto. |
