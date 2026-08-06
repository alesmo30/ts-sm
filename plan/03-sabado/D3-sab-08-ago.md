# D3 — Sábado 8 de agosto · día completo

> **Objetivo del día:** el núcleo que da los puntos. RAG clínico con trazabilidad, conocimiento vivo real y triage de dos capas.

**Este día vale 35 de los 100 puntos** (20 de RAG + 15 de lógica de decisión) y contiene la demo que decide la compuerta #5.

---

## Bloque mañana (4h) — RAG clínico serio

### M1 · Retrieval híbrido (1h 30min)

Portar el pipeline de `invoice-system/rag/retrieval.py` a TypeScript, **con tres correcciones**:

| Corrección | Por qué |
|---|---|
| Reranker → `BAAI/bge-reranker-v2-m3` | El original (`ms-marco-MiniLM`) es **solo inglés**: sobre corpus español desordena en vez de ordenar. Bug silencioso de calidad |
| Embeddings → `intfloat/multilingual-e5-large` | `paraphrase-multilingual-MiniLM` (384 dims) se queda corto en terminología clínica. Ojo: e5 requiere prefijos `query:` / `passage:` |
| `HybridRetriever` se instancia **una vez** | En el original se construye dentro de cada consulta, reconstruyendo el índice BM25 completo cada vez. Con 150ms de presupuesto de retrieval en tiempo real, eso es letal |

Componentes que se conservan tal cual (ya probados):
- BM25 con tokenización simple
- Combinación híbrida con **normalización de scores por el máximo** y peso `alpha`
- Reciprocal Rank Fusion con `k=60`
- Multi-query expansion (usando **el modelo obligatorio**, nunca otro)
- Compresión de contexto por reranker, sin gastar LLM

Ambos modelos ML se ejecutan con **`transformers.js`** (ONNX) y se **descargan en el `docker build`** (RA.3).

### M2 · Chunking clínico (45 min)

Principio heredado de `CHUNKING_STRATEGY_FINAL.md` de `invoice-system`: **1 chunk = 1 entidad semántica completa**. Partir un protocolo de manejo de fiebre por la mitad es el mismo error que partir el reporte de un empleado.

- 1 chunk = 1 protocolo o 1 procedimiento completo, con overlap solo cuando sea inevitable.
- Chunking **robusto y agnóstico de formato** — los documentos que sube el médico son impredecibles, nada de regex frágil atado a un formato exacto.
- Metadata por chunk: `docId`, `docName`, `chunkId`, `version`, `active`, `procedure`, `sourceType`, `ingestedAt`.
- **Documentar los intentos fallidos mientras se decide**, no después. Es material directo para la Pregunta 2 del video y para el informe.

### M3 · Trazabilidad de citas (1h)

- Cada respuesta clínica retorna `{answer, citations[], kbVersion}`.
- `Citation`: `docId`, `docName`, `chunkId`, `version`, `score`, `snippet`.
- En el chat, chips clicables debajo de la burbuja del asistente → panel lateral con el fragmento exacto resaltado.
- Persistencia completa en la transcripción: el médico ve después qué documento sustentó cada respuesta.
- **Anti-alucinación (RC.2):** instrucción dura de que sin contexto recuperado no hay afirmación clínica; si no está en las fuentes, se dice y se escala.

### M4 · Conocimiento vivo real (45 min)

| Operación | Comportamiento exigido |
|---|---|
| **Upload** | parse → chunk → embed → insert con `active=true`. Disponible en la siguiente consulta, **sin reiniciar el proceso** |
| **Delete** | **Soft delete** (`active=false`) + filtro en retrieval + invalidación de caché de respuestas + **refresco del índice BM25** + notificación por WebSocket a sesiones activas |
| **Update** | Nueva versión, la anterior a inactiva. Historial intacto para auditoría |

> ⚠️ El punto que más gente falla: "olvidar" no es borrar el vector. Hay que invalidar la caché y **refrescar BM25**, que es un índice en memoria construido sobre todos los chunks.

Job encolado que **nunca bloquea una sesión de voz activa**. Progreso por WebSocket con las 5 etapas de `DESIGN.md`.

---

## Bloque tarde (4h) — Decisión clínica y coherencia

### T1 · `kb_version` sellada por turno (45 min) 🔴 el detalle fino

Problema: si un documento termina de indexarse mientras el LLM genera, ¿qué versión se usó?

Solución:
- `kb_version` monotónico, incrementado por cada ingesta o borrado.
- **Cada turno captura `kb_version` al arrancar** y la lleva en su trazabilidad junto a los `docId`.
- Los cambios aplican **desde el turno siguiente**. El chip lo comunica: *"se aplicará en tu próxima pregunta"*.
- Separador de sistema insertado en la transcripción al completarse la ingesta, con timestamp.
- Chip `KB v3` en el header del chat, con pulso al incrementar.

Esto es honesto, es correcto y es respuesta lista para la Pregunta 2 del video.

### T2 · Triage de dos capas (1h 30min) 🔴 15 puntos

**El LLM no decide solo la escalación clínica.** Un jurado de healthcare va a mirar exactamente esto.

