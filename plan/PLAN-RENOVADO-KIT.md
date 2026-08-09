# Plan renovado — reescrito contra el kit oficial

> **Fecha:** 2026-08-08 (sábado) · **Entrega:** lunes 10 de agosto
> **Fuentes leídas:** `https://sourcemeridian.com/tech-sphere-challenge` y el repositorio base `github.com/TechSphere2026/ParticipantArtifacts` (clonado y auditado archivo por archivo: `README.md`, `docs/rubrica-evaluacion.md`, `docs/stack-tecnico.md`, los 4 `.xlsx` y los 107 PDFs de `dataset/textos/`).
>
> Este documento **reemplaza** la planeación de `plan/02-viernes/` a `plan/05-lunes/` en todo lo que la contradiga. Los planes D2–D5 se escribieron antes de tener el kit, sobre suposiciones que el material oficial desmiente. Lo que sigue es lo que el kit dice de verdad, contrastado contra lo que ya está construido.

---

## 0. Resumen ejecutivo — las cinco cosas que cambian

1. **🔴 El modelo que estamos usando puede descalificar la entrega.** Las dos fuentes oficiales no dicen exactamente lo mismo (ver §1.1): la ficha web dice *"no hay un LLM único obligatorio"*, el repositorio dice que debe pertenecer a **una de cuatro familias** y que salirse **descalifica** (compuerta G3). `openai/gpt-oss-120b` corre en Groq pero es familia OpenAI: pasa bajo la lectura laxa, falla bajo la del repositorio. Se cambia a Llama vía Groq por asimetría de riesgo — 15 minutos contra el reto entero.
2. **No hay Databricks ni Delta Share.** Los datos vienen en un repositorio de GitHub, en `.xlsx` y PDFs. El bloque de 2h de D2 desaparece por completo.
3. **El diseño visual no puntúa.** `DESIGN.md` fue trabajo bien hecho pero **cero puntos** en la rúbrica. Ni una hora más de UI que no cierre una compuerta.
4. **Lo que sí puntúa es exactamente lo que no tenemos.** RAG con trazabilidad (20 pts) y lógica de decisión y escalamiento (20 pts) suman **40 de los 100 puntos** y hoy no existe ni una línea de ninguno de los dos.
5. **Hay un dataset con etiquetas de verdad (`label_ground_truth`) que permite medir el triage.** 160 casos etiquetados `verde`/`amarillo`/`rojo`. Es una ventaja competitiva enorme y ningún plan anterior la contemplaba.

---

## 1. Lo que el kit dice — hechos verificados

### 1.1 El modelo: dos fuentes que no dicen lo mismo

**Esta es la ambigüedad más cara del reto y conviene tenerla escrita con precisión.**

La **ficha técnica de la web** titula la sección: *"MODELOS SUGERIDOS Y STACK ABIERTO — no hay un LLM único obligatorio"*, y su nota cierra con: *"lo que se evalúa es que uses un modelo accesible, no un identificador exacto de versión."*

El **repositorio base**, `docs/stack-tecnico.md` §1, es más restrictivo: *"El stack es abierto con una sola excepción: el modelo de lenguaje. (…) debe pertenecer a **una de estas familias** (…) Usar un modelo fuera de estas familias **descalifica la entrega** (compuerta G3)."* Y la rúbrica, en G3, remite explícitamente a esa sección.

Las dos frases son compatibles en su lectura natural: *"no hay un LLM único obligatorio"* significa que no se impone **un** modelo, no que valga **cualquiera**. La web es el resumen; el repositorio es la norma que la rúbrica cita. Donde queda margen real de interpretación es en *"un modelo accesible"* (web) frente a *"una de las familias permitidas"* (repositorio).

Las cuatro familias, según `docs/stack-tecnico.md` §1:

| Familia | Dónde corre |
|---|---|
| **Google Gemini**, gama Flash | Nube, nivel gratuito |
| **Meta Llama** (vía Groq) | Nube, nivel gratuito |
| **Meta Llama** (serie 3.x, 1B–3B) | Local, CPU |
| **Microsoft Phi Mini** (serie 3.5+, ~3–4B) | Local, CPU |

