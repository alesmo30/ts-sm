# Plan 04 — Métricas, README y los cuatro entregables

> **Cuándo:** lunes 10 · **Presupuesto:** 5 horas
> **Cierra:** **G1** y **G2** (dos compuertas eliminatorias) · 15 pts de *Repositorio y proceso* · 15 pts de *Video*
> **Depende de:** planes 01, 02 y 03

## Objetivo en una frase

Convertir lo construido en una entrega evaluable: métricas medidas de verdad, un README que levante la solución en menos de 15 minutos cronometrados, y los cuatro entregables que el kit exige.

## Por qué este plan vale tanto como el código

30 de los 100 puntos están aquí (video 15 + repositorio y proceso 15), y son **los más baratos del puntaje**. Además contiene dos compuertas eliminatorias. Un sistema perfecto sin video no se puntúa.

## Reparto de las 5 horas

| Bloque | Horas | Qué |
|---|---:|---|
| A | 1.5 | Métricas de la rúbrica |
| B | 1.0 | README de evaluación + levantamiento cronometrado real |
| **corte** | | **Código congelado. Nada más se toca.** |
| C | 0.5 | Diagrama |
| D | 1.0 | Informe final |
| E | 1.0 | Video |

## Bloque A — Métricas (1.5 h)

La rúbrica §5 las declara obligatorias: *"si no están, el apartado correspondiente se califica muy por debajo de su tope, aunque tu solución funcione bien"*. Y advierte: *"reportar números que no se sostienen es peor que no reportarlos"* — se contrastan contra los logs de la sesión en vivo.

| Métrica exigida | Estado hoy | Qué falta |
|---|---|---|
| Latencia P50 y P95, **desde que el paciente termina de hablar hasta que empieza a sonar el audio** | 🔴 | Es la métrica de la rúbrica y **no es el TTFT del LLM**. Hay que instrumentar el tramo completo: fin de STT → primer chunk de TTS emitido. `voice.metrics.ts` ya existe como punto de partida. |
| Tokens de entrada y salida por turno | 🟢 | Ya en `metrics.ts` |
| Tokens por llamada (sesión completa) | 🔴 | Agregar por `sessionId` |
| Invocaciones al modelo por turno | 🟡 | Derivable; hay que exponerlo |
| **Consultas al RAG por llamada** | 🔴 | Contador en el servicio de retrieval del plan 01 |
| Costo estimado por llamada | 🟡 | `pricing.ts` ya calcula por llamada individual; falta agregar por sesión |

**Entregable del bloque:** un endpoint de métricas agregadas que devuelva P50/P95 y los totales por sesión, y que los números que se escriban en el README salgan de correr conversaciones reales — no de estimar.

> Las tarifas de `llama-3.3-70b-versatile` en `pricing.ts` se pusieron con la cifra pública conocida y **no se pudieron confirmar contra la consola de Groq**. Verificarlas antes de reportar costo en el README.

## Bloque B — README de evaluación (1 h)

G2 se cronometra siguiendo el README **al pie de la letra**, credenciales incluidas.

Contenido obligatorio:

1. **Levantamiento en ≤15 min**: `cp .env.example .env` → llenar keys → `docker compose up` → URLs. Probado de verdad, no supuesto.
2. **Declaración del modelo** (G3): `llama-3.3-70b-versatile`, familia Meta Llama vía Groq, y **por qué** se eligió.
3. **Las métricas del bloque A.**
4. Arquitectura resumida y decisiones principales.

**Las credenciales dejan de ser un problema si el deploy del plan 06 salió.** Desplegado, las keys viven en el servidor y el README abre con la URL en vivo: G2 pasa en 0 minutos y ninguna key sale al repositorio.

El README documenta **las dos vías**, en este orden:

- **Opción A — URL en vivo.** Cero instalación. Es lo que el jurado va a usar.
- **Opción B — `docker compose up`.** Para reproducibilidad, que es lo que exige el criterio de repositorio. Aquí sí hacen falta keys: se documenta cómo obtenerlas en los niveles gratuitos de Groq, Deepgram y Gemini.

**Si el deploy no salió**, se cae al plan anterior: documentar nuestras keys con límite de gasto y verificar que sobrevivan del 10 al 18 de agosto.

En cualquier caso, verificar que el **fallback de voz a Web Speech API funcione sin ninguna key** — es el seguro de G4, la compuerta más cara de perder.

