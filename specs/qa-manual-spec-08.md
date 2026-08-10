# QA manual — SPEC 08 (conocimiento vivo y escalamiento)

Checklist para que revises tú mismo, a mano, lo que ya validé por automatización (claude-in-chrome) contra el stack en Docker. Cada bloque indica el resultado que obtuve y qué corregí en el camino, para que sepas qué esperar y dónde poner más atención.

## Setup

1. `docker compose down -v && docker compose up` desde raíz del repo. Confirmar `web` y `api` healthy.
2. Abrir `http://localhost:5173/medico` en una pestaña, `http://localhost:5173/paciente` en otra.
3. Documento de prueba sugerido (no pertenece al corpus sembrado): nombre `qa-hielo-protocol.md`, texto:
   > Protocolo QA: tras la cirugía de rodilla, aplicar hielo local 20 minutos cada 4 horas durante las primeras 72 horas. Evitar apoyar peso completo hasta el control médico.

---

## 1. Pre-sesión y saludo (recién corregido, valida con cuidado)

- [ ] `/paciente` sin sesión activa pide nombre completo, procedimiento, correo y teléfono — los 4 obligatorios.
- [ ] Correo mal formado (`sin-arroba`) → el navegador bloquea el envío con su validación nativa (tooltip HTML5), no se crea sesión.
- [ ] Teléfono de 3 dígitos → error inline "String must contain at least 7 character(s)", no crea sesión.
- [ ] Completar los 4 campos válidos → sesión creada.
- [ ] **NUEVO** — el saludo inicial del agente ya NO vuelve a pedir nombre ni procedimiento (antes lo hacía, era redundante con el formulario). Debe saludar por el nombre de pila y preguntar directo "¿en qué puedo ayudarte hoy?". Si ves que vuelve a pedir nombre/procedimiento, el fix no tomó — avísame.

## 2. Guion G5 (compuerta eliminatoria — RAG)

- [ ] En `/paciente`, preguntar algo sobre "hielo después de cirugía de rodilla" sin haber subido nada → el agente declara el límite ("No tengo información confirmada sobre eso en tu caso. ¿Quieres que ponga tu pregunta en conocimiento de tu médico?"), no inventa.
- [ ] En `/medico` → sidenav → **Agregar conocimiento**. Pestaña **Subidos** activa por defecto. Pegar el texto de prueba, subir.
- [ ] Chip de progreso inline termina en "Procesado y disponible" en segundos.
- [ ] Volver a `/paciente`, repetir la pregunta → la respuesta ahora SÍ usa el documento nuevo, con precisión (menciona 20 min cada 4 horas, 72 horas), y aparece el chip de cita `qa-hielo-protocol.md` como primero de la lista.
- [ ] En `/medico`, click "Deshabilitar" sobre el documento. En `/paciente`, preguntar de nuevo → vuelve a declarar el límite, sin citar ese documento.
- [ ] "Rehabilitar" en `/medico` → en `/paciente` vuelve a citarlo, sin recargar nada.

**Qué corregí acá:** el ranking de búsqueda (`ts_rank`) favorecía documentos largos del corpus base que solo compartían una palabra suelta con la pregunta (ej. citaba un PDF de "reemplazo de cadera" para una pregunta sobre hielo en rodilla). Agregué normalización por longitud de chunk — ahora el documento correcto y específico gana.

## 3. Versión y separador de KB

- [ ] Antes de subir: anotar el chip `KB vN` en `/paciente` (topbar).
- [ ] Al completar la ingesta, el chip incrementa en vivo, sin recargar.
- [ ] Abrir una segunda pestaña de `/paciente` con la misma sesión (recargar `/paciente` en el mismo navegador basta, la sesión se recupera sola — ver bloque 6) antes de subir un segundo documento → el separador "Base de conocimiento actualizada" aparece en ambas pestañas tras la ingesta.
- [ ] En `/medico` → Dashboard → detalle de esa sesión → el separador se ve igual, sin burbuja, línea centrada.

**Qué corregí acá:** una segunda pestaña de la misma sesión nunca recibía estos avisos en vivo — el socket solo se registraba en el backend si esa pestaña había mandado un mensaje. Ahora se registra igual aunque solo esté mirando.

## 4. Consola del médico