> *"Usar un modelo fuera de estas familias descalifica la entrega (compuerta G3)."*

La lista fija **familias, no versiones**: si un ID puntual ya no existe, se usa el sucesor vigente de la misma familia y proveedor.

**Consecuencia inmediata:** `openai/gpt-oss-120b` es un modelo de la familia OpenAI corriendo en infraestructura de Groq. El proveedor es Groq; la **familia no es Meta Llama**. Bajo la lectura de la web ("un modelo accesible") pasa; bajo la del repositorio ("una de estas familias") no.

**Decisión: se cambia, por asimetría de riesgo.** Cambiar cuesta 15 minutos —el driver `openai` ya apunta a Groq vía `OPENAI_BASE_URL`— y satisface **ambas** lecturas. No cambiar apuesta el reto entero a que el jurado aplique la interpretación laxa, y G3 no penaliza con puntos: **descalifica**. La verificación es explícita: *"se verifica además contra tus dependencias, tu configuración y tu código"* — nuestro `LLM_MODEL` en `.env`, los logs de `metrics.ts` y el `LlmCompletion.model` de cada turno lo dejarían por escrito.

**Acción paralela y gratuita:** el README del kit invita a *"preguntar a la organización antes de construir tu solución sobre él"* si hay dudas sobre un modelo específico. Escribir a `communications@sourcemeridian.com` hoy. Si responden que la lectura laxa es la correcta, no perdimos nada: ya estaríamos sobre una familia permitida.

Lo demás del stack —STT, TTS, base vectorial, embeddings, orquestación— es **libre y sin restricción**. Deepgram sigue siendo válido. La interpretación de "zona gris" de `REGLAS.md` §Zona gris queda **obsoleta pero inofensiva**: era más estricta que el reglamento real.

### 1.2 No hay Databricks, no hay Delta Share

`README.md` del repositorio base, literal: *"Todos los datos del reto están en la carpeta `dataset/` de este repositorio. **No hay que conectarse a nada externo para obtenerlos.**"*

`REGLAS.md` RA.4 ("el RAG no se acopla a Databricks, doble fuente Delta Share + carpeta local") queda **satisfecha por construcción**: solo existe la carpeta local. El cliente Delta Sharing de ~80 líneas del plan D2 no se escribe.

### 1.3 Las dos superficies exigidas

| Superficie | Contrato funcional mínimo |
|---|---|
| **Consola de administración** | Subir documento · listar documentos cargados · eliminar documento · indicación visible de "procesado y disponible" |
| **Interfaz de llamada** | Iniciar llamada de voz desde el navegador · hablar (micrófono) · escuchar al agente |

Nuestro `/medico` y `/paciente` mapean uno a uno. **La consola es exigida**, no opcional — y hoy el ítem `Agregar conocimiento` del sidenav está deshabilitado.

### 1.4 Las 5 compuertas eliminatorias

| Compuerta | Qué exige | Nuestro estado |
|---|---|---|
| **G1** | Los 4 entregables (repo, diagrama, informe, video) | ⚠️ Solo el repo. Faltan 3. |
| **G2** | Levantable en ≤15 min siguiendo solo el README, cronometrado | ✅ `docker compose up` verificado limpio. **Falta el README real.** |
| **G3** | Modelo de una familia permitida + declarado en el informe | ❌ **Modelo actual descalifica.** |
| **G4** | El jurado habla y el agente responde con voz | ⚠️ Código completo (SPEC 06), **nunca ejercido en vivo contra Deepgram**. |
| **G5** | Subir documento desde la consola → el agente lo usa; eliminarlo → lo olvida. Con un documento que no está en ningún corpus entregado. | ❌ No existe. Es SPEC 07 + RAG. |

**Tres de cinco compuertas están en rojo o ámbar.** Nada de lo que sigue importa hasta cerrarlas.

### 1.5 Los 6 criterios de puntuación

