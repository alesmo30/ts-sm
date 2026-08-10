# D4 — Domingo 9 de agosto · día completo

> **Objetivo del día:** subir la calidad percibida de la conversación y **congelar el código a las 17:00**.

**La regla más importante de todo el sprint está en este día.** A las 17:00 se congela. Lo que no esté hecho, no entra. Los 30 puntos de documentación y video se pierden por codear hasta el último minuto, y son los más baratos del puntaje.

---

## Bloque mañana (4h) — Manos libres

### M1 · VAD y detección de turno (1h 30min)

- **Silero VAD** vía `onnxruntime-node` (o en el navegador con `onnxruntime-web`, que baja latencia al eliminar un salto de red).
- Detección de fin de turno con objetivo de **250–400ms**. Aquí está el mayor ahorro de latencia percibida: nada de esperar un segundo fijo de silencio.
- Calibración de umbrales con audio real, incluyendo ruido de fondo.
- Manejo de silencios largos: si el paciente no responde en X segundos, el agente repregunta con suavidad.

### M2 · Barge-in (45 min)

Si el VAD detecta voz mientras el TTS está sonando, **el audio se corta al instante**. Esto sube mucho la percepción de calidad y es de los detalles que separan un demo bueno de uno excelente.

- Cancelación del stream de audio en curso.
- Cancelación de la generación del LLM si aún está en vuelo (ahorra tokens).
- El turno interrumpido se marca en la transcripción.

### M3 · Toggle de modo en la UI (45 min)

- Switch `Push-to-talk | Manos libres` en el composer.
- **Push-to-talk sigue siendo el default** y siempre está disponible. Manos libres es opt-in.
- Estados visuales claros: en manos libres el botón muestra `● Sesión activa — escuchando`.
- Si el VAD falla o el ruido ambiente es alto, degradar automáticamente a push-to-talk con un aviso.

> Esta degradación automática es un seguro para el demo en vivo del 5 de septiembre.

### M4 · Optimización de latencia (1h)

Objetivo: **por debajo de 1.5s percibidos** de extremo a extremo.

| Técnica | Ganancia |
|---|---|
| **Speculative retrieval** — disparar el retrieval con la transcripción parcial, antes de que el paciente termine | 100–200ms |
| **Frase de relleno** — TTS pregrabado de "Ajá, entiendo…" mientras llega el primer token | Enmascara ~500ms |
| **Prompt caching** del system prompt + protocolo clínico | Latencia y costo |
| **Primera frase corta** — instruir al modelo a abrir siempre con una oración breve | El TTS arranca antes |
| **Streaming por frase** — no esperar la respuesta completa para sintetizar | 300–800ms |
| Precalentar el índice y los modelos al arrancar | Elimina el penalti del primer turno |

Medir P50 y P95 antes y después, y guardar la tabla comparativa **para el informe**.

---

## Bloque mediodía (2h) — Robustez y extra

### T1 · Fallbacks probados de verdad (45 min)

No basta con que existan: hay que **provocar el fallo y verificar**.

- Cortar la red hacia Deepgram → ¿arranca Web Speech API sin perder la sesión?
- Cortar Azure TTS → ¿cae a `speechSynthesis` del navegador?
- Matar el contenedor de la DB a mitad de sesión → ¿degrada con mensaje claro?
- Timeout del LLM → ¿escala a humano en vez de colgarse (RC.6)?
- Denegar permiso de micrófono → ¿el modo texto sigue plenamente usable (R0.4)?

### T2 · Botón "repetir última pregunta" (30 min) — extra sacrificable

Reejecuta el turno anterior contra el KB actualizado y muestra ambas respuestas con sus citas distintas, lado a lado. Es la compuerta #5 demostrada de forma irrefutable en una sola pantalla.

**Es lo primero que se sacrifica si el reloj aprieta.**

### T3 · Pulido visual (45 min)

Recorrer el checklist de fidelidad de `DESIGN.md`:
- Los 9 viewports de la matriz, sin scroll horizontal
- Estados de carga, vacío y error en todas las vistas
- Foco visible en todos los controles
- `prefers-reduced-motion` respetado
- Transiciones y radios coherentes con los tokens

---

## Bloque tarde (2h, hasta las 17:00) — Evidencia cuantitativa

### T4 · Golden dataset clínico (1h)

Esqueleto portado de `invoice-system/tests/rag/`. Es el diferenciador que casi nadie va a llevar.

- 30–50 preguntas clínicas con su respuesta de referencia, derivadas del dataset real.
- Test parametrizado que corre el RAG real y mide **similitud coseno** contra la referencia.
- Umbral configurable por env var, con reporte acumulativo.
- Gate por variable de entorno para que no rompa nada si faltan credenciales.

