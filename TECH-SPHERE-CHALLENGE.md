# Tech Sphere Challenge 2 — Voice Agent Edition
## Documento maestro de referencia y plan de ejecución

> Fuente: https://www.sourcemeridian.com/tech-sphere-challenge (leída 2026-08-03)
> Estado hoy: **3 de agosto de 2026**. Quedan **4 días** para el inicio del sprint.
> Nota: la página muestra en un punto "August 7, 2024" para el deadline de registro — es un typo del sitio. El cronograma real es 2026.

---

# 1. Resumen ejecutivo en 10 líneas

1. Reto **individual**, solo residentes en **Colombia**, perfil senior (AI builders que ya llevaron IA a producción).
2. Construir un **agente de voz para seguimiento post-operatorio** de pacientes.
3. El agente **llama/conversa en español**, interpreta síntomas, responde con base en **RAG clínico**, y **decide cuándo alertar a un humano**.
4. Debe existir una **consola en vivo** para subir/eliminar documentos: el agente **aprende y olvida en caliente**.
5. Cada respuesta clínica debe tener **trazabilidad de fuente**.
6. Cada llamada produce un **resumen estructurado**.
7. **El LLM es único y obligatorio para todos** — se anuncia el **7 de agosto**. Usar otro = **descalificación**.
8. Todo lo demás (orquestación, voz, RAG, vector DB, front) es **stack libre**.
9. **3 días de build**: 7 al 10 de agosto. Evaluación 10–18 ago. Demo final **5 sep** en Medellín (o remoto).
10. Premios: **$500 / $300 / $200 USD** en saldo prepagado de Claude. **Tú pagas toda la infraestructura**.

---

# 2. Fechas y cronograma (crítico)

| Fecha | Qué pasa | Acción tuya |
|---|---|---|
| 22 jul 2026 | Live + apertura de inscripciones (grabación disponible) | Ver la grabación si no lo hiciste |
| **7 ago 2026** | **Cierre de registro** + entrega de material técnico | **Registrarte YA. Es el gate #0** |
| 7 ago 2026 | Se anuncia el **modelo LLM obligatorio**, se entrega repo base, dataset vía Delta Share, ficha técnica, checkpoints detallados, métricas exigidas | Enchufar el modelo en tu capa agnóstica (ver §8) |
| 7–10 ago 2026 | **Semana de construcción — 3 días reales** | Ejecutar el plan de §12 |
| 10 ago 2026 | **Deadline de entrega** (los 4 entregables) | Buffer: cerrar el 9 en la noche |
| 10–18 ago 2026 | Revisiones + anuncio de 3 finalistas | — |
| 5 sep 2026 | Premiación + demo en vivo ante panel experto, Medellín (remoto permitido) | Preparar sustentación |

**Implicación #1 del cronograma:** tienes 72 horas para construir, pero **4 días previos (3–6 ago) sin restricción alguna** para preparar el andamiaje. La regla del modelo obligatorio solo aplica al LLM final; **nada te impide tener listo hoy** el pipeline de voz, la consola, el vector store, el front, Docker, README, diagramas y la capa de abstracción de LLM. **Esa es la ventaja competitiva más grande que hay disponible.**

**Implicación #2:** el material del 7 ago traerá subcriterios de rúbrica y métricas exigidas. Deja huecos flexibles: instrumentación de latencia/tokens/costo desde el día 0.

---

# 3. Qué SÍ hay que construir (obligatorio)

| # | Componente | Detalle exigido |
|---|---|---|
| 1 | **Conversación de voz adaptable** | Voz en tiempo real, en español, que se adapta a lo que responde el paciente (no un árbol rígido de preguntas) |
| 2 | **RAG clínico** | Respuestas fundamentadas en base de conocimiento clínico real (dataset entregado vía Delta Share / Databricks) |
| 3 | **Consola de conocimiento vivo** | Subir y eliminar documentos en tiempo real. El agente **aprende** lo nuevo y **olvida** lo eliminado, sin reiniciar |
| 4 | **Trazabilidad** | Cada respuesta clínica registra qué fuente(s) documental(es) la sustentan |
| 5 | **Lógica de decisión / alertas** | Determinar cuándo escalar a personal humano capacitado |
| 6 | **Resumen estructurado por llamada** | Un summary por interacción |

---

# 4. Qué NO hay que construir (no gastes tiempo aquí)

- ❌ Telefonía real en producción (nada de Twilio/SIP obligatorio — **ahorra ese dinero y ese tiempo**)
- ❌ Integración con sistemas hospitalarios reales (HL7, FHIR, EMR)
- ❌ Autenticación empresarial / gestión de roles / SSO
- ❌ Cobertura de todos los procedimientos médicos (basta el alcance del dataset)

> Traducción práctica: **una web app con micrófono es entrega válida**. Tu idea de React chat con voz encaja perfecto con lo pedido.

---

# 5. Restricciones y reglas duras

## 5.1 Restricción técnica única
> "Stack libre en orquestación, voz y RAG — **pero el LLM es único y obligatorio para todos**"

- Se anuncia el **7 de agosto**.
- Usar cualquier otro LLM **descalifica la entrega**.
- Filosofía declarada del organizador: *"gana la ingeniería, no la billetera"*.

**Zona gris a manejar con cuidado (mi lectura):** la regla dice *LLM*. STT (speech-to-text), TTS (text-to-speech), embeddings y reranker **no son LLMs de generación** y el stack de voz y RAG está declarado libre. Aun así:
- **Riesgo alto:** usar OpenAI Realtime API o Gemini Live — ahí el modelo conversacional *es* un LLM de otro vendor. **No lo hagas**, es descalificación casi segura.
- **Riesgo medio:** usar un LLM secundario para tareas auxiliares (normalizar regionalismos, resumir, reranking). Podrían leerlo como "usaste otro modelo".
  - **Mitigación:** que todo lo auxiliar corra con **el mismo modelo obligatorio** o con **modelos NO generativos** (embeddings, cross-encoder reranker, clasificador). Documéntalo explícito en el README: *"El 100% de la generación de lenguaje se ejecuta con `<modelo obligatorio>`. Los componentes X, Y son encoders/ASR/TTS, no LLMs."*
- **Riesgo bajo:** Whisper/Deepgram para STT, ElevenLabs/Azure para TTS, `bge-m3`/Voyage para embeddings. Esto es explícitamente "stack de voz y RAG", que es libre.

## 5.2 Reglas de participación
- **Individual.** Sin equipos.
- **Solo residentes en Colombia.** Desarrollo 100% virtual; sustentación en Medellín o videollamada.
- Perfil objetivo: senior con experiencia real de IA en producción.
- Preinscripción **no vinculante** — te aseguras cupo y material sin penalidad si no entregas.

## 5.3 Costos
> "Source Meridian no patrocina ni cubre costos de infraestructura, APIs, modelos de IA, ni ninguna otra herramienta."

**Tú pagas todo.** (Ver §10 para el presupuesto mínimo viable.)

## 5.4 Legal / propiedad intelectual
- **Obligatorio:** archivo `LICENSE` con **Licencia MIT en la raíz** del repo. Repo **público**.
- Conservas la propiedad intelectual, **pero** otorgas a Source Meridian licencia perpetua, mundial, libre de regalías para reproducir, publicar, distribuir y adaptar tu entrega.
- Tú indemnizas al organizador frente a reclamos de PI de terceros → **no metas código con licencia contaminante (GPL/AGPL) ni datos de terceros sin derecho**.
- Premios no son efectivo, no son transferibles a cuentas existentes, saldo **no recargable** al agotarse.
- Ley colombiana. Aceptación electrónica por checkbox.

## 5.5 Bonus no monetario
Perfiles destacados entran al flujo de recruitment de Source Meridian para proyectos Healthcare en EE. UU.

---

# 6. Las 5 compuertas eliminatorias (esto es lo que te saca del juego)

**Si fallas UNA sola, tu entrega ni siquiera se puntúa.**