```
Capa 1 — REGLAS DETERMINÍSTICAS (banderas rojas, umbrales del dataset real)
  fiebre ≥ umbral               → ESCALAR
  sangrado activo abundante     → ESCALAR AHORA
  dolor ≥ 8/10 o creciente      → ESCALAR
  disnea / dolor torácico       → ESCALAR AHORA
  dehiscencia / secreción purulenta → ESCALAR AHORA
  vómito persistente >24h       → ESCALAR
  ausencia de diuresis          → ESCALAR
  confusión / ideación suicida  → ESCALAR AHORA
  paciente pide humano (RC.4)   → ESCALAR AHORA

Capa 2 — LLM con salida estructurada (matiz, contexto, combinaciones)
  {severity, symptoms[], rationale, recommendedAction, sources[], confidence}

Decisión final = MAX(capa1, capa2)
  → las reglas solo pueden SUBIR la severidad, nunca bajarla (RC.3)
```

**Patrón heredado de `supervisor.py`:** clasificar → verificar confianza con una segunda pasada → si la confianza es baja, escalar. Con una diferencia clave: el umbral es **asimétrico**. Bajo para escalar (ante la duda, se escala), alto para no escalar.

Cinco niveles de escalamiento: `none` · `low` · `medium` · `high` · `critical`, cada uno con su acción y su registro.

**Fallo técnico = escalamiento (RC.6):** si se cae el RAG en medio de una llamada, el agente no improvisa consejo médico. Dice que no puede verificar y escala.

### T3 · Desambiguación conversacional (45 min)

Cuando el paciente es ambiguo, el agente repregunta **como una enfermera**, no como un formulario:

- *"¿Poquito de sangre es como una manchita en la gasa, o le empapó el apósito?"*
- *"Cuando dice que le duele harto, del 1 al 10 ¿en cuánto lo pone?"*
- *"¿Se tomó la temperatura con termómetro o es que se siente caliente?"*

Reglas: una pregunta por turno, lenguaje llano, sin jerga médica hacia el paciente. **Nunca aceptar un valor ambiguo para decidir una alerta** (RC.7).

Glosario `es-CO` aplicado post-STT, antes del retrieval, con la normalización visible en la UI (`↳ normalizado: …`). Expansión de consulta con sinónimos: si el paciente dice "materia" y el documento dice "secreción purulenta", el retrieval debe encontrarlo.

### T4 · Resumen estructurado por llamada (1h)

Schema Zod completo con: identificación, síntomas reportados, vitales autorreportados, banderas rojas disparadas, escalamiento con motivo y canal, guías dadas con sus citas, adherencia, próximo seguimiento, notas de lenguaje (regionalismos normalizados) y **métricas embebidas** (TTFT, E2E P50/P95, tokens in/out, costo, `kb_version` por turno).

Las métricas salen **automáticas** (RA.9), no en una hoja de cálculo a mano.

---

## Alcance

**Dentro:** retrieval híbrido, chunking, citas, conocimiento vivo real, `kb_version`, triage, desambiguación, resumen estructurado.

**Fuera:**
- VAD, manos libres, barge-in → D4
- Optimización fina de latencia → D4
- Golden dataset y tests → D4
- Botón "repetir última pregunta" → D4
- Cualquier documentación → D5

---

## Criterios de aceptación

### La demo killer (esto es la compuerta #5)

- [ ] Pregunto por voz algo cubierto por un protocolo → responde citando `doc_A`
- [ ] **Sin cerrar la sesión**, subo `protocolo_v2` desde el modal del paciente
- [ ] **Sigo hablando mientras indexa** — el chat no se bloquea
- [ ] Aparece el separador de sistema en el hilo, con timestamp
- [ ] El chip pasa de `KB v1` a `KB v2`
- [ ] Repito la pregunta → responde distinto, citando `doc_B`
- [ ] Borro `doc_B` → vuelve a la respuesta original citando `doc_A`
- [ ] **Nada se reinició en ningún momento**

### El resto

- [ ] Cada respuesta clínica trae citas verificables y clicables
- [ ] Reportar dolor 9/10 dispara escalamiento aunque el LLM lo considere leve
- [ ] Pedir hablar con un humano escala de inmediato
- [ ] Matar el servicio de RAG a mitad de sesión provoca escalamiento, no invención
- [ ] Una descripción ambigua provoca repregunta, no una suposición
- [ ] Al cerrar la sesión, el resumen estructurado trae métricas y `kb_version` por turno
- [ ] El retrieval tarda menos de 150ms P50

---

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Los modelos de embeddings/reranker no corren bien en `transformers.js` | Probar **a primera hora**. Plan B: API de embeddings de Voyage o Cohere (son encoders, no LLMs — permitidos por RA/R0.1) |
| El refresco de BM25 en caliente introduce un pico de latencia | Reconstrucción incremental por `docId`, no del índice completo |
| El triage escala demasiado y arruina la conversación | Calibrar con casos del dataset real. Preferir sobre-escalar a sub-escalar (RC.7), pero medirlo |
| El día se va en el RAG y no queda tiempo para el triage | El triage vale 15 puntos y es diferenciador. **Bloque de tarde intocable** |

---

## Nota de cierre

Grabar hoy mismo un video corto de la demo killer, aunque sea con el celular. Si mañana algo se rompe, ya existe la evidencia de que funcionó.