**Salida esperada para el informe:** *"47 preguntas clínicas golden, similitud coseno media 0.81, 44/47 sobre el umbral de 0.72"*. Eso es evidencia cuantitativa de precisión clínica. La mayoría entregará "funciona bien" sin un solo número.

### T5 · Tests de compuerta automatizados (45 min)

- **Conocimiento vivo:** indexar A → preguntar → borrar A → indexar B → misma pregunta → verificar que la respuesta y la cita cambiaron. Automatiza la compuerta #5.
- **Trazabilidad:** la cita devuelta corresponde al documento que realmente contiene la respuesta.
- **Triage:** batería de casos con banderas rojas que deben escalar sí o sí.
- **Cumplimiento:** ninguna llamada usó un modelo distinto al obligatorio (R0.1).

### 🔴 17:00 — CONGELAMIENTO DE CÓDIGO

A partir de esta hora: **solo documentación**. Nada de "un último arreglito".

Antes de congelar:
1. Commit y push de todo.
2. Tag `v1.0-freeze`.
3. Verificar que `docker compose up` sigue funcionando desde limpio.

---

## Bloque noche (2h) — Arranque de la documentación

Adelantar lo que se pueda de D5 con el sistema fresco en la cabeza:

- Capturas de pantalla de todas las vistas y estados
- Grabación de la demo killer en buena calidad
- Esqueleto del README con la estructura definitiva
- Diagramas Mermaid: arquitectura + flujo de decisión
- Guion escrito de las dos preguntas de cierre

---

## Alcance

**Dentro:** VAD, barge-in, latencia, fallbacks probados, golden dataset, tests de compuerta, pulido visual.

**Fuera:**
- Features nuevas de cualquier tipo
- Refactors "para que quede más limpio"
- Cualquier cosa después de las 17:00 que no sea documentación

---

## Criterios de aceptación

- [ ] Conversación en manos libres fluida, por debajo de 1.5s percibidos
- [ ] Hablar encima del agente lo calla al instante (barge-in)
- [ ] Push-to-talk sigue funcionando como default y como respaldo
- [ ] Degradación automática a push-to-talk si el VAD falla
- [ ] Los 5 fallbacks provocados y verificados uno por uno
- [ ] Tabla de latencias P50/P95 antes/después, lista para el informe
- [ ] Golden dataset con resultados y umbral, lista para el informe
- [ ] El test automatizado de conocimiento vivo pasa
- [ ] Los 9 viewports sin scroll horizontal
- [ ] **Código congelado a las 17:00, con tag y push**

---

## Riesgos

| Riesgo | Mitigación |
|---|---|
| El VAD se calibra mal y rompe la conversación | Push-to-talk es el default. Manos libres es opt-in y degrada solo. **Nunca se entrega solo manos libres** |
| Optimizar latencia introduce bugs nuevos | Medir antes de cada cambio, revertir lo que no dé ganancia clara. Es domingo: no es día de riesgo |
| **Se ignora el congelamiento de las 17:00** | **Alta.** Es la trampa clásica. Poner una alarma. Los 30 puntos de D5 valen el doble que el arreglito pendiente |
| El golden dataset consume mucho presupuesto de LLM | Correrlo una vez completo, y luego sobre un subconjunto |

---

## Addendum — SPEC 08 (conocimiento vivo y escalamiento)

Implementada en la rama `spec-08-conocimiento-vivo-y-escalamiento`, en paralelo a este día de pulido de voz.

**Fricción encontrada, no amerita reabrir el spec:**
- `multer` es dependencia transitiva de `@nestjs/platform-express` (vía `FileInterceptor`), pero pnpm en modo estricto no expone transitivas en el `node_modules` de `apps/api`. La imagen de `api` en Docker fallaba con `Cannot find module 'multer'` al arrancar. Fix: `multer` se agregó como dependencia directa de `apps/api/package.json`, no solo `@types/multer` como dev.

**Documento de prueba usado para el guion de G5** (subir → citar → deshabilitar → declarar límite → rehabilitar → citar de nuevo), reproducible desde cero con `docker compose down -v && docker compose up`:
- Nombre: `protocolo-docker-test.md`, texto pegado (no archivo): *"Protocolo docker test: el paciente debe aplicar hielo local 20 minutos cada 4 horas durante las primeras 48 horas."* No pertenece a ningún corpus entregado.
- Arranque limpio medido: ~3 minutos hasta `api` y `web` healthy con el corpus de 107 documentos cargado — muy por debajo de los 15 minutos de G2.