| # | Compuerta | Cómo la aseguro |
|---|---|---|
| 1 | Los **4 entregables** completos | Checklist final; el informe es obligatorio ("sin informe no se evalúa") |
| 2 | La solución **corre en ≤15 minutos** siguiendo tu README (con credenciales dadas) | `docker compose up` de un solo comando + `.env.example` + script `seed` idempotente. **Probarlo en máquina limpia** |
| 3 | Usar **exclusivamente el modelo obligatorio** | Capa agnóstica con un solo driver activo por config; log de cada llamada con el `model` usado |
| 4 | La **conversación de voz en tiempo real** funciona | Demo grabada + fallback si falla el micrófono del evaluador (modo texto siempre visible) |
| 5 | **Subir/eliminar conocimiento desde consola** funciona | Botones upload/delete + prueba visible: preguntar → subir doc → misma pregunta cambia → borrar doc → vuelve a cambiar |

> **La compuerta #2 es la más subestimada.** Muchos pierden aquí. Diseña para que el evaluador haga: `git clone`, `cp .env.example .env`, pegar credenciales, `docker compose up`, abrir `localhost:3000`. Nada más.

> **La compuerta #5 es la que más gente hace mal.** "Olvidar" no es solo borrar el chunk del vector store: hay que invalidar caché de respuestas, quitarlo del contexto de sesiones activas y demostrar el antes/después.

---

# 7. Entregables y rúbrica

## 7.1 Los 4 entregables

| # | Entregable | Requisitos explícitos |
|---|---|---|
| 1 | **Repositorio GitHub público** | Implementación completa + README + `LICENSE` MIT en la raíz |
| 2 | **Diagrama** | Arquitectura de la solución **y** flujo de decisión del agente (son dos cosas; puedes hacer dos diagramas) |
| 3 | **Informe final** | Evidencia de proceso: prompts usados, configuraciones, capturas del demo. **Sin informe no se evalúa** |
| 4 | **Video** | Screen recording de la solución funcionando **+ las 2 preguntas de cierre respondidas en cámara** (cara visible). Duración no especificada en el sitio → asume 5–10 min y confirma con la ficha técnica del 7 ago |

## 7.2 Rúbrica (100 puntos)

| Criterio | Puntos | Qué maximiza puntaje |
|---|---|---|
| RAG, precisión clínica, conocimiento vivo, trazabilidad de fuentes | **20** | Citas verificables, evaluación cuantitativa del RAG, demo de aprender/olvidar |
| Calidad de conversación del agente de voz y UX | **20** | Latencia baja, barge-in, naturalidad, manejo de regionalismos |
| Diseño de arquitectura e implementación técnica | **15** | Diagramas claros, separación de capas, agnosticismo de proveedor |
| Lógica de decisión y sistema de alertas | **15** | Reglas clínicas determinísticas + LLM, no solo LLM. Auditables |
| Calidad de código, documentación, reproducibilidad | **15** | Tests, tipado, README impecable, un solo comando |
| Video y respuestas a las preguntas de cierre | **15** | Narrativa de negocio, no solo técnica |

> **Observación estratégica:** 40 de 100 puntos están en RAG+Voz. Pero **30 puntos (documentación + video)** son "puntos gratis" que se ganan con disciplina, no con genialidad técnica. Mucha gente los deja tirados por quedarse codeando hasta el último minuto. **Reserva el día 3 completo para esos 30 puntos.**

## 7.3 Las 2 preguntas de cierre (prepáralas desde ya)

**P1 — Pitch comercial:** *"Si debes convencer a un cliente de que adopte el agente que construiste, ¿cómo presentarías el problema que resuelve, por qué tu solución es la adecuada y qué valor diferencial ofrece frente a otras alternativas?"*

Estructura de respuesta sugerida:
- **Problema con número:** readmisiones post-quirúrgicas evitables; una enfermera hace ~20 llamadas de seguimiento/día; el 60–70% no detecta nada accionable → costo alto por hallazgo.
- **Solución:** el agente cubre el 100% de los pacientes en las primeras 24–72 h, y escala a humano solo el subconjunto con banderas rojas. La enfermera pasa de operadora a especialista en excepciones.
- **Diferencial:** conocimiento vivo (el protocolo cambia hoy, el agente lo aplica hoy, sin redeploy), trazabilidad auditable por respuesta (defendible ante compliance clínico), y agnosticismo de modelo (no quedas casado con un vendor).

**P2 — Decisión técnica más relevante:** alternativas evaluadas, por qué las descartaste, riesgos identificados, y qué cambiarías con dos semanas más.

Buen candidato de respuesta: *"Elegí pipeline STT→LLM→TTS desacoplado en lugar de una API speech-to-speech nativa."* Alternativas: Realtime speech-to-speech (descartada porque **amarra el LLM al vendor de voz**, y el reto exige un modelo específico; además es caja negra para trazabilidad). Riesgos: mayor latencia acumulada → mitigada con streaming token-a-token y TTS por frases. Con 2 semanas más: eval automatizado de RAG clínico, detección de turno semántica, y A/B de voces.

---

# 8. Arquitectura propuesta (la parte gruesa)

## 8.1 Principio rector: **agnosticismo de modelo**

Tu intuición es correcta y es probable que anuncien un modelo Claude (el premio es en saldo Claude, y Source Meridian tiene relación con Anthropic). **Pero no apuestes.** Diseña así:

```
apps/
  web/                     # React (Vite) — chat + voz + consola de conocimiento
  api/                     # FastAPI o NestJS — orquestador
packages/
  llm/                     # ← CAPA AGNÓSTICA
    port.ts|py             # interfaz: chat(), stream(), tools(), structured()
    drivers/
      anthropic.py         # Claude (Messages API, tool_use, streaming)
      openai.py            # GPT (chat.completions / responses)
      google.py            # Gemini
      bedrock.py           # por si el modelo obligatorio viene vía Bedrock
    registry.py            # selecciona driver por env LLM_PROVIDER + LLM_MODEL
  rag/                     # ingesta, chunking, embeddings, retrieval, citations
  voice/                   # STT streaming, VAD, TTS streaming
  clinical/                # reglas de triage, red flags, escalamiento
```

**Contrato de la interfaz LLM (esto es lo que te salva el 7 de agosto):**

```python
class LLMPort(Protocol):
    async def stream_chat(
        self,
        system: str,
        messages: list[Msg],
        tools: list[ToolSpec] | None,
        max_tokens: int,
        temperature: float,
    ) -> AsyncIterator[Delta]: ...        # Delta = texto | tool_call | usage

    async def structured(
        self, system: str, messages: list[Msg], schema: type[BaseModel]
    ) -> BaseModel: ...
```

Puntos de fricción reales entre proveedores que la capa debe normalizar:
- **Formato de mensajes:** Anthropic separa `system` del array; OpenAI lo mete como rol.
- **Tool calling:** `tool_use`/`tool_result` (Anthropic) vs `tool_calls`/`role: tool` (OpenAI) vs `functionCall` (Gemini).
- **Structured output:** OpenAI tiene `json_schema` nativo; con Claude se logra con tool-use forzado (`tool_choice`) — resuélvelo en el driver, no en el negocio.
- **Streaming events:** SSE con nombres distintos; normaliza a tu `Delta`.
- **Uso/costos:** `usage.input_tokens/output_tokens` vs `prompt_tokens/completion_tokens` — normaliza para poder reportar tokens y costo por llamada (métrica exigida).
- **Prompt caching:** Anthropic usa `cache_control` en bloques; OpenAI es automático. Ponlo detrás de una bandera del driver.

**Dos caminos de implementación:**

| Opción | Pro | Contra | Recomendación |
|---|---|---|---|
| **Adapter propio** (~250 líneas por driver) | Control total, cero dependencia, se ve muy bien en la rúbrica de arquitectura | Tú mantienes el mapeo | ✅ **Recomendado** — es exactamente lo que el jurado quiere ver, y son 2 drivers reales, no 10 |
| **LiteLLM** (proxy o SDK) | 1 línea, 100+ modelos | Abstracción con fugas en tool-use y streaming; te resta puntos de "decisión técnica" | Úsalo como **fallback/segundo driver** para demostrar portabilidad |

> **Jugada ganadora:** implementa el adapter propio, y en el README pon una tabla *"cambiar de modelo = cambiar 2 variables de entorno"* con un video/GIF de 10 segundos mostrando el mismo agente corriendo con Claude y con otro modelo. Eso responde la Pregunta 2 y gana puntos de arquitectura simultáneamente.

## 8.2 Arquitectura de voz — pipeline desacoplado (NO speech-to-speech)

