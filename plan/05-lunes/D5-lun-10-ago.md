# D5 — Lunes 10 de agosto · entrega

> **Objetivo del día:** los 30 puntos de documentación y video, sin tocar una línea de código.

**Regla del día:** el código está congelado desde ayer a las 17:00. Si aparece un bug hoy, se documenta como limitación conocida — no se arregla. Un bug documentado con honestidad cuesta menos puntos que un README a medias o un video sin grabar.

---

## Bloque 1 — Prueba de la compuerta #2 (1h) 🔴 primero que todo

**Esta es la compuerta que más gente falla y la única que se verifica cronómetro en mano.**

Procedimiento, en una máquina o contenedor **sin estado previo**:

1. `git clone` en un directorio limpio
2. `cp .env.example .env` y pegar credenciales
3. `docker compose up`
4. Abrir el navegador y completar una conversación de voz

**Cronometrar desde el paso 1.** Objetivo: menos de 15 minutos, con margen.

Puntos donde se pierde tiempo y hay que verificar:
- [ ] Los modelos de embeddings y reranker están en la imagen, **no se descargan en runtime** (RA.3)
- [ ] `pnpm install` no tarda eternidades — considerar imágenes precompiladas
- [ ] La migración y el seed corren solos al arrancar
- [ ] No hay un paso manual escondido que solo tú conoces
- [ ] Funciona sin `pnpm` instalado en la máquina anfitriona

Si tarda más de 15 minutos: **esto es lo único que se puede tocar hoy**, porque es eliminatorio.

---

## Bloque 2 — README (1h 30min)

Estructura, tomando como plantilla el README de `invoice-system` (que era de calidad de entrega):

1. **Qué es** — el problema y la solución en 5 líneas
2. **Quick start** — clone, env, `docker compose up`, abrir. Nada más
3. **🔴 Cumplimiento del modelo obligatorio** — sección explícita:
   > El 100% de la generación de lenguaje se ejecuta con `<modelo>`. STT, TTS, embeddings y reranking son ASR/encoders, no LLMs, y el reglamento declara libre el stack de voz y RAG. El endpoint `GET /compliance` reporta el modelo configurado y el conteo de llamadas.
4. **🔴 Cómo verificar cada compuerta en 5 minutos** — una sección por compuerta, con pasos numerados. Le facilita la vida al evaluador y evita que falle algo por no encontrar cómo probarlo
5. **Arquitectura** — diagrama + explicación de la capa agnóstica de LLM
6. **Decisiones técnicas** — qué se evaluó, qué se descartó y por qué
7. **Métricas** — latencias P50/P95, tokens, costo por llamada, con números reales
8. **Evaluación del RAG** — resultados del golden dataset
9. **Limitaciones conocidas** — honestidad explícita. Suma credibilidad, no resta
10. **Troubleshooting** — tabla error → solución (el evaluador que se atasca y encuentra su error ahí no te penaliza)

---

## Bloque 3 — Diagramas (45 min)

Dos diagramas Mermaid, versionados en el repo y exportados a PNG para el informe:

**1. Arquitectura de la solución** — front, backend por módulos, capa `LLMPort` con sus drivers, pgvector, proveedores de voz, Delta Share con su doble fuente.

**2. Flujo de decisión del agente** — desde que entra el audio hasta el escalamiento: VAD → STT → normalización de regionalismos → retrieval → reglas determinísticas + LLM → MAX de severidad → respuesta o escalamiento. Debe hacer evidente que **las reglas están por encima del LLM**.

Requisito explícito del reto: son dos cosas distintas y ambas se piden.

---

## Bloque 4 — Informe final (1h 30min)

Sin informe **no se evalúa** la entrega (R0.7). Contenido:

- **Proceso** — cómo se abordó el reto, con la línea de tiempo real de los 5 días
- **Prompts completos** — system prompt, prompts de triage, de resumen, de multi-query. Literales
- **Configuraciones** — parámetros del modelo, del retrieval (`alpha`, `k` de RRF, `top_k`), umbrales del VAD y del triage
- **Capturas** — todas las vistas y estados clave
- **Métricas medidas** — tabla de latencias antes/después de la optimización, tokens y costo por llamada
- **Evaluación del RAG** — tabla del golden dataset con similitud media y casos sobre umbral
- **Decisiones técnicas y alternativas descartadas** — incluida la documentación de los intentos de chunking que no funcionaron
- **Tabla de rúbrica** — una fila por criterio, indicando dónde se cumple y con qué evidencia. Le das al jurado el mapa de su propia evaluación

---

## Bloque 5 — Video (2h)

**Guion escrito antes de grabar.** Dos tomas máximo.

### Parte 1 — Demo (dividida en segmentos)