| Puntos | Criterio | Estado |
|---:|---|---|
| 20 | RAG, precisión clínica y conocimiento vivo | ❌ 0% construido |
| 20 | Lógica de decisión y escalamiento | ❌ 0% construido |
| 15 | Comprensión del problema y diseño de la conversación | 🟡 Parcial (el chat conduce, pero sin guion clínico) |
| 15 | Calidad de la conversación (voz) | 🟡 Código listo, sin verificar |
| 15 | Video de argumentación y demo | ❌ No existe |
| 15 | Repositorio, proceso y buenas prácticas | 🟢 Fuerte (6 specs, PRs, CI, historia limpia) — falta el bloque de métricas |

Nuestro punto más fuerte (repositorio y proceso, 15 pts) ya está prácticamente cobrado. Los 40 puntos del núcleo funcional están en cero.

### 1.6 Métricas obligatorias del README

> *"Si no están, el apartado correspondiente de §4 se califica muy por debajo de su tope, aunque tu solución funcione bien."*

- **Latencia** P50 y P95, medida *desde que el paciente termina de hablar hasta que empieza a sonar el audio del agente*.
- **Consumo**: tokens de entrada y salida por turno **y por llamada**, invocaciones al modelo por turno, **consultas al RAG por llamada**.
- **Costo estimado por llamada** (si corre local, extrapolado a precios de API con el cálculo explicado).

`metrics.ts` de SPEC 04 ya captura tokens, latencia, costo y TTFT por llamada al LLM. **Falta:** agregación P50/P95, el contador de consultas RAG, y la métrica end-to-end de voz (fin-de-habla → primer audio), que es distinta del TTFT del LLM.

> **Advertencia de la rúbrica:** *"Reportar números que no se sostienen es peor que no reportarlos."* Las métricas se contrastan contra los logs de la sesión en vivo. Se miden, no se estiman.

### 1.7 Conductas que penalizan

- Alucinación clínica peligrosa (inventar dosis/medicamento, o tranquilizar ante un síntoma de alarma).
- **No alertar cuando había que alertar** — falso negativo. *"La reincidencia puede anular"* los 20 puntos de decisión.
- **Caer en inyección de prompt** — anula el apartado correspondiente de calidad de conversación.
- Métricas inconsistentes con los logs.
- Demo que no corresponde al repositorio.

`REGLAS.md` RC.3 ("las reglas determinísticas solo pueden subir la severidad, nunca bajarla") es exactamente la defensa correcta contra el falso negativo. Se mantiene y se implementa.

---

## 2. El dataset — lo que hay realmente

Auditado directamente sobre los archivos. Los cuatro `.xlsx` tienen **una sola hoja llamada `result`** y usan `inlineStr` (no `sharedStrings`), detalle relevante para cualquier parser.

### 2.1 `dataset_final.xlsx` — las conversaciones

**3.991 filas × 13 columnas.** Una fila = un turno.

`dialogo_id · caso_id · paciente_id · dia_postop · turno_idx · hablante · texto · label_ground_truth · estilo_paciente · modelo_paciente · modelo_agente · capa · generado_ts`

Distribuciones reales:

- **Capas:** `capa1_limpia` 1.920 turnos · `capa2_ruidosa` 2.071 turnos.
- **Hablante:** `agente` 1.920 · `paciente` 1.920 · **`tercero` 151** (el familiar que interrumpe — solo existe en capa 2).
- **Etiqueta (por turno):** `verde` 3.067 · `amarillo` 623 · `rojo` 301. **Por caso: 123 verde / 25 amarillo / 12 rojo.** Fuertemente desbalanceado, como advierte el README.
- **Estilo del paciente:** `minimizador_sintomas` 928 · `confundido` 867 · `colaborativo` 790 · `evasivo` 733 · `ansioso` 673.

El agente sintético del dataset hace **seis preguntas en orden fijo**: dolor (escala 0–10) → fiebre → movilidad → herida → apetito → sueño. **Ese es el guion clínico que se espera.** No hay que inventarlo: está en los datos.

Ejemplo real (caso `caso_tray_pac_42_00000_1`, capa 1):