**Cronometrar la opción B de verdad**, con `docker compose down -v` antes. Aunque G2 se gane por la URL, el número honesto va en el README.

## Bloque C — Diagrama (0.5 h)

Arquitectura + flujo de decisión del agente.

> **Advertencia de la rúbrica:** *"El jurado toma elementos del diagrama al azar y los busca en el código."*

**Diagramar lo que existe, no lo que se quiso construir.** Si el retrieval es FTS de Postgres, el diagrama dice FTS de Postgres — no "vector store". Un diagrama honesto puntúa; uno aspiracional levanta bandera de integridad.

## Bloque D — Informe final (1 h)

Exige evidencia de proceso, prompts, configuraciones, capturas, y la declaración del modelo con su justificación.

**Casi todo ya está escrito.** `specs/` tiene seis specs con sus secciones de "Decisiones tomadas y descartadas", y `plan/01-jueves/D1-jue-06-ago.md` acumula las fricciones reales de cada spec. Eso es exactamente lo que pide el criterio *"qué rastro dejó tu proceso de trabajo, cómo trabajaste con IA"*. El informe es en buena medida un índice comentado de material existente.

Incluir de forma explícita:

- El modelo y por qué (y la ambigüedad entre la ficha web y `stack-tecnico.md` sobre G3, resuelta por asimetría de riesgo).
- Por qué FTS y no embeddings, con la ruta de migración.
- Qué quedó fuera y por qué — la honestidad puntúa más que fingir cobertura.
- El bug de `finish_reason: stop` con contenido vacío en el resumen: es una anécdota técnica real, verificada contra la API cruda, que demuestra método.

## Bloque E — Video (1 h)

Demo de pantalla + las dos preguntas de cierre frente a cámara.

**Guion escrito antes de grabar.** La demo es el guion de aceptación del plan 02 (preguntar → subir → cambia → borrar → vuelve), más una conversación de voz y un caso que escala.

- **Pregunta 1** (problema, solución, valor diferencial): el seguimiento postoperatorio no escala; el agente conversa, se fundamenta en el corpus y decide cuándo alertar.
- **Pregunta 2** (decisión técnica más relevante): **`LlmPort`**. Es la mejor respuesta posible — se construyó para un escenario que no se cumplió (modelo obligatorio anunciado el día 2), y cuando el kit reveló que el modelo estaba restringido a cuatro familias, cambiar salió en 15 minutos sin tocar una línea fuera de `modules/llm`. Alternativas evaluadas, riesgos, y qué se haría con dos semanas más.

  **La segunda mejor opción es la búsqueda híbrida**, si el plan 05 entró: alternativas reales evaluadas (ChromaDB, modelos locales, cuatro proveedores de embeddings), descartadas con criterios concretos (G2, free tiers, calidad en español), y construida en dos fases para que la parte arriesgada nunca pudiera hundir la parte que funciona. Elegir una de las dos, no contar ambas.

## Criterios de aceptación

- [ ] El README reporta latencia P50/P95 fin-de-habla → primer audio, medidas de conversaciones reales.
- [ ] Reporta tokens por turno y por llamada, invocaciones al modelo, consultas al RAG por llamada y costo por llamada.
- [ ] Los números del README **coinciden con `/llm/metrics`** en una sesión nueva.
- [ ] El levantamiento se cronometró desde `docker compose down -v` y tomó menos de 15 minutos.
- [ ] El README declara el modelo exacto y por qué se eligió.
- [ ] El diagrama existe y cada elemento suyo se encuentra en el código.
- [ ] El informe está completo, con la declaración del modelo y lo que quedó fuera.
- [ ] El video muestra la demo funcional y responde las dos preguntas frente a cámara.
- [ ] `.env` no está commiteado; `.env.example` sí, sin keys reales.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Se codea hasta el final y no hay video | **La regla de corte es a la hora 3.** Está en el plan general. 30 puntos dependen de respetarla. |
| Las métricas reportadas no coinciden con la sesión en vivo | Medir de verdad, nunca estimar. Es penalización explícita. |
| Las keys expiran durante la ventana de evaluación (10–18 ago) | Límite de gasto al crearlas, verificar crédito antes de entregar, y dejar documentada la vía alterna con keys propias del jurado. |
| El diagrama promete lo que el código no tiene | Diagramar al final, sobre lo construido — no antes. |
| Grabar el video toma tres tomas | Guion escrito antes. Una toma imperfecta entregada vale más que una perfecta sin grabar. |