| Segmento | Duración | Contenido |
|---|---|---|
| Contexto | 30s | Qué es y qué problema resuelve |
| Conversación de voz | 90s | Sesión real: síntoma ambiguo → repregunta de desambiguación → respuesta con citas visibles |
| Regionalismo | 30s | Paciente usa una palabra local, se ve el `↳ normalizado:` en la UI |
| **Conocimiento vivo** | 60s | **El segmento decisivo.** Sin cerrar la sesión: pregunta → sube documento → sigue hablando mientras indexa → separador en el hilo → chip `KB v2` → misma pregunta, respuesta distinta con cita nueva → borra → vuelve atrás |
| Escalamiento | 45s | Bandera roja dispara alerta; aparece en el panel del médico |
| Panel del médico | 45s | Dashboard, conversación read-only, resumen con métricas |
| Agnosticismo | 30s | Mismo agente, dos variables de entorno, otro modelo. Responde la Pregunta 2 y suma en arquitectura |

### Parte 2 — Las dos preguntas, en cámara

**P1 — Pitch comercial.** Estructura: problema con número (una enfermera hace ~20 llamadas de seguimiento al día, la mayoría sin hallazgo accionable) → solución (cobertura del 100% de pacientes en las primeras 72h, la enfermera pasa de operadora a especialista en excepciones) → diferencial (conocimiento vivo sin redeploy, trazabilidad auditable por respuesta, agnosticismo de modelo).

**P2 — Decisión técnica más relevante.** Candidato: pipeline STT→LLM→TTS desacoplado en lugar de speech-to-speech nativo. Alternativas evaluadas y por qué se descartaron (amarra el LLM al vendor de voz, choca con la regla del modelo obligatorio, es caja negra para trazabilidad). Riesgos identificados (latencia acumulada) y su mitigación (streaming por frase, frases de relleno). Con dos semanas más: eval automatizado más amplio del RAG clínico, detección de turno semántica, A/B de voces.

Grabar con buena luz y buen audio. **Cara visible** en la parte 2 — es requisito explícito.

---

## Bloque 6 — Verificación final y entrega (45 min)

### Checklist de las 5 compuertas

- [ ] **#1** Los 4 entregables completos: repo, diagrama, informe, video
- [ ] **#2** Corre en ≤15 minutos siguiendo el README — **cronometrado hoy**
- [ ] **#3** Modelo obligatorio usado exclusivamente — verificado con `GET /compliance`
- [ ] **#4** Conversación de voz en tiempo real funciona
- [ ] **#5** Subir y eliminar conocimiento funciona, con el agente aprendiendo y olvidando

### Higiene de código — auditoría de endpoints sin consumidor

Registrado desde SPEC 03 (2026-08-06). Barrer los endpoints de `apps/api` y contrastarlos con lo que el front realmente llama; los que sigan sin consumidor se eliminan antes de entregar.

- [ ] Listar todas las rutas del backend: `grep -rn "@Get\|@Post\|@Patch\|@Delete" apps/api/src/modules`
- [ ] Para cada una, buscar su consumidor en `apps/web/src`. Sin consumidor = candidata a borrar
- [ ] **Caso conocido:** `GET /patients/priority/:id`. SPEC 03 decidió pintar el detalle del paciente prioritario con el objeto que ya trae el listado, así que quedó sin uso. Verificar si SPEC 05 lo consumió al escalar un paciente desde una sesión de voz; si no, eliminar controlador, servicio y método de repositorio
- [ ] Borrar también su test si el service tenía uno específico
- [ ] `pnpm lint`, `pnpm typecheck` y `pnpm test` pasan después del barrido
- [ ] Actualizar la tabla de endpoints del `README.md` si se eliminó alguno

### Seguridad del repositorio

- [ ] `LICENSE` MIT en la raíz
- [ ] Repositorio **público**
- [ ] `git ls-files` revisado: sin `.env`, sin claves, sin datos de pacientes reales
- [ ] Búsqueda de secretos en el **historial completo**, no solo en el último commit
- [ ] Sin dependencias GPL/AGPL (contaminan MIT y activan R1.7)

### Entrega

- [ ] Enviar por el canal indicado en la ficha técnica
- [ ] **Con margen de horas, no de minutos**
- [ ] Guardar copia local de todo lo enviado

---

## Alcance

**Dentro:** documentación, diagramas, informe, video, verificación, entrega.

**Fuera:** absolutamente todo el código, con una única excepción — si la prueba cronometrada falla la compuerta #2, eso sí se arregla, porque es eliminatorio.

---

## Riesgos

| Riesgo | Mitigación |
|---|---|
| La prueba de 15 minutos falla | Por eso es el bloque 1 y no el último. Queda el día entero para resolverlo |
| El video sale largo o confuso | Guion escrito antes de grabar. Segmentos cronometrados. Dos tomas máximo |
| Aparece la tentación de arreglar un bug | Se documenta en "Limitaciones conocidas". Un bug honesto cuesta menos que un entregable incompleto |
| Se acaba el tiempo en el informe | Empezado ayer en la noche. Hoy solo se completa |
| Problemas al subir el video | Verificar formato y tamaño temprano. Tener un plan B de alojamiento |

---

## Después de entregar

- Anotar qué se aprendió, para la sustentación del **5 de septiembre** ante el panel
- Preparar la presentación en vivo: es la misma demo, pero con preguntas del jurado en tiempo real
- Descansar
