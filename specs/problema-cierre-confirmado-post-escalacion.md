# Problema: confirmar "cerremos ya" tras una escalada no cerraba la sesión

**Estado:** resuelto — ver [Resolución](#resolución) al final.

## Qué se esperaba

Tras una escalada (`[[ESCALAR]]`), el prompt del sistema (`apps/api/src/modules/conversation/conversation.prompt.ts`) instruye al asistente a preguntar explícitamente: *"¿Quieres comentarme algo más antes de cerrar, o prefieres cerrar ya?"* Si el paciente responde que prefiere cerrar, se esperaría que la sesión quedara cerrada de verdad — mismo resultado que si hubiera usado el botón "Terminar conversación" o dejado expirar la cuenta regresiva de la modal de escalada.

## Qué pasaba en la práctica

Reportado en QA manual sobre una sesión real ("Megan Fox"): tras la escalada, el paciente respondió por texto "cerremos ya" (el caso reportado fue por voz — Deepgram no transcribió nada, un problema aparte de captura de audio — pero el mismo texto escrito reproduce el bug de forma determinística). El mensaje se guardaba (`turn_saved` llegaba al cliente), pero no pasaba nada más: sin respuesta del asistente, sin cierre de sesión, la conversación quedaba colgada con una burbuja sin resolver.

Causa: no existía ningún mecanismo que detectara esa confirmación. `handleUserMessageInner` (`conversation.service.ts`) trataba "cerremos ya" como un mensaje cualquiera — lo mandaba al flujo normal de retrieval + LLM streaming, que generaba una respuesta más (probablemente relacionada con el guion clínico, no con cerrar), sin ninguna rama que reconociera la intención de cierre.

El único precedente de "detectar una confirmación corta del turno anterior" era `pendingKnowledgeGapBySession`/`isShortAffirmative` — pero ese mecanismo es para consentir ser *redirigido al médico* (un "sí" tras "¿quieres que avise a tu médico?"), un caso distinto y anterior en la conversación. No cubría la confirmación de cierre posterior a la escalada.

## Por qué no se reutilizó `isShortAffirmative`/`AFFIRMATIVE_TOKENS`

La pregunta que hace el prompt tras escalar es **disyuntiva**: "¿quieres comentarme algo más, o prefieres cerrar ya?". Un "sí" corto ahí es genuinamente ambiguo entre las dos opciones — a diferencia de la pregunta de sí/no simple que sí cubre `isShortAffirmative`. Reutilizar ese vocabulario habría cerrado sesiones por error cada vez que el paciente dijera "sí" para decir "sí, quiero comentar algo más".

## Resolución

Vocabulario cerrado nuevo, mismo criterio de diseño que `FAREWELL_PHRASES` (sin LLM ni embeddings extra para clasificar esto — REGLAS.md prohíbe una segunda llamada generativa solo para esto):

- `CLOSE_CONFIRMATION_PHRASES` (`conversation.service.ts`): frases explícitas de cierre — "cerremos ya", "cierra la sesión", "prefiero cerrar", etc. No incluye afirmaciones ambiguas como "sí" solo.
- `pendingCloseConfirmationBySession: Map<string, boolean>`: se marca `true` en **todo** turno donde el asistente terminó en `[[ESCALAR]]` (`streamResult.escalated`) — no solo la primera escalada, porque el prompt repite la pregunta de cierre en cada turno posterior mientras la sesión sigue escalada.
- En `handleUserMessageInner`, justo después de guardar el turno del paciente y antes de tocar retrieval/triage/LLM: si el cierre estaba ofrecido y el texto confirma cierre, se llama `this.closeSession(sessionId)` directamente (mismo método que usa el endpoint `POST /sessions/:id/close`) y se corta el flujo ahí — nunca pasa por el LLM, nunca genera un turno de asistente nuevo.
- Evento WS nuevo, `session_closed` (`packages/shared/src/contracts/conversation.contract.ts`), con la `Session` ya cerrada — el frontend (`useConversation.ts`, `PacientePage.tsx`) lo trata igual que el desenlace de la cuenta regresiva expirada: pantalla de "Sesión finalizada", sin volver a llamar `POST /close` (ya se cerró server-side).
- Dashboard de control y Atención prioritaria no necesitaron cambios — ya pollean (`usePriorityPatients` cada 15s) y leen el estado real de la sesión; una vez que `closeSession()` corre de verdad, se actualizan solos.

**Verificado end-to-end** (`docker compose up --build`, WebSocket real): sesión con bandera roja ("Tengo sangrado muy fuerte...") escala correctamente, "cerremos ya" en el turno siguiente cierra la sesión (`status: fail`, `closedAt` seteado, resumen generado por el LLM, sin ningún turno de asistente nuevo ni delta de streaming), y el registro en `GET /patients/priority` refleja `outcome: "Escalada aceptada: la sesión se cerró y el caso quedó en manos del médico."`.

## Fuera de alcance de este fix

- **Deepgram no transcribiendo nada** en el caso original reportado por voz — es un problema de captura/STT, no de este flujo de confirmación. No se investigó acá.
- **La modal de cuenta regresiva no se deshabilita** mientras el paciente puede seguir escribiendo — comportamiento preexistente, sin relación con este bug (de hecho es lo que permite que "cerremos ya" por texto funcione en paralelo a la modal).