```
Micrófono (browser)
   │  WebRTC/WebSocket, PCM 16 kHz
   ▼
[VAD Silero]  ──> detección de turno + barge-in
   │
   ▼
[STT streaming]  ──> parciales + final
   │
   ▼
[Normalizador ES-CO]  ──> regionalismos → término clínico canónico
   │
   ▼
[Orquestador LLM]  ──> RAG (tool) + reglas clínicas (tool) + memoria de sesión
   │  stream de tokens
   ▼
[Segmentador por frase]  ──> primera frase apenas hay puntuación
   │
   ▼
[TTS streaming]  ──> chunks de audio
   │
   ▼
Parlante + transcripción visible en pantalla
```

**Por qué desacoplado y no speech-to-speech nativo:**
1. Speech-to-speech (OpenAI Realtime, Gemini Live) **fija el LLM al vendor** → colisiona con la regla del modelo obligatorio → riesgo de descalificación.
2. No puedes insertar RAG con trazabilidad limpia en medio del audio.
3. La trazabilidad y el log de fuentes exigen el texto intermedio.

**Presupuesto de latencia objetivo (métrica P50/P95 exigida):**

| Etapa | Objetivo P50 | Nota |
|---|---|---|
| VAD end-of-turn | 250–400 ms | el mayor ahorro está aquí; no uses 1 s de silencio fijo |
| STT final | 100–300 ms | streaming, no batch |
| Retrieval RAG | 50–150 ms | vector local; precalienta el índice |
| LLM primer token (TTFT) | 400–800 ms | prompt caching del system + protocolo |
| TTS primer audio | 75–300 ms | streaming por frase |
| **Total percibido** | **≈ 900–1500 ms** | por debajo de 1.5 s ya se siente conversacional |

**Trucos de latencia que valen puntos:**
- **Speculative start:** dispara el retrieval con la transcripción parcial antes de que el paciente termine.
- **Frase de relleno:** "Ajá, entiendo…" en TTS pregrabado mientras llega el primer token — enmascara 500 ms.
- **Prompt caching** del system prompt + protocolo clínico (ahorra latencia y costo).
- **Barge-in real:** si el VAD detecta voz mientras el TTS suena, cancelas el audio inmediatamente. Esto sube mucho la percepción de calidad (20 pts de UX de voz).
- **Primera frase corta:** instruye al LLM a abrir siempre con una oración breve; el TTS arranca antes.

## 8.3 RAG con conocimiento vivo

```
Databricks Delta Share ──(delta-sharing python)──> tablas clínicas
                                │
              documentos subidos por consola (PDF/MD/TXT)
                                │
                                ▼
                   [Ingesta: parse → chunk → embed]
                                │
                                ▼
        pgvector / Qdrant  (chunk, embedding, doc_id, version, hash, metadata)
                                │
                    retrieval híbrido: BM25 + vectorial + RRF
                                │
                            reranker (cross-encoder)
                                │
                            top-k con citas
```

**Lectura de Delta Share** (te lo dan el 7 ago, prepara el código antes):
```python
import delta_sharing
client = delta_sharing.SharingClient("config.share")   # profile file que te entregan
print(client.list_all_tables())
df = delta_sharing.load_as_pandas("config.share#share.schema.table")
```
Instala `delta-sharing` **desde ya** y ten el loader escrito con una tabla dummy.

**Conocimiento vivo — el diseño que gana la compuerta #5:**

| Operación | Qué debe pasar |
|---|---|
| **Upload** | Parse → chunk → embed → insert con `doc_id`, `version`, `active=true`, `uploaded_at`. Disponible en la siguiente consulta **sin reiniciar el proceso**. |
| **Delete** | **Soft delete** (`active=false`) + filtro en el retrieval + **invalidar caché de respuestas** + notificar a sesiones activas por WebSocket. Nada de reindexar todo. |
| **Update** | Nueva versión, versión anterior a inactiva. Trazabilidad histórica intacta. |
| **Evidencia** | Un panel de "Estado del conocimiento" en la consola: lista de docs, chunks por doc, timestamp, activo/inactivo, y un log en vivo de "indexado / retirado". |

> **Demo killer para el video (30 segundos):** preguntas "¿qué hago si tengo fiebre de 38.5?" → responde con protocolo A citando `doc_A`. Subes `protocolo_v2.pdf` que cambia el umbral. Misma pregunta → responde protocolo B citando `doc_B`. Borras `doc_B` → vuelve a A. **Sin reiniciar nada, en pantalla, con el timestamp visible.** Eso es literalmente la compuerta 5 + parte de los 20 puntos de RAG.

**Trazabilidad:**
- Cada respuesta genera un objeto `{answer, citations: [{doc_id, doc_name, chunk_id, score, snippet, version}]}`.
- En el chat, la cita se muestra como chip clicable que abre el fragmento exacto.
- En el resumen de llamada, las fuentes van embebidas.
- Persiste todo en DB → el informe final puede mostrar el rastro de auditoría.
- **Anti-alucinación:** instrucción dura de "si no está en el contexto recuperado, dilo y escala"; verificación post-hoc opcional (¿la afirmación está soportada por algún chunk?).

## 8.4 Lógica de decisión y alertas

**No dejes que el LLM decida solo la escalación clínica. Eso es un riesgo y el jurado lo va a mirar.**

Diseño de dos capas:

```
Capa 1 — REGLAS DETERMINÍSTICAS (banderas rojas, no negociables)
  fiebre ≥ 38.5 °C                → ESCALAR AHORA
  sangrado activo abundante       → ESCALAR AHORA
  dolor ≥ 8/10 o dolor creciente  → ESCALAR AHORA
  disnea / dolor torácico         → ESCALAR AHORA (urgencia)
  dehiscencia de herida / pus     → ESCALAR AHORA
  vómito persistente > 24 h       → ESCALAR
  ausencia de diuresis            → ESCALAR
  ideación suicida / confusión    → ESCALAR AHORA
  (ajustar con el dataset real del 7 ago)

Capa 2 — LLM con salida estructurada (matiz, contexto, combinaciones)
  {severity: none|low|medium|high|critical,
   symptoms: [...], rationale: str, recommended_action: str,
   sources: [...], confidence: float}

Decisión final = MAX(capa1, capa2)   # las reglas nunca se pueden bajar, solo subir
```

**Niveles de escalación:**
| Nivel | Acción |
|---|---|
| `none` | Continuar seguimiento, cerrar llamada con recomendaciones |
| `low` | Consejo de autocuidado + reagendar seguimiento 24 h |
| `medium` | Notificar a enfermería (cola no urgente, webhook/email/dashboard) |
| `high` | Alerta inmediata a enfermería + transferencia simulada |
| `critical` | Instruir al paciente a ir a urgencias / llamar 123, y alerta inmediata |

**Manéjalo como tool-calls del LLM** → así el LLM también "sabe" que escaló y ajusta el tono ("voy a comunicarte con una enfermera ahora mismo").

**Seguridad clínica obligatoria (menciónalo en el README, suma puntos de criterio clínico):**
- El agente **nunca diagnostica ni cambia medicación**.
- Disclaimer al inicio de la llamada: es un asistente automatizado de seguimiento.
- Si el paciente pide hablar con humano → escalar de inmediato, sin negociar.
- Si detecta emergencia → interrumpir el guion y dar instrucción de emergencia.
- Nunca inventa dosis, umbrales ni protocolos: sin fuente, no hay afirmación clínica.

## 8.5 Resumen estructurado por llamada

Esquema sugerido (JSON, validado con Pydantic/Zod):
```jsonc
{
  "call_id": "uuid",
  "patient_ref": "anon-123",
  "procedure": "colecistectomía laparoscópica",
  "started_at": "...", "ended_at": "...", "duration_sec": 214,
  "language_notes": ["paciente usó 'guayabo', normalizado a 'malestar general'"],
  "symptoms_reported": [
    {"symptom": "fiebre", "value": "38.2 °C", "onset": "hace 6 horas", "severity": "medium"}
  ],
  "vitals_self_reported": {"temp_c": 38.2, "pain_0_10": 6},
  "red_flags_triggered": ["temp >= 38.0"],
  "escalation": {"level": "high", "reason": "...", "notified": true, "channel": "nurse_queue"},
  "guidance_given": [{"text": "...", "citations": [{"doc_id": "...", "chunk_id": "..."}]}],
  "adherence": {"medication_taken": true, "mobility": "camina con apoyo"},
  "next_followup": "2026-08-08T09:00:00-05:00",
  "transcript_url": "...",
  "metrics": {"ttft_ms_p50": 620, "e2e_ms_p95": 1480, "tokens_in": 8210, "tokens_out": 940, "cost_usd": 0.031}
}
```
> Mete las **métricas dentro del resumen**: el reto exige reportar latencia P50/P95, tokens y costo por llamada. Que salgan automáticas, no en una hoja de cálculo a mano.

