# Plan 02 — Conocimiento vivo desde la consola

> **Cuándo:** domingo 9, primer bloque · **Presupuesto:** 2 horas
> **Cierra:** **G5** (compuerta eliminatoria) · completa los 20 pts de RAG · cierra el contrato de "consola de administración" que el kit exige
> **Depende de:** plan 01

## Objetivo en una frase

Que subir un documento desde la consola haga que el agente lo use de inmediato, y eliminarlo haga que lo olvide, sin reiniciar nada y sin bloquear la conversación en curso.

## Por qué es el plan más importante de los cuatro

G5 se verifica así, literal del kit: *"Subes un documento desde tu consola de administración y el agente lo usa; lo eliminas y el agente lo olvida. Se verifica con un documento de prueba que no forma parte de ningún corpus entregado."*

Si esto no funciona, **la entrega no se puntúa** — da igual lo bueno que sea el resto. Y el kit exige la consola explícitamente: *"Puedes ofrecer además API, CLI o una carpeta que el sistema vigile, pero la consola es exigida."*

## Alcance

**Dentro:**

- `POST /knowledge/references` — texto crudo pegado y archivos subidos (PDF/MD/TXT/JSON).
- `DELETE /knowledge/references/:id` — borrado suave (`active = false`).
- Incremento atómico de `kb_state.version` en cada alta y cada baja.
- Ingesta en caliente: extraer, fragmentar, escribir `reference_chunks` — el mismo camino del plan 01, ahora disparado por HTTP.
- **Habilitar el ítem `Agregar conocimiento`** del sidenav del médico, hoy deshabilitado con `title="Disponible próximamente"`.
- Consola: subir texto, subir archivo, listar lo cargado, eliminar, e indicación visible de "procesado y disponible".
- Modal `Actualizar conocimiento` en el topbar del paciente (el botón ya está renderizado, hoy sin acción).
- Separador de sistema (`who: 'system'`) insertado en el hilo al completar una actualización.
- Chip `KB vN` reflejando la versión vigente.

**Fuera:**

- Progreso por WebSocket con las 5 etapas de `ingest_jobs`. **Recorte consciente:** con 2 horas, una indicación de estado simple cumple el contrato del kit (*"indicación visible de procesado y disponible"*) igual que una barra de 5 etapas. `ingest_jobs` queda sin usar y se documenta.
- Borrado físico de documentos.
- Versionado por documento con historial.

## Decisiones ya cerradas — no reabrir en Fase 2

- **Borrado suave.** `active = false`. El retrieval del plan 01 ya filtra por `active`, así que **olvidar es instantáneo y sin reindexar** — que es exactamente lo que G5 mide. Además permite volver atrás en la demo.
- **`kb_state` ya está modelado como singleton con `CHECK(id = 1)`** precisamente pensando en incrementos atómicos (decisión de SPEC 02). Incrementar en la misma transacción que el alta o la baja.
- **Las dos superficies apuntan al mismo backend.** El modal del paciente y la vista del médico son dos UIs sobre los mismos dos endpoints. El kit trata ambas como entradas al mismo sistema.
- **`who: 'system'` ya existe en el contrato y en la tabla** desde SPEC 02, modelado de antemano justo para esto. Este plan es quien por fin lo usa.
- **Formato exacto del separador** (DESIGN.md §4.13): `── Base de conocimiento actualizada · <nombre-archivo> · <hora> ──`. No lleva burbuja ni fondo; no es un mensaje del asistente. Se persiste con la transcripción y se ve igual en la vista read-only del médico.
- **`chunks` deja de ser `0`** y refleja los fragmentos reales (ya resuelto en el plan 01).
- **El chat no se bloquea durante la ingesta.** Criterio explícito. La ingesta ocurre en el handler HTTP; el WebSocket de la conversación es independiente y sigue vivo.

## Plan de implementación

1. **Endpoints de escritura.** Extender `knowledge.controller.ts` (hoy solo tiene dos `GET`), `knowledge.service.ts` y `knowledge.repository.ts` con alta y baja. Validación con `ZodValidationPipe` y un schema nuevo en `packages/shared` — recordar `pnpm --filter shared build` después de tocar contratos.
2. **Ingesta en caliente.** Extraer la lógica de fragmentación del script del plan 01 a una función compartida y llamarla desde el servicio. Subida de archivos con el interceptor de Nest.
3. **Versión atómica.** Incremento de `kb_state.version` dentro de la misma transacción que el alta/baja, en el repositorio.
4. **Consola del médico.** Habilitar el ítem del sidenav (`Sidenav.tsx`, hoy `view: null`) y construir la vista: subir texto, subir archivo, listar, eliminar, estado visible. Reutilizar `ReferenceList` y los hooks de TanStack Query que ya existen en `features/medico/api/`.
5. **Modal del paciente.** Cablear el botón `Actualizar conocimiento` de `PacientePage.tsx` al mismo backend. Al completar: insertar el separador de sistema en el hilo y actualizar el chip `KB vN`.
6. **Tests.** Extender `knowledge.service.spec.ts` con alta, baja e incremento de versión.

## Criterios de aceptación — el guion de la demo de G5

Reproducible en una sola sesión, sin reiniciar el contenedor:

- [ ] Preguntar al agente algo cuya respuesta **no** está en el corpus → declara el límite.
- [ ] Subir un documento con esa información desde la consola del médico.
- [ ] La consola muestra el documento en la lista con indicación de procesado y disponible.
- [ ] Volver a preguntar lo mismo → **la respuesta ahora usa el documento nuevo y lo cita**.
- [ ] Eliminar ese documento desde la consola.
- [ ] Preguntar por tercera vez → vuelve a declarar el límite; el documento ya no aparece en las citas.
- [ ] El chip `KB vN` incrementó en cada alta y en cada baja.
- [ ] El separador de sistema aparece en el hilo del paciente y se ve igual en la vista read-only del médico.
- [ ] **El chat no se bloqueó** mientras el documento se procesaba.
- [ ] El ítem `Agregar conocimiento` del sidenav ya no está deshabilitado.
- [ ] `pnpm lint`, `pnpm typecheck` y `pnpm test` en verde.

> Este guion **es** el que hay que grabar para el video del plan 04. Vale la pena ensayarlo una vez al terminar y dejar anotado el documento de prueba que se usó.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| La subida de archivos se lleva el bloque de 2 h | **Empezar por el textarea de texto crudo**, que cierra G5 igual de bien y no necesita interceptor ni parser. Los archivos son el segundo paso, no el primero. |
| Se intenta construir la barra de 5 etapas por WebSocket | Está explícitamente fuera. El contrato del kit pide "indicación visible", no un pipeline animado. |
| Dos UIs (médico y paciente) no caben en 2 h | La del **médico es la exigida** por el kit ("consola de administración"). Si el tiempo aprieta, el modal del paciente se recorta y se documenta. |
| Cambiar contratos y olvidar reconstruir `shared` | `pnpm --filter shared build`, y si los contenedores están arriba, limpiar la caché de Vite (ver `CLAUDE.md`). |
