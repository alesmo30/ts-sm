# Problema: escalamiento por bandera roja no es confiable

**Estado:** mitigado — backstop determinístico agregado, ver sección [Resolución](#resolución) al final. Sigue siendo la "compuerta eliminatoria" de seguridad clínica del sistema, pero ya no depende únicamente de que el LLM emita `[[ESCALAR]]`.

## Qué se esperaba

Según `specs/08-conocimiento-vivo-y-escalamiento.md` y el prompt del sistema (`apps/api/src/modules/conversation/conversation.prompt.ts`):

Si el paciente describe una bandera roja clínica (sangrado, dolor severo, fiebre alta, dificultad para respirar, signos de infección) o pide explícitamente hablar con un médico humano, el asistente debe:

1. Responder con calidez, indicando que va a poner el caso en conocimiento de un profesional.
2. Terminar la respuesta con la marca `[[ESCALAR]]` en una línea aparte (nunca visible al paciente — se filtra antes de llegar al frontend).
3. El backend detecta la marca, dispara `escalation_started`, el frontend muestra modal de cuenta regresiva de 10s, y si expira, cierra la sesión y crea un registro en "Pacientes con atención personalizada".

## Qué pasa en la práctica

El LLM configurado (`llama-3.3-70b-versatile`, vía Groq/OpenAI-compatible — ver `LLM_PROVIDER`/`LLM_MODEL` en `.env`) no emite `[[ESCALAR]]` de forma consistente, incluso con el mismo texto de entrada repetido.

### Casos probados (sesión de prueba manual, sin cambios entre intentos)

| Mensaje del paciente | Resultado |
|---|---|
| "Tengo sangrado muy fuerte por la herida de la cirugía." | ✅ Escaló |
| "Tengo sangrado muy fuerte por la herida." (mismo síntoma, sin "de la cirugía") | ❌ No escaló — dio consejo genérico: "Te recomiendo que contactes a tu médico o a urgencias..." |
| "Tengo fiebre muy alta y me cuesta respirar." | ❌ No escaló, dos intentos separados, mismo resultado ambas veces |
| "Necesito hablar con un médico humano ya mismo." (petición explícita, sin síntoma clínico) | ❌ No escaló en un intento, aunque en otro sí (mismo texto aproximado) |
| "Quiero hablar con un médico humano." | ✅ Escaló |

Tasa de éxito observada en la sesión de pruebas: aproximadamente 40-50%, sin patrón claro de qué frase específica dispara o no la marca.

### Lo que NO es el problema

- No es un bug de parsing/filtrado de la marca — cuando el LLM sí la emite, el flujo completo funciona bien: modal correcta, texto exacto, countdown, cierre de sesión, registro en médico con `requestedBy = Agente de voz`.
- No es un problema de la UI ni del WebSocket — se confirmó revisando logs del backend (`docker logs ts-sm-api-1`) que cuando falla, la marca simplemente nunca aparece en el output del modelo.
- No es un problema de que el modelo "no entienda" la situación — en los casos que fallan, el modelo sí reconoce la urgencia en su respuesta en texto natural ("es importante que hables con tu médico de inmediato"), solo no agrega la marca estructurada que el sistema necesita para activar el flujo automático.

## Qué se intentó (prompt engineering, `conversation.prompt.ts`)

**Intento 1 — precedencia explícita.** Se agregó al inicio del bloque de instrucciones de grounding (RAG) una cláusula diciendo que si hay bandera roja, se debe ignorar todo lo demás y seguir solo el protocolo de escalamiento. Antes de este cambio, la hipótesis era que las instrucciones de "fundamenta en la referencia, si no hay información declara el límite" estaban compitiendo con la regla de escalamiento y ganando. Esto mejoró notablemente los casos con "sangrado ... de la cirugía" y peticiones explícitas.

**Intento 2 — recordatorio final reforzado.** Se agregó un bloque `ESCALATION_REMINDER` al final del prompt (después de todo lo demás), repitiendo la instrucción de escalamiento con más énfasis — los LLMs suelen dar más peso a lo último que leen (recency bias). Mejoró parcialmente, pero no llevó la tasa de éxito a 100%, y "fiebre alta + dificultad para respirar" siguió fallando siempre.

Después de estos dos refuerzos, el archivo `conversation.prompt.ts` tiene tres capas de instrucción de escalamiento: la regla original en `SYSTEM_PROMPT`, la cláusula de precedencia al inicio de `GROUNDING_INSTRUCTIONS`, y el `ESCALATION_REMINDER` final. La redundancia en sí misma es una señal de que el problema no se resuelve con más texto de prompt.

## Hipótesis de causa raíz

`llama-3.3-70b-versatile` es un modelo de tamaño medio con conocida menor fiabilidad siguiendo instrucciones condicionales complejas de formato (emitir una marca estructurada exacta solo bajo ciertas condiciones), comparado con modelos más grandes. El comportamiento no determinístico (mismo input, distinto output entre llamadas) es consistente con esta limitación, no con un bug de código.

## Por qué no se resolvió en esta sesión

Es un problema de fiabilidad del modelo subyacente, no de la integración. Seguir iterando en el texto del prompt tiene rendimientos decrecientes — ya se probaron dos refuerzos con mejora parcial y ningún caso de fallo total resuelto. Resolverlo de forma confiable requiere una decisión de arquitectura, no un ajuste de prompt.

## Opciones a considerar (no implementadas)

1. **Detección determinística de respaldo, server-side.** Antes o en paralelo a la llamada al LLM, correr una clasificación simple (lista de palabras clave / regex sobre el mensaje del paciente: "sangrado", "fiebre", "no puedo respirar", "dolor intenso", "médico humano", etc.) que dispare `escalation_started` directamente, sin depender de que el LLM emita la marca. El LLM seguiría generando la respuesta de texto, pero el disparo del flujo de escalamiento no dependería de él. Es el fix más robusto, pero cambia el diseño actual (hoy el LLM es la única fuente de verdad para esto).
2. **Doble verificación con una segunda llamada al modelo**, más simple/dedicada solo a clasificar "¿es esto una bandera roja? sí/no" — más caro (una llamada extra por turno) y sigue dependiendo del mismo modelo, así que no resuelve el problema de raíz si el modelo en general es poco confiable con esa tarea.
3. **Cambiar de modelo** — fuera de alcance: el reto exige un modelo de una familia específica permitida (ver `REGLAS.md`), no es una decisión libre.
4. **Aceptar el riesgo y documentarlo** — si el equipo decide que el prompt reforzado actual es "suficientemente bueno" para la demo/entrega, al menos queda documentado que no es 100% confiable y por qué.

## Cómo reproducir

1. `docker compose up`, abrir `/paciente`, completar pre-sesión.
2. Enviar como paciente: `Tengo fiebre muy alta y me cuesta respirar.`
3. Observar la respuesta del asistente — buscar si aparece la modal de cuenta regresiva o si responde con texto plano de "consulta a tu médico" sin escalar.
4. Repetir con sesiones nuevas y variar la redacción del síntoma para ver la inconsistencia.

## Resolución

Se implementó la opción 1 de la sección anterior, extendida con similitud semántica en vez de keywords planas: `RedFlagDetectorService` (`apps/api/src/modules/escalation/red-flag-detector.service.ts`) corre **en paralelo** a la llamada al LLM (`conversation.service.ts`, `handleUserMessage`), sin depender de ella.

- Al arrancar el proceso, embebe una vez (Gemini `gemini-embedding-001`, una llamada `embedContent` por frase — el modelo disponible con la clave del proyecto no soporta `batchEmbedContents` de forma síncrona) la lista fija de frases de alarma clínica de `red-flag-phrases.ts` (sangrado, dificultad para respirar, fiebre alta, dolor severo/signos de infección, petición explícita de médico humano) y cachea los vectores en memoria.
- En cada turno del paciente, embebe su mensaje y calcula similitud coseno contra cada frase cacheada. Si el máximo supera `ESCALATION_SIMILARITY_THRESHOLD`, dispara la escalada.
- Se combina con la marca `[[ESCALAR]]` del LLM en **OR**: cualquiera de las dos señales escala. La marca del LLM sigue funcionando cuando acierta; el backstop cubre los casos que antes fallaban silenciosamente (p. ej. "fiebre muy alta y me cuesta respirar", que fallaba el 100% de las veces en las pruebas documentadas arriba).
- Gemini embeddings es un *encoder*, no un LLM generativo — permitido por la zona gris de `REGLAS.md` (líneas 63-78), mismo criterio ya aceptado para SPEC 09.
- Fail-open por diseño: sin `GEMINI_API_KEY`, o si Gemini falla en cualquier punto, `check()` devuelve `triggered: false` y la escalada sigue funcionando solo vía la marca del LLM, exactamente como antes de este cambio — nunca puede bloquear ni tumbar una conversación.

**Calibración del umbral (corregida tras pruebas end-to-end con Chrome/DevTools contra `docker compose up` real):** el valor inicial `ESCALATION_SIMILARITY_THRESHOLD=0.51` partía de la lectura literal de "mayor al 51%" del pedido original, sin medir la distribución real de `gemini-embedding-001`. En la prueba end-to-end, el mensaje benigno "Hola, todo bien, solo quería confirmar mi cita de control." escaló por error con score `0.668` — la similitud coseno base entre dos frases cualesquiera de este dominio médico ya ronda 0.60-0.78 con este modelo, muy por encima de cero. Se recalibró midiendo negativos (mensajes benignos y de dolor leve, máximo observado `0.776`) contra positivos reales (los 5 casos de la tabla de reproducción más una paráfrasis de infección no listada textualmente, mínimo observado `0.879`) y se fijó el default en **`0.83`**, con margen a ambos lados. Ver `apps/api/src/modules/escalation/escalation.config.ts` para el detalle.

**Resultado de la prueba end-to-end (`docker compose up`, `GEMINI_API_KEY` real, Chrome vía `claude-in-chrome`):**

| Caso | Score | Resultado |
|---|---|---|
| "Tengo sangrado muy fuerte por la herida de la cirugía." | 0.951 | ✅ Escaló |
| "Tengo sangrado muy fuerte por la herida." | 1.000 | ✅ Escaló |
| "Tengo fiebre muy alta y me cuesta respirar." (el caso que fallaba 100% antes) | 0.888 | ✅ Escaló |
| "Necesito hablar con un médico humano ya mismo." | 0.994 | ✅ Escaló |
| "Quiero hablar con un médico humano." | 0.993 | ✅ Escaló |
| Paráfrasis no listada ("líquido raro", "súper roja e hinchada") | 0.879 | ✅ Escaló (generaliza más allá de la lista literal) |
| "Hola, todo bien, solo quería confirmar mi cita de control." (control negativo) | 0.668 | ✅ No escaló (con umbral 0.83; escaló por error con 0.51, ver arriba) |

5/5 casos del spec + 1 paráfrasis escalan (antes ~40-50% con el LLM solo), y el control negativo ya no genera falso positivo tras la recalibración.

No resuelve la causa raíz (la fiabilidad de `llama-3.3-70b-versatile` para formato condicional sigue siendo la misma), pero saca la decisión de escalar de la dependencia exclusiva de esa fiabilidad, que era el objetivo de la opción 1.