---

# 9. Regionalismos colombianos — tratamiento específico

El dataset trae "pacientes colombianos con regionalismos y descripciones ambiguas de síntomas". Esto es un criterio explícito de evaluación. Estrategia en 4 capas:

**Capa 1 — STT preparado para el acento**
- Deepgram Nova-3 (español/multilingüe) con **keyterm prompting**: le pasas el vocabulario clínico y los regionalismos esperados para sesgar el reconocimiento.
- Alternativa: `faster-whisper large-v3` local con `initial_prompt` con vocabulario clínico colombiano.
- Sube la calidad del audio: 16 kHz mono, supresión de ruido del navegador activada.

**Capa 2 — Diccionario normalizador (determinístico, barato, auditable)**
Un `glossary_co.yaml` versionado, aplicado post-STT antes del retrieval:

```yaml
# malestar / estado general
- variants: [guayabo, maluquera, maluco, achacado, aporriado, moliente]
  canonical: "malestar general"
  clinical: "malaise"
- variants: [descompuesto, "me cayó mal", "revuelto el estómago", "cortadera"]
  canonical: "malestar gastrointestinal"
  clinical: "GI upset / diarrea"
# dolor
- variants: [me duele un jurgo, "un resto", "harto", "un mundo", "una nota"]
  canonical: "intensidad alta"
- variants: [punzada, puntada, pinchazo, "un pálpito"]
  canonical: "dolor punzante"
  clinical: "sharp pain"
- variants: [ardor, escozor, quemazón, "arde", "escuece"]
  canonical: "ardor"
# fiebre / temperatura
- variants: [calentura, destemplado, "con fiebrecita", "escalofriado", "friolento"]
  canonical: "fiebre / escalofríos"
# herida
- variants: [materia, pus, "está botando", "supurando", "chorreando"]
  canonical: "secreción purulenta"
  clinical: "purulent discharge" ; red_flag: true
- variants: [se abrió, "se despegó", "se soltaron los puntos", descosido]
  canonical: "dehiscencia de herida"
  red_flag: true
- variants: [morado, cardenal, "chichón", hinchado, inflamado, "sapo"]
  canonical: "hematoma / edema"
# respiración
- variants: [ahogo, "me falta el aire", fatiga, "agitado", "cansancio al respirar"]
  canonical: "disnea"
  red_flag: true
# mareo / síncope
- variants: [mareo, "se me va la cabeza", "vi estrellas", "me desvanecí", "se me nubló"]
  canonical: "mareo / presíncope"
# náusea
- variants: [asco, "ganas de trasbocar", "arqueadas", "devolver", "vomitiar"]
  canonical: "náusea / vómito"
# cantidad / frecuencia — ambigüedad
- variants: [poquito, "un chorrito", tantico, "casi nada"]
  canonical: "cantidad escasa"
- variants: ["un jurgo", "un montón", "harto", "un resto"]
  canonical: "cantidad abundante"
# temporal
- variants: [ahorita, "hace un rato", "endenantes", "hace ratico"]
  canonical: "recientemente (requiere precisar)"
  needs_clarification: true
# muletillas a ignorar
- variants: [pues, "o sea", "sumercé", "hermano", "parce", "mijo", "ave maría", "eh ave maría"]
  canonical: ""
```

**Capa 3 — Normalización semántica con el LLM obligatorio**
Un paso barato (mismo modelo, pocos tokens, salida estructurada) que convierte la frase del paciente en síntomas canónicos + valores. Sirve donde el diccionario no llega. **Usa el modelo obligatorio, no un modelo ajeno.**

**Capa 4 — Desambiguación conversacional (esto es lo que más impresiona)**
Cuando el paciente es ambiguo, el agente **repregunta como una enfermera real**:
- "¿Poquito de sangre es como una manchita en la gasa, o le empapó el apósito?"
- "Cuando dice que le duele harto, del 1 al 10 ¿en cuánto lo pone?"
- "¿Se tomó la temperatura con termómetro o es que se siente caliente?"
- "Ahorita ¿es hoy en la mañana o hace unos minutos?"

Reglas: **una pregunta por turno**, lenguaje llano, sin jerga médica hacia el paciente. Nunca aceptar un valor ambiguo para disparar (o no disparar) una alerta: **si es ambiguo y podría ser bandera roja, se pregunta o se escala**.

**Además:** el RAG debe indexar tanto el término canónico como las variantes (expansión de consulta con sinónimos antes del retrieval), o el retrieval fallará con "materia" cuando el documento dice "secreción purulenta".

---

# 10. Presupuesto — cómo NO desfalcarte

Objetivo realista: **USD 20–60 total**, con un techo duro. Nada de esto exige contratos ni planes anuales.

