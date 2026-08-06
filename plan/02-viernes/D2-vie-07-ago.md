# D2 — Viernes 7 de agosto · día del anuncio

> **Objetivo del día:** sustituir el mock por el modelo real en menos de 3 horas, ingestar el dataset clínico verdadero, y no perder el día leyendo.

**Este es el día de mayor incertidumbre del sprint.** Todo lo construido en D0 y D1 existe precisamente para que hoy sea un día de conexión, no de construcción.

---

## Bloque 1 — Lectura dirigida (1h, no más)

Llega: repositorio base, dataset vía Delta Share, ficha técnica con el modelo obligatorio y las métricas, y la descripción detallada de los checkpoints.

Crear **`CHECKLIST-OFICIAL.md`** transcribiendo, sin interpretar:

- [ ] Nombre exacto del modelo obligatorio y cómo se accede (API directa, Bedrock, proxy propio del organizador)
- [ ] Cada subcriterio de la rúbrica con su puntaje
- [ ] Cada métrica exigida y su formato de reporte (P50/P95, tokens, costo por llamada)
- [ ] Descripción literal de las 5 compuertas
- [ ] Requisitos de formato del video (duración, contenido)
- [ ] Estructura obligatoria del repositorio base, si la hay
- [ ] Deadline exacto con hora y huso horario

**Timebox estricto de 1 hora.** Leer completo, transcribir, seguir. La tentación de analizar todo el día es real y es el riesgo principal de hoy.

---

## Bloque 2 — Enchufar el modelo obligatorio (2h) 🔴 crítico

1. **Escribir/activar el driver** correspondiente en `modules/llm/drivers/`. Si es un modelo ya previsto (Claude, GPT), es cambiar dos variables de entorno. Si es otro, es escribir ~250 líneas siguiendo la interfaz existente.

2. **Verificar las tres capacidades** que el sistema necesita:
   | Capacidad | Si falla |
   |---|---|
   | Streaming de tokens | Sin streaming, la latencia percibida se dispara. Compensar con frases de relleno más agresivas |
   | Tool use | Cae al modo prompting con JSON + parser tolerante (ya escrito) |
   | Structured output | Cae al parser tolerante de `parse.ts` |

3. **Instrumentar el cumplimiento (R0.1):** cada llamada loguea el `model` efectivamente usado. Endpoint `GET /compliance` que devuelve el modelo configurado y el conteo de llamadas por modelo. Es evidencia directa para el informe y para el evaluador.

4. **Calibrar costos:** llenar `LLM_INPUT_COST_PER_1M` y `LLM_OUTPUT_COST_PER_1M` con los precios reales para que el reporte de costo por llamada sea verdadero, no un placeholder.

5. **Prompt caching** si el proveedor lo soporta: cachear el system prompt y el protocolo clínico. Ahorra latencia y costo en cada turno.

**Objetivo temporal: modelo real conversando por voz antes del almuerzo.**

---

## Bloque 3 — Delta Share y dataset real (2h)

### Cliente Delta Sharing

Protocolo REST abierto con bearer token — no requiere SDK de Databricks. Cliente propio de ~80 líneas:

```
GET /shares                                    → lista shares
GET /shares/{s}/schemas                        → lista schemas
GET /shares/{s}/schemas/{sc}/tables            → lista tablas
POST /shares/{s}/schemas/{sc}/tables/{t}/query → URLs firmadas a Parquet
```

Leer los Parquet con **`hyparquet`** (npm, sin dependencias nativas).

**Regla RA.4 — doble fuente obligatoria:** la ingesta acepta Delta Share **y** una carpeta local (`KNOWLEDGE_LOCAL_DIR`). El RAG nunca se acopla a Databricks. Si Delta Share no responde el día de la evaluación, el sistema sigue funcionando con los documentos versionados en el repo.

### Explorar el dataset real

Esto **cambia decisiones**, no es exploración ociosa:

| Qué mirar | Qué decide |
|---|---|
| Procedimientos que aparecen | Alcance de las reglas de triage |
| Formato y estructura de los documentos | Estrategia de chunking |
| Regionalismos reales de los pacientes | Reescribir el glosario `es-CO` completo |
| Descripciones ambiguas de síntomas | Qué preguntas de desambiguación implementar |
| Presencia de umbrales clínicos (fiebre, dolor) | Valores exactos de las banderas rojas |

### Reescribir el glosario con datos reales

El glosario preliminar de `TECH-SPHERE-CHALLENGE.md` §9 está hecho de suposiciones. **Hoy se reescribe con lo que realmente dice el dataset.** Es la diferencia entre una feature decorativa y una que funciona.

---

## Bloque 4 — Alineación con el repo base (1h)

- Clonar el repositorio base del organizador y revisar si impone estructura, nombres de archivos, endpoints o formato de salida.
- **Si impone estructura:** adaptar la nuestra. No pelear con el formato del evaluador.
- **Si es solo un scaffold sugerido:** conservar nuestra arquitectura y documentar la decisión en el README (es material para la Pregunta 2 del video).
- Verificar si entregan credenciales del LLM para el evaluador, lo que confirma cómo redactar el `.env.example`.

---

## Bloque 5 — Ingesta inicial y verificación (1h)

- Ingestar el dataset clínico completo en pgvector.
- Verificar que el agente responde preguntas reales del dominio por voz.
- Ajustar el system prompt al contexto real: seguimiento post-operatorio, tono de enfermera, español colombiano, disclaimer inicial (RC.8).

---

## Alcance

**Dentro:** modelo real, dataset real, glosario real, alineación con el repo base.

**Fuera:**
- Retrieval híbrido, reranking, citas → D3
- Triage de dos capas → D3
- Conocimiento vivo real → D3
- VAD y manos libres → D4

> Hoy el RAG puede ser **retrieval vectorial simple**. Lo importante es que el modelo obligatorio esté conversando sobre el dataset verdadero al final del día.

---

## Criterios de aceptación

- [ ] `CHECKLIST-OFICIAL.md` completo con cada subcriterio y métrica exigida
- [ ] El agente responde por voz usando **exclusivamente** el modelo obligatorio
- [ ] `GET /compliance` confirma el modelo y que no hay llamadas a otro
- [ ] El dataset de Delta Share está ingestado y consultable
- [ ] La ingesta funciona también desde carpeta local, con Delta Share caído
- [ ] El glosario `es-CO` está reescrito con regionalismos reales del dataset
- [ ] Las reglas de banderas rojas tienen umbrales tomados del dataset, no inventados
- [ ] El reporte de costo por llamada usa los precios reales del modelo

---

## Riesgos

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| El día se va leyendo y analizando | **Alta** | Timebox de 1h para lectura. Es la regla más importante de hoy |
| El modelo no soporta tool use o structured output | Media | Parser tolerante ya escrito en D1. Cambio de ~30 min |
| Delta Share no conecta o el formato sorprende | Media | Doble fuente (RA.4). Si falla, se trabaja con la carpeta local y se resuelve el sábado |
| El repo base impone una estructura incompatible | Baja | Adaptarse, no pelear. Nuestra arquitectura está modularizada; mover carpetas es barato |
| El acceso al modelo es por un proxy con formato propio | Media | La capa `LLMPort` absorbe esto: un driver más, cero cambios en el negocio |
| El dataset es mucho más grande de lo esperado | Media | Ingestar un subconjunto representativo hoy; el corpus completo el sábado |

---

## Nota de cierre

Actualizar `TECH-SPHERE-CHALLENGE.md` con lo que se aprendió hoy: modelo real, métricas exigidas, subcriterios de rúbrica. Ese documento deja de ser especulación y pasa a ser hecho.