```
[0] agente:   ¿Cómo ha estado el dolor desde la cirugía, en una escala del 0 al 10?
[1] paciente: La verdad, el dolor ha sido más bien un 1, apenas se nota, casi nada.
[2] agente:   ¿Ha tenido fiebre, como un aumento de temperatura o sensación de calor, desde la cirugía?
[3] paciente: No, la temperatura ha estado cerca de 37,5, apenas un poquito más alta, pero no me siento
              con fiebre, solo un calorcito leve, nada que me preocupe.
```

### 2.2 `trayectorias_postop_silver.xlsx` — el cuadro clínico

**160 filas.** `trayectoria_id · paciente_id · dia_postop · arquetipo_trayectoria · dolor_nrs · fiebre_c · movilidad · herida · apetito · sueno · seed · generado_ts`

- **Arquetipos:** `recuperacion_normal` 76 · `complicacion_leve_vigilancia` 60 · `complicacion_real` 24.
- `dolor_nrs`: 0–9 · `fiebre_c`: 36.2–39.5
- `movilidad`: `normal` 95 · `limitada_esperada` 61 · **`incapacitante_nueva` 4**
- `herida`: `normal` 118 · `eritema_leve` 39 · **`secrecion_purulenta` 3**
- `apetito`: `normal` 97 · `levemente_disminuido` 34 · `muy_disminuido` 29
- `sueno`: `normal` 95 · `levemente_alterado` 33 · `muy_alterado` 32

**Esto es oro para las reglas determinísticas de bandera roja.** `secrecion_purulenta`, `incapacitante_nueva`, `fiebre_c ≥ 38.5` y `dolor_nrs ≥ 8` son los disparadores objetivos, y el dataset dice exactamente cuántos casos deberían dispararlos.

### 2.3 `perfiles_clinicos_pacientes_silver_contest.xlsx` — 40 pacientes

`paciente_id · bundle_id · synthea_runtime · modulo_synthea · procedimiento · fecha_cirugia · edad · genero · comorbilidades · complicacion_encounter · generado_ts`

**Cinco procedimientos, 8 pacientes cada uno:** Apendicectomía · Colecistectomía · Colectomía · Reemplazo de cadera/rodilla · Mastectomía. `comorbilidades` es una **lista JSON dentro de una celda de texto** (`'[]'`, `'["hipertension"]'`).

### 2.4 `perfiles_pacientes_co.xlsx` — demografía colombiana

`paciente_id · nombre_completo · direccion · ciudad · departamento · documento_cc · eps · source_country · adapted_country · adaptation_fields · adaptation_ts`

Ej.: `Mauricio Juan González Sánchez · Dg. 73W # 3-79 Este · Soacha · Cundinamarca · Compensar EPS`.

### 2.5 `dataset/textos/` — el corpus del RAG

**107 PDFs en cinco carpetas**, en español e inglés: `Appendicitis/` · `cholecystitis/` · `colorectal cancer/` · `breast_cancer/` · `total joint replacement/`.

Trampas ya confirmadas por el propio README:

- **Dos nombres de carpeta contienen espacios** (`colorectal cancer`, `total joint replacement`).
- Hay **documentos repetidos**.
- **Un PDF de `Appendicitis/` está escaneado sin capa de texto** — la extracción va a devolver vacío. Hay que detectarlo y reportarlo, no fallar en silencio.
- La carpeta `breast_cancer/` contiene mayormente documentos de **cáncer de cuello uterino**, no de mama. El etiquetado por carpeta no es confiable como metadato clínico.

### 2.6 Cómo se unen

```
paciente_id  une los cuatro archivos
caso_id      =  "caso_" + trayectoria_id
```

Un paciente → 1 perfil clínico + 1 perfil demográfico + 4 trayectorias (días 1, 3, 7, 14) → cada trayectoria = 1 caso → cada caso = 1 conversación en dos capas.

### 2.7 ⚖️ Decisión de licencia — los PDFs NO se commitean

`README.md` del kit: *"Los documentos PDF de `dataset/textos/` son obra de sus respectivos autores y editores, **conservan sus propios derechos** y se incluyen únicamente como material de referencia para el reto."*