## 10.1 Reglas de oro
1. **El LLM obligatorio te lo dan el 7 ago** — puede que también te den credenciales (la compuerta #2 dice "credenciales provistas", lo que sugiere que el evaluador aporta las suyas). Aun así presupuesta USD 20–30 de consumo propio para desarrollo.
2. **Todo lo local es gratis.** Postgres+pgvector, Qdrant, embeddings locales, Whisper local, Piper/Kokoro TTS: 0 USD.
3. **Paga solo por lo que se ve en el demo:** una voz TTS agradable y un STT rápido. Ahí sí vale gastar.
4. **Pon límites de gasto** en cada dashboard (Deepgram, ElevenLabs, etc.) el mismo día que creas la cuenta.
5. **Cachea agresivamente en desarrollo:** un cache de TTS por hash de texto te ahorra el 80% de la factura mientras iteras el mismo guion 200 veces.

## 10.2 Opciones de TTS (voz — el criterio más visible)

> Precios de referencia a agosto 2026; **verifícalos antes de suscribirte**, cambian seguido.

| Opción | Calidad ES-LatAm | Latencia | Costo aprox. | Veredicto |
|---|---|---|---|---|
| **ElevenLabs Flash v2.5 / Turbo** | ⭐⭐⭐⭐⭐ la más natural en español | ~75–150 ms | Starter ~$5/mes (~30 k chars); Creator ~$22/mes (~100 k chars) | ✅ **Mejor relación impresión/costo.** $5–22 alcanza de sobra para 3 días |
| **Cartesia Sonic 2/3** | ⭐⭐⭐⭐⭐ excelente, muy buen español | ~40–90 ms (la más rápida) | Free tier generoso; pago ~$5–49/mes | ✅ **La mejor si priorizas latencia.** Alternativa top a ElevenLabs |
| **Azure Speech (Neural, es-CO)** | ⭐⭐⭐⭐ voces `es-CO-SalomeNeural` / `es-CO-GonzaloNeural` | ~200–400 ms | ~$16/1M chars, **free tier 500 k chars/mes** | ✅ **La más barata con acento colombiano nativo.** Gratis para este volumen |
| **Google Cloud TTS (Chirp3-HD)** | ⭐⭐⭐⭐ buena | ~300 ms | Standard ~$4/1M, HD ~$16–30/1M, free tier mensual | ⚪ Válida, sin ventaja clara |
| **Kokoro / Piper (local)** | ⭐⭐⭐ robótica pero decente | ~50 ms local | **$0** | ✅ **Fallback obligatorio.** Si se cae la API en el demo, no te quedas mudo |
| **XTTS-v2 / F5-TTS (local)** | ⭐⭐⭐⭐ clonable | Depende de GPU | $0 pero necesita GPU | ⚪ Solo si tienes GPU y tiempo |
| OpenAI TTS | ⭐⭐⭐⭐ | ~300 ms | ~$15/1M chars | ⚠️ Evítalo por óptica: no des ninguna razón para dudar de la regla del modelo |

**Mi recomendación:** **Azure Speech `es-CO-SalomeNeural` como principal** (acento colombiano real, free tier cubre todo el reto, cero riesgo de factura) + **ElevenLabs Flash como opción premium** si al escucharlo sientes que Azure suena plano ($5 del plan Starter). **Kokoro local como fallback** que se activa solo si la API falla. Menciónalo en la arquitectura: *"TTS intercambiable por configuración"* → suma puntos de agnosticismo.

## 10.3 Opciones de STT

| Opción | Calidad ES-CO | Latencia | Costo | Veredicto |
|---|---|---|---|---|
| **Deepgram Nova-3** | ⭐⭐⭐⭐⭐ con keyterm prompting | ~100–300 ms streaming | ~$0.004–0.007/min; **$200 de crédito gratis al registrarte** | ✅ **Mejor opción.** El crédito gratis cubre el reto entero |
| **faster-whisper large-v3 (local)** | ⭐⭐⭐⭐ | 200–600 ms según hardware | **$0** | ✅ **Fallback y modo offline.** Mac con Apple Silicon lo corre bien |
| **Groq whisper-large-v3-turbo** | ⭐⭐⭐⭐ | muy rápida | ~$0.04/hora de audio | ✅ Baratísimo, buena alternativa |
| **AssemblyAI Universal-Streaming** | ⭐⭐⭐⭐ | ~300 ms | ~$0.15–0.37/hora, crédito inicial | ⚪ Válida |
| **Azure STT** | ⭐⭐⭐⭐ es-CO | ~300 ms | ~$1/hora, free tier 5 h/mes | ⚪ Cómodo si ya usas Azure para TTS (una sola cuenta) |

**Mi recomendación:** **Deepgram Nova-3** (crédito gratis + keyterm prompting es justo lo que necesitas para regionalismos) con **faster-whisper local** como fallback.

## 10.4 Resto del stack (todo gratis o casi)

| Componente | Elección | Costo |
|---|---|---|
| Vector DB | **pgvector** en Postgres vía Docker (o Qdrant local) | $0 |
| Embeddings | **`intfloat/multilingual-e5-large`** o **`BAAI/bge-m3`** local (excelentes en español) | $0 |
| Embeddings alternativos | Voyage `voyage-3` (partner de Anthropic, no es un LLM) | ~$0.02–0.06/1M tokens |
| Reranker | `bge-reranker-v2-m3` local (cross-encoder, no es LLM) | $0 |
| VAD | **Silero VAD** (ONNX, corre en navegador o servidor) | $0 |
| Backend | FastAPI (Python) o NestJS (TS) | $0 |
| Front | **React + Vite + Tailwind + shadcn/ui** | $0 |
| Transporte audio | WebSocket con PCM, o **LiveKit self-hosted** si quieres WebRTC serio | $0 |
| Deploy | **Local + Docker Compose** (no necesitas hosting: el evaluador corre tu repo) | $0 |
| Observabilidad | OpenTelemetry + logs estructurados, o Langfuse self-hosted | $0 |
| Databricks | Delta Share (te dan credenciales) | $0 |

**Presupuesto total realista: USD 0–30.** Techo recomendado: **USD 60**. No hay razón para pasar de ahí.

---

# 11. Propuestas de solución — 3 opciones concretas

## Opción A — "Web Voice Console" (RECOMENDADA) 🏆

Es tu idea, refinada. **La que mejor mapea a la rúbrica con el menor riesgo.**

**Interfaz:** una sola página React con tres zonas:

```
┌──────────────────────────────────────────────────────────────────────┐
│  Agente de Seguimiento Post-Operatorio      [● Grabando]  [🔊 Voz ▾] │
├───────────────────────────┬──────────────────────────────────────────┤
│                           │                                          │
│  CONVERSACIÓN             │   PANEL CLÍNICO EN VIVO                  │
│  ─────────────            │   ─────────────────────                  │
│  🤖 Buenas, don Luis, le  │   Nivel de riesgo:  ██████░░  MEDIO      │
│     habla el asistente…   │                                          │
│     └ 📎 protocolo_v2.pdf │   Síntomas detectados:                   │
│                           │    • fiebre 38.2 °C   (hace 6 h)         │
│  👤 "Me siento maluco y   │    • dolor 6/10       ↑ desde ayer       │
│     con calentura"        │                                          │
│     ↳ normalizado:        │   🚩 Banderas rojas: temp ≥ 38.0         │
│       malestar general,   │                                          │
│       fiebre              │   Fuentes usadas en esta respuesta:      │
│                           │    1. protocolo_fiebre.pdf · chunk 12    │
│  🤖 ¿Se la tomó con       │       "…si la temperatura supera…"       │
│     termómetro?           │    2. egreso_colecistectomia.md · c.3    │
│                           │                                          │
│  [🎤 hablar] [⌨ escribir] │   ⏱ TTFT 610 ms · E2E 1.2 s · $0.004    │
├───────────────────────────┴──────────────────────────────────────────┤
│  BASE DE CONOCIMIENTO           [+ Subir documento]                  │
│  ● protocolo_fiebre.pdf   v2  42 chunks  10:14  [ver] [🗑 eliminar]  │
│  ● egreso_colecistect.md  v1  18 chunks  09:02  [ver] [🗑 eliminar]  │
│  ○ protocolo_fiebre.pdf   v1  (retirado 10:14)                       │
└──────────────────────────────────────────────────────────────────────┘
```

**Por qué gana:**
- El **panel clínico en vivo** hace visible en el video todo lo que la rúbrica premia: trazabilidad, síntomas, banderas rojas, métricas. **El jurado no tiene que imaginarse nada.**
- La **consola de conocimiento abajo** es la compuerta #5 demostrada en la misma pantalla, sin cambiar de vista.
- **Voz por defecto, texto siempre visible y modo texto disponible** → si al evaluador le falla el micrófono, **no falla la compuerta #4** porque igual puede probar el agente.
- Corre entero en local con Docker. Cero costo de hosting, cero riesgo de deploy.

**Detalles de UX de voz que suman:**
- Botón de micrófono con estados claros: `idle / escuchando / pensando / hablando`, con waveform.
- **Barge-in:** hablas encima del agente y se calla al instante.
- Toggle `Voz | Texto` en el header, con **voz como default** (como pediste).
- Transcripción parcial en gris mientras hablas, en negro al confirmarse.
- La normalización de regionalismos se muestra debajo del turno del paciente (`↳ normalizado: …`) → es evidencia visual de una feature que nadie más va a mostrar.
- Selector de "escenario de paciente" para el demo (colecistectomía / cesárea / artroscopia) → demuestra amplitud en 20 segundos.
- Botón **"Finalizar llamada"** que genera el resumen estructurado y lo muestra en un modal descargable en JSON/PDF.

**Stack concreto:**
```
Front:  React + Vite + TypeScript + Tailwind + shadcn/ui + Zustand
        AudioWorklet para captura PCM · WebSocket bidireccional
Back:   FastAPI + WebSocket · asyncio
        Silero VAD · Deepgram streaming · driver LLM agnóstico · Azure/ElevenLabs TTS
Datos:  Postgres 16 + pgvector · SQLModel/SQLAlchemy
RAG:    multilingual-e5-large + BM25 (rank_bm25 o tsvector) + RRF + bge-reranker
Infra:  docker compose (postgres + api + web) · un solo comando
```

## Opción B — "Simulación de llamada telefónica"

Igual que A, pero la interfaz imita una llamada: pantalla de teléfono, el agente "llama" al paciente, timbre, y el usuario contesta. Sin telefonía real (no se exige) — es una simulación visual.

**Pro:** narrativamente más creíble, se ve muy bien en video, refleja el caso de uso real (el agente llama, no el paciente escribe).
**Contra:** menos espacio en pantalla para mostrar trazabilidad y panel clínico; más tiempo en UI y menos en RAG.
**Cuándo elegirla:** si terminas la Opción A el día 2. Puedes tenerla como **una segunda vista** (`/call`) que reusa el mismo backend. Lo mejor de ambos mundos.

## Opción C — "Twilio / telefonía real"

**No la hagas.** El reto dice explícitamente que no se espera telefonía en producción. Cuesta dinero, quema medio día en configuración, agrega latencia de red telefónica, y **no suma un solo punto de rúbrica**. Si quieres el efecto sin el costo, usa la Opción B.

## Recomendación final
**Opción A como base, con la vista de "llamada" (B) como extra opcional el día 3 si sobra tiempo.** No toques C.

---

# 12. Plan de ejecución

## Fase 0 — AHORA (3 al 6 de agosto): construir todo lo que no depende del modelo

Esto es lo más importante de todo el documento. **Llegar al 7 de agosto con el 70% construido.**

| Día | Tarea |
|---|---|
| **Hoy (3 ago)** | ✅ **Registrarte** (cierra el 7). Crear repo con `LICENSE` MIT. Scaffold monorepo. Docker Compose con Postgres+pgvector funcionando. |
| **4 ago** | Pipeline de voz completo con un LLM cualquiera *de prueba* (que luego reemplazas): captura de audio en el navegador → VAD → STT streaming → eco → TTS streaming. **Medir latencia real.** Crear cuentas Deepgram/Azure con límites de gasto. |
| **5 ago** | RAG completo con documentos clínicos públicos de prueba (guías post-operatorias en español que consigas): ingesta, chunking, embeddings, retrieval híbrido, reranker, citas. Consola de upload/delete con soft-delete e invalidación de caché. **Instalar y probar `delta-sharing` con datos dummy.** |
| **6 ago** | Front React completo (chat + panel clínico + consola). Reglas de triage. Glosario de regionalismos v1. Esquema del resumen estructurado. Instrumentación de métricas (P50/P95, tokens, costo). Borrador de README, diagramas y guion del video. |

> **Diseña con `LLM_PROVIDER=mock` durante toda la fase 0.** Un driver mock que responde texto fijo te deja construir y probar TODO el sistema sin gastar un centavo ni conocer el modelo final.

## Fase 1 — 7 de agosto: día del anuncio

1. Leer la ficha técnica completa. Anotar cada subcriterio de rúbrica y cada métrica exigida.
2. **Enchufar el modelo obligatorio en la capa agnóstica** (debería ser: escribir/activar un driver + cambiar 2 variables de entorno). Objetivo: **funcionando en menos de 2 horas**.
3. Conectar Delta Share, explorar el dataset real, ver los regionalismos y procedimientos que realmente aparecen.
4. **Reescribir el glosario de regionalismos con datos reales**, no con suposiciones.
5. Ajustar reglas de triage a los procedimientos del dataset.
6. Clonar el repo base que entregan y ver si exige alguna estructura específica → adaptar.

## Fase 2 — 8 y 9 de agosto: pulir e integrar

- Día 8: ingesta real del dataset, tuning de prompts, calibración de triage, pruebas conversacionales grabadas.
- Día 9 mañana: optimización de latencia, barge-in, manejo de errores, fallbacks.
- **Día 9 tarde: CONGELAR CÓDIGO.** Ese día se hacen README, diagramas, informe y video.

## Fase 3 — 9 tarde / 10: los 30 puntos gratis

- [ ] Probar en **máquina limpia**: clone → `.env` → `docker compose up` → funciona en < 15 min. Cronometrado.
- [ ] README: qué es, arquitectura, cómo correrlo, cómo probar cada compuerta, decisiones técnicas, limitaciones conocidas.
- [ ] Diagrama de arquitectura + diagrama de flujo de decisión (Mermaid en el repo + PNG en el informe).
- [ ] Informe: prompts completos, configuraciones, capturas, métricas medidas, tabla de la rúbrica con dónde se cumple cada criterio.
- [ ] Video: demo (incluida la demo killer de conocimiento vivo, §8.3) + las 2 preguntas en cámara. Guion escrito, dos tomas máximo.
- [ ] Verificar `LICENSE` MIT en la raíz y repo **público**.
- [ ] Entregar con **un día de margen**.

---

# 13. Checklist de riesgos

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| El modelo obligatorio no soporta tool-use o streaming como esperas | Media | La capa agnóstica debe tener fallback: si no hay tool-use, usar prompting con JSON + parser tolerante |
| Se cae la API de TTS/STT durante la grabación del video | Media | Fallbacks locales (Kokoro + faster-whisper) activables por env var. Grabar el video con margen |
| El evaluador no logra correr en 15 min | **Alta si no lo pruebas** | Probar en máquina limpia. Imágenes Docker precompiladas. Modelos de embeddings descargados en el build, no en runtime |
| Delta Share no conecta / el dataset es distinto a lo esperado | Media | Capa de ingesta con dos fuentes: Delta Share y carpeta local. Nunca acoples el RAG a Databricks directamente |
| Latencia alta arruina la percepción de "tiempo real" | Media | Medir desde el día 1, no al final. Frases de relleno + streaming por frase |
| Te quedas sin tiempo para informe/video | **Alta** | Congelamiento de código el 9 en la tarde. Innegociable |
| Alucinación clínica en el demo en vivo | Media | "Sin fuente, no hay afirmación clínica" + reglas determinísticas por encima del LLM |
| Duda sobre uso de otro modelo | Baja | README con sección explícita "Cumplimiento del modelo obligatorio" + log de todas las llamadas con el nombre del modelo |

---

# 14. Diferenciadores (lo que hará que tu entrega no se parezca a las demás)

1. **Capa agnóstica de LLM demostrada en video** — mismo agente, dos modelos, dos variables de entorno. Responde la Pregunta 2 y suma en arquitectura.
2. **Normalización de regionalismos visible en la UI** — nadie más va a mostrar el `↳ normalizado:`, y es un criterio explícito del reto.
3. **Panel clínico en vivo** — hace auditable en tiempo real algo que los demás dejarán en logs.
4. **Doble capa de decisión** (reglas determinísticas + LLM) — es lo que un cliente de healthcare real exige. Habla directo a un jurado de una empresa de healthcare.
5. **Versionado del conocimiento con historial** — no solo subir/borrar: mostrar qué versión respondió qué y cuándo.
6. **Métricas automáticas por llamada** en el propio resumen — cumples el requisito de métricas sin trabajo manual.
7. **Fallbacks locales completos** — el sistema funciona sin internet salvo por el LLM. Impresiona en reproducibilidad.
8. **Desambiguación proactiva estilo enfermera** — "¿una manchita o le empapó el apósito?". Es la diferencia entre un chatbot y un agente clínico.

---

# 15. Acciones inmediatas (hoy, 3 de agosto)

1. **Registrarte en el reto** — el registro cierra el 7 de agosto y es preinscripción sin penalidad.
2. Ver la grabación del live del 22 de julio (puede tener detalles que no están en la página).
3. Crear el repo público con `LICENSE` MIT en la raíz — es requisito duro, hazlo primero y olvídalo.
4. Crear cuentas con free tier y **límites de gasto**: Deepgram ($200 crédito), Azure Speech (500k chars gratis). Opcional ElevenLabs Starter $5.
5. Levantar el scaffold: `docker compose up` con Postgres+pgvector, FastAPI y Vite respondiendo.
6. Escribir la interfaz `LLMPort` con driver `mock` funcionando.
7. Escribir a communications@sourcemeridian.com si necesitas aclarar la duración del video o el alcance exacto de la regla del LLM (mejor preguntar ahora que asumir).

---

## Contacto del organizador
- communications@sourcemeridian.com · admon@sourcemeridian.com
- Calle 7D sur # 43A 99, Piso 10, Edificio Torre Almagran, Medellín, Antioquia

## Registro — qué te piden
Nombre completo · Email · Al menos un perfil (GitHub o LinkedIn) · Aceptación de política de privacidad

---

# 16. Lo que puedo tomar de `invoice-system`

> Proyecto analizado: `/Users/alejandro/Documents/AI-ENG-COD-FACILITO/invoice-system`
> ~5.500 líneas de Python. Stack: ChromaDB + sentence-transformers + BM25 + LangGraph + Ragas + Prisma/Supabase.
> **Conclusión general: cerca del 60% del RAG y de la orquestación del reto ya lo resolviste ahí.** Lo que falta es la capa de voz, la consola de conocimiento vivo y la capa agnóstica de LLM.

## 16.1 Mapa de reutilización — qué sirve y para qué compuerta

| De `invoice-system` | Sirve para | Puntos de rúbrica |
|---|---|---|
| `rag/retrieval.py` — pipeline avanzado completo | **RAG clínico** | 20 pts (RAG) |
| `rag/vectorstore.py` — indexación + reconstrucción de chunks | Conocimiento vivo | Compuerta #5 |
| `rag/ingestion.py` — loaders + estrategias de chunking | Ingesta de documentos | 20 pts (RAG) |
| `agents/playground/supervisor.py` — grafo con HITL | **Lógica de decisión y alertas** | 15 pts |
| `tests/rag/test_golden_semantic_similarity.py` — golden dataset | Evidencia cuantitativa de calidad | 20 + 15 pts |
| `rag/retrieval.py` — `_usage_tracker` | **Métricas de tokens/costo exigidas** | Requisito de la ficha técnica |
| `README.md` + `AGENTS.md` + `diagrams/` | Entregables 1, 2 y 3 | 15 pts (documentación) |
| `rag/schemas_venta.py` — Pydantic para extracción | **Resumen estructurado por llamada** | Componente obligatorio |

---

## 16.2 Lo que copio casi tal cual (alto valor, bajo esfuerzo)

### A. El pipeline de retrieval avanzado — `rag/retrieval.py`

Esto es lo más valioso del proyecto. Ya tienes implementado y probado:

- **`BM25Index`** — búsqueda por keywords con tokenización simple.
- **`HybridRetriever`** — combina BM25 + vectorial con **normalización de scores por el máximo** y peso `alpha` configurable. Esta normalización es exactamente el detalle que la mayoría implementa mal.
- **`generate_multi_queries()`** — expansión de la consulta en N reformulaciones vía LLM.
- **`reciprocal_rank_fusion()`** — RRF con `k=60` (el estándar).
- **`rerank()`** — cross-encoder con carga lazy singleton.
- **`compress_with_reranker()`** — compresión de contexto **sin gastar LLM**, rerankeando oraciones sueltas.
- **`advanced_rag_query()`** — orquesta todo: multi-query → híbrido → dedup → rerank → generar.

**Adaptaciones para el reto:**

1. **Cambiar el cross-encoder.** Ahora usas `cross-encoder/ms-marco-MiniLM-L-6-v2`, que es **solo inglés**. Para el dataset clínico colombiano necesitas `BAAI/bge-reranker-v2-m3` (multilingüe). Es un cambio de una línea en `_get_cross_encoder()` y probablemente el mayor salto de calidad disponible.
2. **Cambiar el modelo de embeddings.** `paraphrase-multilingual-MiniLM-L12-v2` (384 dims) es rápido pero flojo. Para terminología clínica sube a `intfloat/multilingual-e5-large` o `BAAI/bge-m3`. Ojo: `e5` requiere prefijos `query:` / `passage:` para rendir.
3. **`multi_query` te ayuda con regionalismos.** Si el paciente dice "materia" y el documento dice "secreción purulenta", la reformulación puede tender el puente. Pero es más barato y confiable resolverlo con el glosario de §9 **antes** del retrieval. Usa ambos.
4. **Añadir `doc_id`/`version`/`active` al metadata de los chunks** — hoy tu metadata tiene `source`, `chunk_index`, `employee_name`, `date`. Para el conocimiento vivo necesitas versión y estado.

⚠️ **Deuda técnica a corregir:** `call_llm()` está clavado a Groq (`base_url` hardcodeado, `GROQ_MODEL`). Es justo lo que la capa agnóstica de §8.1 debe eliminar. **Refactorizar `call_llm` a `LLMPort.complete()` es el primer paso del port.**

### B. El tracker de tokens — patrón directo para las métricas exigidas

```python
_usage_tracker = {"input_tokens": 0, "output_tokens": 0, "calls": 0}
def reset_usage_tracker(): ...
def get_usage(): ...
```

El reto exige reportar **tokens y costo por llamada**. Este patrón ya lo resuelve. Mejóralo así:
- Muévelo dentro del `LLMPort` (así funciona con cualquier driver).
- Usa `contextvars` en vez de una global — con audio en streaming y varias sesiones concurrentes, una global se corrompe entre llamadas.
- Añade `latency_ms` por llamada y percentiles P50/P95 acumulados.
- Añade `cost_usd` calculado desde precios en config, no hardcodeados.

Tu `.env.example` ya tiene `INPUT_COST_PER_1M_TOKENS` / `OUTPUT_COST_PER_1M_TOKENS` — la idea correcta, sin terminar de cablear. **Termínala esta vez.**

### C. Golden dataset + test de similitud semántica — `tests/rag/`

Esto es un **diferenciador enorme** y casi nadie lo va a llevar al reto. Ya tienes:
- Generación de golden con Ragas `TestsetGenerator` (`rag/generate_golden_ragas.py`, con soporte de contexto en español y modo `--per-document`).
- Test parametrizado que corre el RAG real contra cada caso y mide similitud coseno vs. `reference`.
- Umbral configurable por env (`RAG_GOLDEN_MIN_COSINE`).
- Reporte TXT acumulativo con timestamp.
- Gate por env var (`RUN_RAG_GOLDEN=1`) para que el test **no rompa CI** si faltan credenciales — patrón limpio.

**Para el reto esto se traduce directo en:** una tabla en el informe final del tipo *"47 preguntas clínicas golden, similitud coseno media 0.81, 44/47 sobre umbral"*. Eso es evidencia cuantitativa de precisión clínica, que es literalmente lo que valen los 20 puntos de RAG. **La mayoría va a entregar "funciona bien" sin un solo número.**

Adaptación: además de similitud coseno, agrega un test de **trazabilidad** — verificar que la cita devuelta corresponde al documento que contiene la respuesta. Y un test de **conocimiento vivo**: indexar doc A, preguntar, borrar A, indexar B, misma pregunta, verificar que la respuesta cambió. Eso automatiza la compuerta #5.

### D. La estructura de documentación

Tu `README.md` (278 líneas) es de calidad de entrega: quick start, estructura, comandos, troubleshooting con tabla de errores/fix, roadmap con checkboxes. `AGENTS.md` como referencia rápida. `diagrams/` con Mermaid versionado en el repo.

**Todo eso es el entregable 1, 2 y 3 del reto.** Copia la plantilla completa. Ajustes:
- Agrega sección **"Cumplimiento del modelo obligatorio"** (§5.1).
- Agrega **"Cómo verificar cada compuerta en 5 minutos"** — le facilitas la vida al evaluador y aseguras que no falle la compuerta #2 por no encontrar cómo probar algo.
- La sección de troubleshooting con tabla es oro: el evaluador que se atasca y encuentra su error ahí no te penaliza.

---

## 16.3 Los patrones de diseño que reaprovecho (no el código, la idea)

### E. Supervisor con clasificación + verificador de confianza + HITL

`supervisor.py` implementa: LLM clasifica en 4 categorías → **segundo LLM verifica con un score de confianza** → si `confidence < 0.99`, `interrupt()` pide decisión humana.

**Este patrón es exactamente el triage clínico del reto**, con los nombres cambiados:

```
invoice-system                    →  agente de voz post-operatorio
─────────────────────────────────────────────────────────────────
supervisor (clasifica intención)  →  clasificador de severidad de síntomas
assess_categorization (confianza) →  verificador de decisión de escalamiento
interrupt() por baja confianza    →  ESCALAR A ENFERMERA por baja confianza
route_after_supervisor            →  ruteo por nivel de alerta
quote_review_agent (aprobación)   →  confirmación humana antes de cerrar caso crítico
```

**El insight transferible:** *baja confianza del modelo ⇒ interviene un humano.* En cotizaciones era conveniencia; en triage clínico es **seguridad del paciente**, y es un argumento fortísimo para la Pregunta 2 del video y para el criterio de lógica de decisión (15 pts).

Adaptaciones necesarias:
- El umbral `0.99` era agresivo porque el costo de equivocarse era bajo. En clínico, **asimétrico**: umbral bajo para escalar (ante la duda, escalas) y alto para NO escalar.
- Las reglas determinísticas de §8.4 van **por encima** del clasificador. En `invoice-system` el LLM decide solo; aquí no puede.

### F. Fallbacks con mensaje de servicio en cada worker

Cada agente (`rag_agent`, `db_agent`, `quote_draft_agent`) tiene `try/except` que, ante fallo, genera un mensaje de disculpa **con instrucción explícita de no inventar datos**:

> *"No inventes políticas ni datos de la empresa"* / *"No inventes cifras ni datos de inventario"*

**Directamente transferible y crítico en salud.** Si se cae el RAG en medio de una llamada, el agente **no puede improvisar consejo médico**. El fallback debe ser: *"No puedo verificar eso ahora mismo, voy a comunicarlo con una enfermera"* → y escalar. En clínico, **fallo técnico = escalamiento automático**, no disculpa pasiva.

### G. Parser JSON tolerante en vez de structured output nativo

`_parse_classification_json()` y `_parse_review_json()` limpian fences de markdown, buscan el primer `{` y el último `}`, y parsean. El comentario del código explica el porqué:

> *"No usar with_structured_output: en Groq usa json_schema y muchos modelos (Llama) no lo soportan."*

**Esto es exactamente el riesgo #1 de la tabla de §13.** No sabes qué modelo te van a dar el 7 de agosto ni si soporta structured output nativo. Ese parser tolerante es **el fallback que ya tienes escrito y probado en producción**. Va directo al `LLMPort`:

```
structured() → intenta tool-use/json_schema nativo
            → si el driver no lo soporta o falla, cae al parser tolerante
```

### H. Carga lazy singleton de modelos ML

`_get_cross_encoder()` y `_get_sentence_model()` cargan una sola vez, con `quiet_ml_load()` para silenciar el ruido de descarga.

**Relevante para la compuerta de 15 minutos:** si el evaluador arranca y el sistema descarga 500 MB de `sentence-transformers`, se te va medio presupuesto de tiempo. **Descarga los modelos en el `docker build`, no en runtime.** Es una lección que tu propio código ya insinúa (el comentario *"primera vez puede descargar ~500MB"`) y que en el reto sí tiene consecuencia.

### I. Caché en memoria del índice + invalidación explícita

`main_rag_pipeline_v2.py` tiene `_collection` / `_chunks` globales, `ensure_rag_resources(reindex=...)` y — clave — **`clear_rag_cache()`**, documentada como *"útil tras reindex externo"*.

**Ese es literalmente el mecanismo de la compuerta #5.** Ya identificaste el problema (caché que se desactualiza tras cambiar el índice) y escribiste la salida. Para el reto hay que ir más allá:
- `clear_rag_cache()` recarga **todo** desde disco. En caliente, con una llamada en curso, eso es un pico de latencia. Necesitas **invalidación incremental**: quitar solo los chunks del `doc_id` afectado.
- Añadir invalidación del **índice BM25**, que en tu código se reconstruye entero al instanciar `HybridRetriever` (`BM25Okapi` sobre todos los chunks en cada búsqueda). Con documentos entrando y saliendo en vivo, hay que reconstruirlo o mantenerlo incremental.

⚠️ **Bug latente a no repetir:** `HybridRetriever` se instancia **dentro** de `advanced_rag_query()`, así que el índice BM25 se reconstruye **en cada consulta**. Con un corpus pequeño no se nota; con audio en tiempo real y presupuesto de latencia de 150 ms para retrieval, eso te mata. **Instáncialo una vez y refréscalo solo cuando cambie el conocimiento.**

### J. Estrategia de chunking documentada con evidencia

`CHUNKING_STRATEGY_FINAL.md` documenta dos intentos fallidos (`max_size=1200` → 9% de bloques partidos; `max_size=2100` → empleados mezclados y dilución semántica) antes de llegar a `chunk_by_employee()`: **1 chunk = 1 entidad semántica completa**.

**El principio traslada perfecto:** 1 chunk = 1 protocolo clínico completo, o 1 chunk = 1 procedimiento. Partir un protocolo de manejo de fiebre por la mitad es exactamente el mismo error que partir el reporte de un empleado.

Y el **formato del documento** es igual de valioso que la conclusión: *"probé A, falló por X con este número; probé B, falló por Y; elegí C"*. Eso es material listo para la **Pregunta 2 del video** y para el informe final. Escríbelo mientras decides, no después.

### K. Datos sintéticos generados por pipeline

`seed/invoices/` tiene un pipeline `generate_daily_json.py` → `json_to_journal.py` → 30 archivos JSON + 30 narrativos en texto. Generaste datos realistas de forma reproducible.

**Úsalo el 3–6 de agosto**, antes de tener el dataset real: genera 20–30 documentos clínicos sintéticos post-operatorios en español para desarrollar el RAG. Y **genera transcripciones sintéticas de pacientes colombianos con regionalismos** para probar el pipeline de normalización sin tener el dataset. Cuando llegue el real el 7, ya solo cambias la fuente.

---

## 16.4 Lo que NO debo repetir

| Antipatrón en `invoice-system` | Por qué es problema en el reto |
|---|---|
| **5 pipelines RAG paralelos** (`main_rag.py`, `_hybrid_search`, `_pipeline_completo`, `_v2`) marcados como "experimental o legado" | Confunde al evaluador y cuesta puntos de calidad de código. **Un solo entry point.** Los experimentos van en una rama, no en `main` |
| **Groq hardcodeado** (`base_url`, `GROQ_MODEL` en 3 archivos distintos) | Es el riesgo de descalificación. Todo el acceso a LLM pasa por el port, sin excepción |
| **`print()` con códigos ANSI mezclado con lógica** | En un backend con WebSocket necesitas logging estructurado. El estado va a la UI por WS, no a stdout |
| **Globales mutables** (`_collection`, `_chunks`, `_usage_tracker`) | Con audio concurrente y varias sesiones, se corrompen. `contextvars` o estado por sesión |
| **Cross-encoder solo-inglés** en un corpus español | Bug silencioso de calidad: el reranker desordena en vez de ordenar. **Verifica el idioma de cada modelo que uses** |
| **`chunk_by_employee` con regex de 1 línea** frágil, atado al formato exacto | Con documentos clínicos que sube el usuario en la consola, el formato es impredecible. Chunking robusto y agnóstico de formato |
| **`venv/`, `chroma_db_*/` y `.env` en el árbol de trabajo** (verificado: **no están trackeados**, `.gitignore` los cubre) | Aquí lo hiciste bien. Mantén el mismo rigor: en el reto el repo es **público y con licencia MIT**, y una clave filtrada es un incidente de seguridad. Verifica `git ls-files` antes del push final |
| **`seed/` completo ignorado en `.gitignore`** | En `invoice-system` los datos generados no se versionan. En el reto, **el evaluador necesita datos de prueba para correr en 15 minutos**: versiona un set mínimo de documentos de ejemplo o un script de seed que no dependa de credenciales externas |

---

## 16.5 Plan concreto de trasplante (días 3–6 de agosto)

| Origen | Destino | Trabajo |
|---|---|---|
| `rag/retrieval.py` | `packages/rag/retrieval.*` | Portar tal cual; sacar Groq y meter `LLMPort`; cambiar cross-encoder a `bge-reranker-v2-m3` |
| `rag/vectorstore.py` | `packages/rag/store.*` | Portar; cambiar Chroma → pgvector; añadir `doc_id`/`version`/`active` |
| `rag/ingestion.py` | `packages/rag/ingest.*` | Portar loaders; reescribir chunking para documentos clínicos |
| `rag/embeddings.py` | `packages/rag/embed.*` | Portar; subir a `multilingual-e5-large`; precargar en `docker build` |
| `_usage_tracker` | `packages/llm/metrics.*` | Portar a `contextvars` + latencia + costo + P50/P95 |
| `supervisor.py` (patrón) | `packages/clinical/triage.*` | Reimplementar la idea: clasificar → verificar confianza → escalar si baja |
| `_parse_classification_json` | `packages/llm/parse.*` | Portar tal cual como fallback de `structured()` |
| `tests/rag/` | `tests/rag/` | Portar el esqueleto; regenerar golden con el dataset clínico el 7 de agosto |
| `README.md` + `AGENTS.md` | raíz | Plantilla, reescribiendo contenido |
| `diagrams/*.md` | `docs/diagrams/` | Plantilla de Mermaid versionado |

**Estimación:** el RAG completo, las métricas y el esqueleto de tests salen en **un día de trabajo** partiendo de `invoice-system`, contra dos o tres desde cero. Eso libera los días 4–6 para lo que de verdad no tienes hecho: **voz en tiempo real, consola de conocimiento vivo y capa agnóstica de LLM**.

## 16.6 Nota sobre Python vs Node

`invoice-system` es Python. Si eliges Node/TypeScript (§ conversación previa), lo que se transfiere es **el diseño, no el código**: la normalización de scores del híbrido, el RRF con `k=60`, el parser JSON tolerante, el patrón de confianza+HITL, el tracker de uso y toda la documentación son independientes del lenguaje. Lo único que realmente te ata a Python es `sentence-transformers` y el cross-encoder — y ambos corren en Node vía `transformers.js` con los mismos modelos ONNX.

**Decisión pragmática:** si el objetivo es velocidad de entrega en 3 días, **Python te deja copiar y pegar código ya probado**. Si el objetivo es tipos compartidos con el front y un solo lenguaje, Node cuesta un día más de reimplementación. Con el cronograma tan apretado, **la ventaja de reutilizar `invoice-system` tal cual es real y pesa**.