- [ ] Pestaña **Base** lista el corpus sembrado; pestaña **Subidos** solo lo cargado desde la consola.
- [ ] Subir un PDF (5-10 MB) y recargar la consola (F5) mientras corre → el documento sigue procesándose y termina apareciendo correctamente en la lista tras el reload (no verifiqué visualmente la barra de progreso a mitad de camino porque el procesamiento es muy rápido en este entorno — si te da tiempo de capturarlo, mejor).
- [ ] Subir un archivo `.exe` → error inmediato ("No fue posible iniciar la ingesta"), no aparece en la lista.

## 5. Escalamiento — **presta atención especial acá, es el hallazgo más importante**

- [ ] Sesión nueva, escribir "Tengo sangrado muy fuerte por la herida de la cirugía" → debería aparecer la modal de cuenta regresiva de 10s: *"Terminando sesión. Tu caso será consultado con un médico. Mantente pendiente de tu correo y de tu teléfono."*
- [ ] La marca `[[ESCALAR]]` nunca debe ser visible en la burbuja del asistente.
- [ ] Dejar expirar → "Sesión finalizada", caso aparece en `/medico` → Pacientes con atención personalizada, `requestedBy = Agente de voz`.

**⚠️ Esto no siempre funciona.** Reforcé el prompt dos veces (di prioridad explícita a la regla de escalamiento y la repetí al final del prompt), pero el modelo (`llama-3.3-70b-versatile`) sigue fallando de forma intermitente — a veces el mismo texto exacto escala una vez y otra no. Fallé consistentemente con "fiebre muy alta y me cuesta respirar" a pesar de que el prompt lo lista explícitamente como bandera roja. Prueba varias veces con distintos síntomas (sangrado, dolor severo, fiebre, dificultad para respirar, "quiero hablar con un médico humano") y anota la tasa de éxito real que ves — esto es información valiosa para decidir si hace falta una detección de palabras clave en el backend como respaldo, en vez de confiar 100% en que el LLM emita la marca.

- [ ] Repetir el disparo en sesión nueva, click **Cancelar** antes de que expire (el countdown es rápido, ~10s desde que aparece la modal — tenlo a mano).
- [ ] La conversación sigue, acepta mensajes nuevos.
- [ ] El caso ya aparece en `/medico` aunque la conversación siga viva.
- [ ] Pedir explícitamente "quiero hablar con un médico humano" (sin síntoma clínico) → misma modal.

## 6. Cierre y recuperación de sesión

- [ ] **NUEVO** — Cerrar la pestaña de `/paciente` a mitad de conversación (o simplemente recargar con F5) sin usar "Terminar conversación", y volver a abrir `/paciente` → la conversación se recupera con todo su historial, no aparece el formulario de nuevo. (Antes esto NO funcionaba — cualquier F5 perdía la sesión completa. Corregido con persistencia en `localStorage`.)
- [ ] Usar "Terminar conversación" → sesión cerrada, no acepta más mensajes si se reintenta enviar.
- [ ] En `/medico`, la sesión cerrada muestra su resumen de una línea.

## 7. Citas

- [ ] Un turno con material citado muestra chips pequeños bajo la burbuja, no dentro.
- [ ] Click en un chip → modal con fragmento exacto, nombre del documento, versión del documento y versión de KB del turno.
- [ ] Un turno sin citas (el saludo inicial) no muestra chips.
- [ ] En `/medico` → `SessionDetail` de una sesión con citas → mismos chips bajo las burbujas del asistente.

**Nota menor sin corregir:** a veces el turno muestra chips de citas que en realidad el texto de la respuesta no usó (por ejemplo, cuando el agente declara el límite pero igual quedan pegadas citas del intento de búsqueda). No es grave, pero puede confundir al médico revisando sesiones — avísame si te resulta molesto y lo priosquemos.

## 8. Visual / responsive / tema

- [ ] Sidenav de `/medico` en viewport angosto (~375px, herramientas de dev del navegador) sigue usable, "Agregar conocimiento" no se corta (revisé el código — usa scroll horizontal con `overflow-x-auto`, debería andar bien, pero no lo verifiqué en vivo por una limitación de mi herramienta de automatización).
- [ ] Modal de "Actualizar conocimiento" en `/paciente` usable en móvil.
- [ ] Tema oscuro (toggle en topbar): separador de sistema, chip `KB vN` y chips de cita legibles — esto sí lo verifiqué en vivo y se ve bien.

---

## Registro de resultados

Por ítem: ✅ pasa / ❌ falla (nota corta) / ⚠️ no aplica. Lo más importante es que midas la tasa real de éxito del bloque 5 (escalamiento) — es el dato que más nos falta.