Nuestro repositorio es **público con licencia MIT**. Redistribuir 107 PDFs con derechos de terceros bajo MIT es un problema legal real y además engorda el clon que el jurado tiene que descargar dentro de los 15 minutos de G2.

**Decisión:** los PDFs **no entran al árbol versionado**. Se ingiere desde una carpeta local (`KNOWLEDGE_LOCAL_DIR`, ya previsto en RA.4) que se puebla con un script `pnpm dataset:fetch` que clona el repo del reto por `git clone --depth 1`. Los `.xlsx` sí pueden entrar (MIT explícito, datos sintéticos) — o seguir el mismo camino por consistencia.

**Riesgo a manejar en G2:** si la ingesta de 107 PDFs corre en el primer arranque, se come el presupuesto de 15 minutos. Ver §4.3.

---

## 3. Dónde estamos — auditoría del código actual

Seis specs implementados y mergeados a `main` (PRs #1 a #8):

| Spec | Qué dejó | Vale para la rúbrica |
|---|---|---|
| 01 | Andamiaje, Docker, CI, diseño congelado | G2 ✅ · 15 pts de repo/proceso |
| 02 | Contratos Zod, Postgres/pgvector, 9 endpoints, seed | Base de todo |
| 03 | Las 3 vistas del médico | Consola (parcial) · **0 pts por estética** |
| 04 | `LlmPort` + drivers mock/anthropic/openai + `metrics.ts` | **La pieza que salva G3 hoy mismo** |
| 05 | Chat en tiempo real por WebSocket, persistencia por turno | Base de la conversación |
| 06 | Voz Deepgram STT/TTS, push-to-talk, fallback Web Speech | G4 (sin verificar) |

**Lo que no existe:**

- RAG: cero. `pgvector` está instalado y sin usar. No hay embeddings, no hay chunking, no hay retrieval, no hay citas reales.
- Lógica de decisión / triage / escalamiento: cero.
- Resumen estructurado: hoy es un stub de una línea.
- Escritura de conocimiento: `knowledge.controller.ts` solo tiene `GET references` y `GET state`. Sin `POST`, sin `DELETE`.
- Ingesta del dataset real: la semilla actual son 5 sesiones y 3 pacientes **inventados**, no los 40 pacientes del kit.
- README de evaluación, diagrama, informe, video.

**Deuda técnica identificada previamente que ahora es irrelevante:** el ítem `Simular llamada`/`Enviar correo` descartado en SPEC 03, el endpoint huérfano `GET /patients/priority/:id`, la auditoría de endpoints de D5. Nada de eso puntúa. No se toca.

---

## 4. Las decisiones que hay que tomar hoy

### 4.1 🔴 Qué modelo — decisión bloqueante

Tres candidatos dentro de las familias permitidas:

| Opción | A favor | En contra |
|---|---|---|
| **Llama vía Groq** (recomendado) | Cambio de **una variable de entorno** — el driver `openai` ya apunta a Groq vía `OPENAI_BASE_URL` y está verificado en vivo. Latencia LPU, que es exactamente lo que premia el criterio de voz. Whisper Large V3 gratis en la misma cuenta como plan B de STT. | Límites de tasa del nivel gratuito durante la sesión de evaluación. |
| **Gemini Flash** | Ventana de contexto de ~1M tokens: permite meter guías completas sin fragmentar. | Driver nuevo (≈4h de trabajo que no tenemos). Límite de RPM del nivel gratuito más agresivo. |
| **Llama 3.x 1B–3B local (Ollama)** | Cero dependencia externa, blinda G2 y G4 contra caídas de red. | Calidad clínica insuficiente para 40 puntos de núcleo. Imagen Docker pesada. |

**Recomendación: Llama vía Groq**, con el ID vigente más reciente de la familia en Groq al momento de la entrega (la nota del kit autoriza explícitamente usar el sucesor vigente). Es un cambio de `LLM_MODEL` en `.env` y una línea en `pricing.ts`. **Costo: 15 minutos.** Toda la inversión de SPEC 04 se cobra exactamente aquí.

Acción inmediata además: `grep` del repo por `gpt-oss` y purga de cualquier referencia en `.env.example`, docs y specs, porque G3 *"se verifica contra tus dependencias, tu configuración y tu código"*.

### 4.2 Embeddings y vector store

`pgvector` ya está corriendo en el compose. **No se cambia a ChromaDB** — sería introducir un servicio nuevo a dos días de la entrega para ganar nada. El kit dice explícitamente que la base vectorial es libre.

La pregunta abierta es el modelo de embeddings. BGE-M3 (sugerido por el kit) pesa ~2.2 GB, y `REGLAS.md` RA.3 exige descargarlo en el `docker build`, no en runtime — eso choca de frente con los 15 minutos de G2 si el jurado construye desde cero.

Opciones a resolver en la Fase 2 del spec de RAG:

- **`Xenova/multilingual-e5-small`** vía `transformers.js` (~470 MB, corre en Node sin sidecar de Python, se hornea en la imagen). Recomendado.
- BGE-M3 completo vía sidecar Python — mejor calidad en español, peor G2.
- Embeddings por API de Gemini/Groq — más rápido de construir, pero introduce una dependencia de red en el camino crítico del RAG.

### 4.3 Cómo se ingiere el corpus sin romper G2

El jurado clona, corre `docker compose up`, y el reloj corre. Indexar 107 PDFs con embeddings en ese arranque no cabe.

**Recomendación:** commitear el índice **pre-computado** (los chunks y sus vectores como un `.sql` o `.jsonl` de semilla, ~decenas de MB) y que el arranque solo lo cargue en Postgres. La ingesta real se ejecuta en nuestra máquina, una vez, y `pnpm dataset:ingest` queda documentado y disponible para regenerarla. Así el arranque es una carga de datos, no un pipeline de ML — y G5 (subir un documento nuevo en caliente) sigue ejerciendo el pipeline real en vivo, que es lo que el jurado va a probar.

### 4.4 Qué hacemos con la semilla actual

Las 5 sesiones y 3 pacientes inventados de SPEC 02 se reemplazan por datos derivados del dataset real: 40 pacientes con su nombre, EPS, procedimiento y comorbilidades, y un subconjunto de casos con su conversación reconstruida desde `dataset_final.xlsx`. Esto hace que el dashboard del médico muestre datos que el jurado reconoce de su propio dataset — impacto directo en el criterio de comprensión del problema.

### 4.5 Cómo se usa `label_ground_truth` — la jugada diferencial

160 casos con criticidad de referencia permiten construir **un evaluador automático del triage**: correr los 160 casos contra nuestra lógica de decisión y reportar matriz de confusión, con énfasis en el **falso negativo** (`rojo` clasificado como `verde`), que es lo que la rúbrica castiga con más dureza.

Eso convierte "creemos que nuestro triage es bueno" en "nuestro triage tiene 0 falsos negativos sobre los 12 casos rojos del dataset oficial, y aquí está el script que lo reproduce". Es material directo para el informe, para el video (Pregunta 2) y para el criterio de repositorio/proceso.

**Es la mejor relación puntos/hora de todo lo que queda por construir.**

---

## 5. Plan de ejecución — 2 días y medio

Prioridad estricta: **compuertas primero, puntos después, adorno nunca.**

### Hoy, sábado 8 — núcleo funcional

| Bloque | Trabajo | Cierra |
|---|---|---|
| **B0 · 30 min** | Cambiar el modelo a Llama/Groq. Purgar `gpt-oss` del repo. Verificar un turno real en vivo. Actualizar `REGLAS.md` §R0.1 y §Zona gris con el reglamento verdadero. | **G3** |
| **B1 · 45 min** | Verificar la voz end-to-end contra Deepgram real: hablar, escuchar, medir. Es código ya escrito y nunca ejercido — el riesgo es que aparezca un bug ahí a último momento. | **G4** |
| **B2 · 3–4 h** | **RAG real** (SPEC 08): parser de PDFs, chunking, embeddings, `pgvector`, retrieval, citas trazables al documento fuente, e inyección al prompt. Incluye ingesta del corpus de 107 PDFs. | 20 pts |
| **B3 · 2 h** | **Conocimiento vivo** (SPEC 07, ya diseñado): `POST`/`DELETE` de referencias, consola de administración funcional, incremento de `kb_state.version`, separador de sistema en el hilo. Ahora se conecta al pipeline real de B2, no a mocks. | **G5** |

### Domingo 9 — decisión, evaluación y congelamiento a las 17:00

| Bloque | Trabajo | Cierra |
|---|---|---|
| **B4 · 3 h** | **Lógica de decisión y escalamiento** (SPEC 09): guion clínico de seis preguntas tomado del dataset, clasificación verde/amarillo/rojo, reglas determinísticas de bandera roja que solo suben severidad (RC.3), registro estructurado de la alerta, y qué se le dice al paciente. | 20 pts |
| **B5 · 2 h** | **Resumen estructurado + evaluador de triage** (SPEC 10): resumen de cierre con paciente, procedimiento, síntomas, decisión, referencias usadas y próximos pasos. Más el script que corre los 160 casos etiquetados y emite la matriz de confusión. | 20 pts (comparte) |
| **B6 · 1.5 h** | **Métricas de la rúbrica** (SPEC 11): P50/P95 de latencia fin-de-habla → primer audio, tokens por turno y por llamada, consultas RAG por llamada, costo por llamada. Endpoint o log verificable. | 15 pts |
| **B7 · 1 h** | Endurecimiento contra inyección de prompt y entradas adversas. Es una penalización explícita, y una defensa de system prompt bien hecha cuesta una hora. | Evita penalización |
| **17:00** | **Congelamiento de código.** Regla heredada de D4 y se respeta. | — |

### Lunes 10 — los 30 puntos baratos, sin tocar código

| Bloque | Trabajo | Cierra |
|---|---|---|
| **B8 · 2 h** | **README de evaluación**: levantamiento cronometrado en ≤15 min verificado de verdad sobre una máquina limpia, métricas reportadas, declaración del modelo. | **G2** + 15 pts |
| **B9 · 1 h** | **Diagrama** de arquitectura y flujo de decisión. *La rúbrica advierte: el jurado toma elementos del diagrama al azar y los busca en el código.* Diagramar lo que existe, no lo que quisimos construir. | **G1** + 15 pts |
| **B10 · 2 h** | **Informe final**: prompts, configuraciones, capturas, declaración del modelo y su justificación. El historial de 6 specs con sus "decisiones tomadas y descartadas" es material listo para usar — esa carpeta `specs/` es la evidencia de proceso que el criterio pide. | **G1** + 15 pts |
| **B11 · 2 h** | **Video**: demo de pantalla + las dos preguntas de cierre frente a cámara. Guion escrito antes de grabar. | **G1** + 15 pts |

**Si el domingo a las 15:00 algo de B4/B5 no está en pie, se corta y se documenta como limitación conocida.** Un bug documentado con honestidad cuesta menos puntos que un video sin grabar.

---

## 6. Specs a redactar

| Spec | Alcance | Prioridad |
|---|---|---|
| **07** — Conocimiento en caliente | Ya diseñado en `SPECS-PENDIENTES.md`. **Reordenar después de 08**, porque ahora se conecta al RAG real y no a mocks. | G5 |
| **08** — RAG clínico con trazabilidad | Ingesta del corpus, chunking, embeddings, `pgvector`, retrieval, citas verificables. Incluye la decisión de embeddings de §4.2 y la de índice pre-computado de §4.3. | 🔴 Máxima |
| **09** — Lógica de decisión y escalamiento | Guion clínico de 6 preguntas, triage verde/amarillo/rojo, reglas determinísticas RC.3, registro de alerta. | 🔴 Máxima |
| **10** — Resumen estructurado + evaluador de triage | Resumen de cierre y el script de los 160 casos etiquetados. | Alta |
| **11** — Métricas de la rúbrica | P50/P95, tokens, consultas RAG, costo por llamada. | Alta |

**Ajuste al método:** con dos días y medio, la Fase 2 de `/spec` se corre **corta y concreta** — este documento ya adelanta la mayoría de las respuestas. Se conserva el paso a paso con commit por paso y PR contra `main`; se recorta el ida y vuelta de preguntas.

---

## 7. Documentos del repositorio que quedan desactualizados

| Archivo | Qué corregir |
|---|---|
| `REGLAS.md` | R0.1 ("solo el LLM obligatorio que se anuncia el 7 de agosto") → familias permitidas de G3. La tabla de "zona gris" queda obsoleta: el reglamento real ya declara libre todo el stack de voz y RAG. RA.4 (Delta Share) → fuente local única. Los pesos de la rúbrica → 20/20/15/15/15/15. |
| `plan/02-viernes/D2-vie-07-ago.md` | Bloque 3 (Delta Share, 2h) eliminado. El día ya pasó. |
| `plan/03-sabado/` a `plan/05-lunes/` | Reemplazados por §5 de este documento. |
| `plan/SPECS-PENDIENTES.md` | Desactualizado desde antes del kit: marca SPEC 05 como `Borrador` y SPEC 06 como "falta redactar" cuando ambos están implementados y mergeados. Añadir specs 08–11. |
| `CLAUDE.md` | La sección "Only one LLM is allowed (announced 2026-08-07)" es incorrecta. `LlmPort` sigue siendo la arquitectura correcta, pero por G3 y trazabilidad, no por un modelo único impuesto. |
| `DESIGN.md` | Se mantiene como contrato visual congelado. **No se invierte una hora más en él.** |

---

## 8. Riesgos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Se entrega con `openai/gpt-oss-120b` y el jurado aplica la lectura del repositorio | **Descalificación total** | B0, primer bloque de hoy: 15 min de cambio que satisface ambas lecturas. Más consulta por correo a la organización, en paralelo. |
| La voz nunca se probó en vivo y falla el lunes | G4 · entrega no se evalúa | B1, hoy. No esperar al domingo. |
| La ingesta de 107 PDFs revienta los 15 min de G2 | G2 · entrega no se evalúa | Índice pre-computado (§4.3) + cronometrar el arranque de verdad en B8. |
| RAG + decisión no caben en dos días | 40 pts en riesgo | Orden estricto: primero un RAG que recupera y cita aunque sea simple, después la decisión. Un RAG básico que funciona puntúa; uno sofisticado a medias, no. |
| Límite de tasa del nivel gratuito de Groq durante la sesión en vivo | G4 y calidad de conversación | Verificar el límite vigente. Fallback local de voz ya existe; considerar uno análogo para el LLM si el límite resulta estrecho. |
| El PDF escaneado sin capa de texto rompe la ingesta | Ingesta incompleta y silenciosa | Detectar extracción vacía, registrarlo y continuar. Nunca fallar en silencio. |
| Se dedica tiempo a UI porque "se ve mejor" | Costo de oportunidad puro | La estética vale **0 puntos**. Está escrito en la rúbrica. |

---

## 9. La ventaja que ya tenemos

Vale la pena decirlo explícitamente porque cambia dónde gastar las horas que quedan:

- **`LlmPort` (SPEC 04) convierte la compuerta más peligrosa del reto en un cambio de variable de entorno.** Se construyó para el escenario de "modelo obligatorio anunciado el día 2" y sirve igual de bien para el escenario real. Es, además, la mejor respuesta posible a la Pregunta 2 del video.
- **La carpeta `specs/` con seis specs, sus decisiones tomadas y descartadas, y las fricciones registradas día a día es exactamente lo que pide el criterio de "qué rastro dejó tu proceso de trabajo".** Ya está escrito; solo hay que citarlo en el informe.
- **`docker compose up` verificado desde limpio más de una vez**, con bugs reales de arranque ya cazados y documentados. G2 está prácticamente cobrada.
- **Voz, chat en tiempo real, persistencia por turno y consola ya existen.** Lo que falta es el cerebro clínico, no la infraestructura.

Dicho de otra forma: llegamos al kit con toda la plomería hecha y ninguna de las decisiones clínicas tomadas. El plan de estos dos días y medio es exclusivamente cerebro clínico y evidencia.
