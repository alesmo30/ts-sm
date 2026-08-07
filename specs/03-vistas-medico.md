# SPEC 03 — Vistas del médico: dashboard, prioridad y referencias

> **Estado:** Implementado
> **Depende de:** SPEC 01, SPEC 02
> **Fecha:** 2026-08-06
> **Objetivo:** Reemplazar la `<ul>` andamio de `MedicoPage` por las tres vistas reales del médico —dashboard de sesiones, pacientes con atención personalizada y referencias— fieles a `DESIGN.md` y consumiendo los hooks de TanStack Query que dejó SPEC 02.

---

## Contexto — por qué existe este spec

SPEC 02 dejó nueve endpoints sirviendo datos reales, cuatro hooks de TanStack Query y una `<ul>` provisional en `MedicoPage` marcada en el código como andamio. Este spec es el bloque M3+M4 del plan D1 más la mitad de solo-lectura de M5: la capa de presentación que consume todo lo anterior.

Tres cosas condicionan el trabajo:

- **No hay trabajo de API.** Los nueve endpoints cubren toda la superficie de estas vistas. La única excepción es el hook `useKbState`, que consume el `GET /knowledge/state` que ya existe desde SPEC 02.
- **`DESIGN.md` es contrato congelado.** La matriz de nueve anchos de §5 y el copy literal de §8 son criterios de aceptación, no sugerencias.
- **La asimetría de burbujas de §3.2 es intencional.** En la vista médico read-only el asistente va a la derecha con acento y el paciente a la izquierda. `DESIGN.md` lo marca con ⚠️ explícito. No es un bug que corregir.

---

## Alcance

**Dentro:**

- Componentes compartidos nuevos en `apps/web/src/shared/components/`: `StatusTag`, `Modal`, `BottomPanel`, `KbVersionChip`, `SearchInput`, `TableStates`.
- Tres tablas independientes en `apps/web/src/features/medico/components/`, cada una con sus columnas y su card responsive propias: `SessionTable`, `PriorityTable`, `ReferenceList`.
- Vista de dashboard: `SessionTable` con las seis columnas, búsqueda server-side con debounce de 250 ms, y los cuatro estados obligatorios de `DESIGN.md` §4.3.
- Vista de detalle de sesión: conversación read-only con burbujas, back-link, tag de resultado, chip `KB vN` y la caja `Resumen de recomendaciones enviado al paciente`.
- Vista de pacientes con atención personalizada: `PriorityTable` de cuatro columnas y detalle en `detail-grid` de dos columnas.
- Vista de referencias: `ReferenceList` con badge de tipo y visor modal de 680px con el `body` de la referencia.
- `BottomPanel` compartido por las vistas de sesiones y de pacientes, con el copy de reposo literal de §8.
- `Sidenav` cableado: estado de vista activa real, ítem `03 Agregar conocimiento` deshabilitado, y colapso a tabs horizontales bajo 920px.
- `MedicoPage` gobernando `view` y `selected` con estado local. La URL sigue siendo `/medico`.
- Hook `features/medico/api/useKbState.ts` contra `GET /knowledge/state`.
- Utilidad `shared/lib/useDebouncedValue.ts`.
- Responsive: tablas a lista de cards bajo 768px, `detail-grid` a una columna bajo 1180px.
- Tests Vitest: los cuatro estados de `TableStates`, las tres variantes de `StatusTag`, y la selección de fila que llena el `BottomPanel`.

**Fuera de alcance (para specs posteriores):**

- `Simular llamada` con `speechSynthesis` y `Enviar correo` con Resend. Las dos acciones con efecto lateral de M4 quedan fuera; el detalle del paciente prioritario no lleva botones. → spec posterior
- Componente `Toast` de §4.12. Sin acciones con efecto lateral, nada que notificar.
- Checkbox de selección, seleccionar todo y borrado individual o bulk de referencias. Exigen un `DELETE /knowledge/references` que no existe. → SPEC 06
- La vista del ítem `03 Agregar conocimiento`: textarea de texto crudo, dropzone, barra de progreso del RAG. → SPEC 06
- Animación de pulso del `KbVersionChip` al incrementar la versión. Aquí el chip solo lee. → SPEC 06
- Panel de citas de §4.13. La columna `citations` está vacía en D1. → D3
- Auditoría de endpoints sin consumidor y su eliminación. Este spec deja `GET /patients/priority/:id` sin uso; el barrido completo se registra en `plan/05-lunes/D5-lun-10-ago.md`. → D5
- Rutas anidadas, deep-linking y navegación con el botón atrás del navegador.
- Paginación y ordenamiento por columna. Cinco y tres filas.
- Toda la vista paciente, voz, STT y TTS. → SPEC 05

---

## Modelo de datos

Este spec **no introduce estructuras persistidas ni contratos nuevos**. No toca `packages/shared`, no toca `apps/api`, no genera migraciones. Reutiliza íntegro el modelo de SPEC 02: `Session`, `TranscriptTurn`, `PriorityPatient`, `Reference`, `KbState`.

Lo único que aparece es estado de interfaz, local a `MedicoPage` y sin persistencia.

### Estado de vista

```ts
// features/medico/types.ts
export type MedicoView = 'dashboard' | 'priority' | 'references';

export type Selection =
  | { kind: 'session'; id: string }
  | { kind: 'patient'; id: string }
  | null;
```

`MedicoPage` gobierna tres piezas de estado y nada más:

```ts
const [view, setView] = useState<MedicoView>('dashboard');
const [selected, setSelected] = useState<Selection>(null);
const [query, setQuery] = useState('');
```

- `view` decide qué pinta el content pane y qué ítem del `Sidenav` va activo.
- `selected` alimenta el `BottomPanel` y, cuando es `kind: 'session'`, hace que el content pane muestre la conversación en lugar de la tabla.
- `query` se pasa por `useDebouncedValue(query, 250)` antes de llegar a `useSessions(debouncedQuery)`.

Cambiar de `view` resetea `selected` a `null`. El detalle de una sesión y el de un paciente nunca coexisten.

El visor de referencias no entra en `Selection`: es estado local de `ReferencesView`, porque abre un modal y no alimenta el panel inferior.

### Convenciones de presentación

La base guarda el dato crudo y la UI decide el formato. Estas son las conversiones, en un solo lugar cada una:

| Origen | Presentación | Dónde vive |
|---|---|---|
| `status: 'ok'` | `Exitosa` | `StatusTag` |
| `status: 'attn'` | `Atención humana` | `StatusTag` |
| `status: 'fail'` | `No exitosa` | `StatusTag` |
| `durationSeconds: 372` | `6 min 12 s` | `shared/lib/format.ts` → `formatDuration` |
| `sizeBytes: 48120` | `47 KB` | `shared/lib/format.ts` → `formatBytes` |
| `sizeBytes: null` | `—` | `formatBytes` devuelve el guión largo |
| `addedAt: Date` | `2026-08-04` | `shared/lib/format.ts` → `formatDate` |

Los textos de `StatusTag` salen de `DESIGN.md` §4.4 y son los únicos tres valores admitidos. `date` y `time` de `Session` ya llegan formateados desde la API (`'YYYY-MM-DD'` y `'HH:mm'`) y se pintan tal cual, en mono con `tabular-nums`.

### Archivos nuevos de datos

Ninguno en `packages/shared` ni en `apps/api`. En `apps/web`:

- `features/medico/types.ts` — los dos tipos de arriba.
- `features/medico/api/useKbState.ts` — consume `GET /knowledge/state`, valida con el `KbStateSchema` que ya existe.
- `shared/lib/format.ts` — las cuatro funciones de la tabla.
- `shared/lib/useDebouncedValue.ts` — hook genérico.

---

## Plan de implementación

Diez pasos. Cada uno deja `pnpm dev` arrancable y es commiteable por sí solo.

**1. Primitivas de formato y debounce**
`apps/web/src/shared/lib/format.ts` con `formatDuration`, `formatBytes`, `formatDate` según la tabla de convenciones. `apps/web/src/shared/lib/useDebouncedValue.ts`, hook genérico con `useEffect` y `setTimeout`. Ningún componente los usa todavía.
_Verificación:_ `pnpm typecheck` pasa en las tres workspaces.

**2. `StatusTag` y `TableStates`**
`shared/components/StatusTag.tsx` con las tres variantes de `DESIGN.md` §4.4 —`ok`/`attn`/`fail`, cada una con su pill, su punto de 6px y su etiqueta en español— más la variante `plain` sin punto. `shared/components/TableStates.tsx` renderiza skeleton de filas, vacío, error con botón de reintento, y `Sin resultados para «X»`; recibe `isLoading`, `isError`, `isEmpty`, `query` y `onRetry`.
_Verificación:_ montar `StatusTag` con los tres estados en `MedicoPage` de forma temporal y comprobar los colores contra §4.4.

**3. Shell de `MedicoPage` y `Sidenav` cableado**
`features/medico/types.ts` con `MedicoView` y `Selection`. `MedicoPage` pasa a gobernar `view`, `selected` y `query`; el content pane pinta, por vista, solo el `pane-head` con el copy literal de §8. `Sidenav` recibe `view` y `onViewChange`, marca el activo real en lugar de `index === 0`, y deja el ítem `03 Agregar conocimiento` con `disabled`, `aria-disabled` y `title="Disponible próximamente"`. La `<ul>` andamio de SPEC 02 se borra aquí.
_Verificación:_ clic en `01`, `02` y `04` cambia el título del pane; `03` no responde y el cursor muestra `not-allowed`.

**4. `SessionTable` y la vista de dashboard**
`features/medico/components/SessionTable.tsx` con las seis columnas —fecha, hora, ID sesión, paciente, procedimiento, estado— usando mono con `tabular-nums` en las tres primeras y `StatusTag` en la última. `features/medico/components/DashboardView.tsx` monta `SearchInput` (nuevo, en `shared/components/`), pasa su valor por `useDebouncedValue(query, 250)` a `useSessions`, y delega los cuatro estados a `TableStates`.
_Verificación:_ `/medico` lista las 5 sesiones sembradas; escribir `marcela` deja 2 filas; escribir `zzz` muestra `Sin resultados para «zzz»`; con la API caída aparece el botón de reintento.

**5. `BottomPanel` y selección de sesión**
`shared/components/BottomPanel.tsx` al pie del shell, con el título `Detalle del registro seleccionado` y el copy de reposo literal de §8. `MedicoPage` le pasa `selected`; `SessionTable` marca la fila con `.selected` y llama `onSelect`.
_Verificación:_ al cargar `/medico` el panel muestra el texto de reposo; clic en una fila la resalta y el panel pasa a mostrar los datos de esa sesión.

**6. Detalle de sesión read-only**
`features/medico/api/useKbState.ts` contra `GET /knowledge/state`. `shared/components/KbVersionChip.tsx`, pill mono de 11px según §4.13, sin animación. `features/medico/components/SessionDetail.tsx`: back-link, `StatusTag` del resultado, el chip `KB vN`, las burbujas de `useSession(id)` con la asimetría de §3.2 —asistente a la derecha con acento, paciente a la izquierda— y la caja `Resumen de recomendaciones enviado al paciente` con `session.summary`. Con `selected.kind === 'session'`, el content pane muestra esto en lugar de la tabla.
_Verificación:_ clic en `SES-4821` muestra sus 4 turnos alternando lado; el back-link devuelve a la tabla con la fila aún resaltada.

**7. `PriorityTable` y detalle de paciente**
`features/medico/components/PriorityTable.tsx` con las cuatro columnas: paciente, procedimiento, solicitado por, estado. `features/medico/components/PriorityDetail.tsx` en `detail-grid` de dos columnas: resumen del LLM, bloque `kv` con resultado, duración vía `formatDuration`, nombre y procedimiento, más la card `Resumen del caso` con `caseNotes`. El detalle se pinta con el objeto que ya trajo `usePriorityPatients`; no se llama a `/patients/priority/:id`. El `BottomPanel` refleja la selección.
_Verificación:_ la vista `02` lista los 3 pacientes; Jorge Restrepo con `attn`, Luis Fernández con `fail`; su detalle muestra `6 min 12 s`, no `372`.

**8. `Modal` y vista de referencias**
`shared/components/Modal.tsx` según §4.8, con ancho de 680px, cierre con `Escape`, clic en el backdrop y foco atrapado. `features/medico/components/ReferenceList.tsx` con el ítem de §4.11: badge de tipo en mono, nombre con elipsis, y metadatos con `formatDate` y `formatBytes`. Clic abre `ReferenceViewerModal` con el `body` en el cuerpo mono con `pre-wrap`.
_Verificación:_ la vista `04` lista las 5 referencias con sus badges `PDF`/`MD`/`TXT`/`JSON`/`NOTA`; la de tipo `NOTA` muestra `—` en el tamaño; `Escape` cierra el visor.

**9. Responsive**
Cards bajo 768px en las tres listas: fecha y hora en una línea, paciente destacado, `StatusTag` a la derecha. Tabs horizontales con scroll en el `Sidenav` bajo 920px. `detail-grid` a una columna bajo 1180px.
_Verificación:_ la matriz de nueve anchos de §5, de `360×800` a `1920×1080`, sin scroll horizontal en el `body` en ninguno.

**10. Tests y cierre**
Vitest sobre `TableStates` con sus cuatro estados, sobre `StatusTag` con sus tres variantes, y un test de selección de fila en `DashboardView` que verifica que el `BottomPanel` deja el texto de reposo. Fricciones anotadas en `plan/01-jueves/D1-jue-06-ago.md` y la tarea de auditoría de endpoints en `plan/05-lunes/D5-lun-10-ago.md`.
_Verificación:_ `pnpm lint`, `pnpm typecheck` y `pnpm test` pasan en las tres workspaces.

El paso 3 borra la `<ul>` andamio y es el único paso del plan que temporalmente muestra menos que el anterior: entre el 3 y el 4, `/medico` pinta encabezados sin datos. Sigue arrancable y commiteable. El paso 9 es el más caro y el más fácil de subestimar; si se desborda, el orden de sacrificio está fijado en las decisiones.

---

## Criterios de aceptación

**Dashboard de sesiones**

- [ ] `/medico` no contiene ninguna `<ul>` de códigos de sesión: `grep -n "session.code" apps/web/src/features/medico/components/MedicoPage.tsx` no devuelve nada
- [ ] La tabla de sesiones muestra las 5 sesiones sembradas con sus seis columnas: fecha, hora, ID sesión, paciente, procedimiento, estado
- [ ] Fecha, hora e ID de sesión se pintan en mono con `tabular-nums`
- [ ] Escribir `marcela` en la búsqueda deja 2 filas; `SES-4823` deja 1; `zzz` muestra `Sin resultados para «zzz»`
- [ ] La búsqueda dispara una sola petición 250 ms después de la última tecla, no una por tecla
- [ ] Mientras carga se ven filas skeleton, no un spinner
- [ ] Con la API caída aparece el mensaje de error con botón de reintento, y el reintento refetchea
- [ ] El estado vacío y el estado sin resultados muestran textos distintos

**Detalle de sesión**

- [ ] Clic en la fila de `SES-4821` reemplaza la tabla por su conversación read-only con los 4 turnos
- [ ] En la conversación el asistente va a la derecha con acento y el paciente a la izquierda, según `DESIGN.md` §3.2
- [ ] El detalle muestra el `StatusTag` del resultado y el chip `KB v1` leído de `GET /knowledge/state`, no hardcodeado
- [ ] La caja `Resumen de recomendaciones enviado al paciente` muestra `session.summary`
- [ ] El back-link devuelve a la tabla con la fila todavía resaltada

**Pacientes con atención personalizada**

- [ ] La vista `02` lista los 3 pacientes sembrados: Jorge Restrepo con `attn`, Luis Fernández con `fail`, Diana Salazar con `attn`
- [ ] La tabla muestra sus cuatro columnas: paciente, procedimiento, solicitado por, estado
- [ ] El detalle se pinta en `detail-grid` de dos columnas con resumen del LLM, bloque `kv` y card `Resumen del caso`
- [ ] La duración se muestra como `6 min 12 s`, no como `372`
- [ ] `grep -rn "patients/priority/" apps/web/src` no devuelve nada: el detalle no llama al endpoint por id

**Referencias**

- [ ] La vista `04` lista las 5 referencias sembradas, una por cada tipo del enum
- [ ] Cada ítem muestra su badge correcto: `PDF`, `MD`, `TXT`, `JSON`, `NOTA`
- [ ] La referencia de tipo `NOTA` muestra `—` en la columna de tamaño, no `null` ni `0 B`
- [ ] Clic en una referencia abre el visor modal de 680px con su `body` en mono con `pre-wrap`
- [ ] `Escape` y el clic en el backdrop cierran el visor
- [ ] Seleccionar una referencia no modifica el panel inferior

**Navegación y panel inferior**

- [ ] Los ítems `01`, `02` y `04` del sidenav cambian el content pane y marcan el activo con los estilos de §4.2
- [ ] El ítem `03 Agregar conocimiento` está deshabilitado, no responde al clic y expone `aria-disabled`
- [ ] La URL sigue siendo `/medico` en las tres vistas y en los dos detalles
- [ ] Al cargar `/medico` el panel inferior muestra literal `Selecciona una sesión o un paciente para ver su información aquí.`
- [ ] Cambiar de vista resetea la selección y devuelve el panel inferior a su texto de reposo

**Responsive y fidelidad visual**

- [ ] Los nueve anchos de `DESIGN.md` §5 —`360×800`, `390×844`, `430×932`, `600×960`, `820×1180`, `1024×768`, `1366×768`, `1440×900`, `1920×1080`— no producen scroll horizontal en el `body`
- [ ] Bajo 768px las tres listas se ven como cards, nunca como tabla con scroll horizontal
- [ ] Bajo 920px el sidenav es una fila de tabs horizontales con scroll
- [ ] Bajo 1180px el `detail-grid` colapsa a una columna
- [ ] Los encabezados de tabla están en mono, mayúsculas, 11px, según §4.3
- [ ] Cada estado tiene texto además de color, según el checklist de §9

**Calidad**

- [ ] `pnpm lint`, `pnpm typecheck` y `pnpm test` pasan en las tres workspaces
- [ ] Existen tests Vitest de los cuatro estados de `TableStates`, de las tres variantes de `StatusTag`, y de la selección de fila que llena el panel inferior
- [ ] `grep -rn "features/paciente" apps/web/src/shared apps/web/src/features/medico` no devuelve nada: ni `shared` ni una feature importan de otra feature
- [ ] Ningún archivo de `apps/api` ni de `packages/shared` aparece en el diff de la rama
- [ ] Ningún componente contiene datos de sesión, paciente o referencia hardcodeados

---

## Decisiones tomadas y descartadas

**Navegación y estado**

- **Sí:** estado local en `MedicoPage` con `view` y `selected`. La URL sigue siendo `/medico`. El prototipo no tiene deep-linking y el plan D1 no lo pide.
- **No:** rutas anidadas `/medico/sesiones/:id`, `/medico/prioridad`, `/medico/referencias`. Dan deep-linking y botón atrás, pero son scope no solicitado y tocan `router.tsx`. Si D4 pide compartir el enlace a una sesión, se agregan sin reescribir los componentes: la selección ya está aislada en un tipo.
- **Sí:** cambiar de vista resetea `selected`. Dos detalles simultáneos no tienen dónde pintarse y el panel inferior tendría que decidir cuál gana.
- **Sí:** el visor de referencias queda fuera de `Selection`, como estado local de su vista. Abre un modal y no alimenta el panel inferior; meterlo en el tipo compartido obligaría a un tercer caso que nadie más consume.

**Componentes y ubicación**

- **Sí:** tres tablas independientes —`SessionTable`, `PriorityTable`, `ReferenceList`— en `features/medico/components/`. Columnas, anchos y cards responsive distintos en cada una.
- **No:** un `DataTable<T>` genérico con `columns` y `renderCard`. Menos archivos, pero la abstracción se paga en indirección desde el primer día y las tres tablas no comparten forma real, solo la palabra "tabla".
- **Sí:** `TableStates` compartido para los cuatro estados no-felices de §4.3. Es lo único que las tres listas sí comparten textualmente, y escribirlo tres veces garantiza que las tres se desincronicen. Solo recibe `isLoading`, `isError`, `isEmpty`, `query` y `onRetry`; no conoce columnas ni filas.
- **Sí:** `StatusTag`, `Modal`, `BottomPanel`, `KbVersionChip` y `SearchInput` nacen en `shared/components/`. SPEC 05 y SPEC 06 necesitan `StatusTag`, `Modal` y `KbVersionChip` desde la vista paciente; nacer en `features/medico/` obligaría a moverlos o a violar la regla de capas de SPEC 01.
- **No:** todo en `features/medico/components/` y mover después. Es la deuda que SPEC 05 pagaría, no este spec.

**Datos y consumo de API**

- **Sí:** el detalle del paciente prioritario se pinta con el objeto que ya trajo `usePriorityPatients`. Verificado en código: `patients.repository.ts` hace `select()` sin proyección, el controlador tipa `PriorityPatient[]` y el hook valida contra el esquema completo.
- **No:** un hook `usePriorityPatient(id)` contra `/patients/priority/:id`. Sería una segunda petición por un dato que ya está en memoria y ya fue validado.
- **Sí:** `GET /patients/priority/:id` queda sin consumidor, y eso se registra como tarea de auditoría en `plan/05-lunes/D5-lun-10-ago.md` en vez de borrarse hoy. SPEC 05 podría necesitarlo al escalar un paciente desde una sesión de voz; borrarlo ahora es adivinar.
- **Sí:** el chip `KB vN` lee `GET /knowledge/state` vía `useKbState`. `SPECS-PENDIENTES` proponía crearlo estático con `v1`, pero un componente sin montar y sin datos no lo verifica ningún criterio de aceptación.
- **Sí:** las conversiones de formato viven en `shared/lib/format.ts`, una función por conversión. `durationSeconds: 372` se muestra como `6 min 12 s` y `sizeBytes: null` como `—`, coherente con la decisión de SPEC 02 de guardar el dato crudo y formatear en la UI.
- **Sí:** búsqueda server-side con `?q=` y debounce de 250 ms. El backend ya la implementa; filtrar el array en el cliente desaprovecha trabajo hecho y no escala.

**Alcance recortado**

- **No:** `Simular llamada` con `speechSynthesis` ni `Enviar correo` con Resend. Son las dos únicas acciones con efecto lateral del bloque médico. `speechSynthesis` es gratis, pero abre la puerta a que el correo entre "ya que estamos", y ese sí exige cuenta, API key y endpoint nuevo.
- **No:** componente `Toast` de §4.12. Sin acciones con efecto lateral no hay nada que notificar. Entra con la primera acción que lo necesite.
- **No:** checkboxes, seleccionar todo y borrado de referencias. Exigen un `DELETE /knowledge/references` que no existe, y meterlo convertiría un spec de presentación en uno de API. `SPECS-PENDIENTES` ya se lo asigna a SPEC 06.
- **Sí:** el ítem `03 Agregar conocimiento` queda deshabilitado con `title="Disponible próximamente"`. Comunica que existe y no está listo.
- **No:** dejarlo clicable con un placeholder. Es trabajo que SPEC 06 tira, y una vista en construcción se lee peor que un ítem honestamente apagado.
- **No:** dejarlo clicable sin efecto. Parece roto en vez de pendiente.

**Responsive**

- **Sí:** cards bajo 768px y tabs horizontales bajo 920px, ambos en este spec. `DESIGN.md` §5 prohíbe explícitamente la tabla con scroll horizontal, y cuatro de los nueve anchos de la matriz están por debajo de 768px.
- **No:** diferir el responsive a un pase posterior. La matriz de nueve anchos es criterio de aceptación de este spec; diferirla lo deja sin poder cerrarse.
- **Sí:** si el paso 9 se desborda, el orden de sacrificio es tabs primero, cards después, y el criterio de cero scroll horizontal nunca. Escrito aquí para que la decisión no se tome con prisa a las once de la noche.

---

## Riesgos

| Riesgo | Mitigación |
|---|---|
| El paso 9 (responsive) se come el resto del día y bloquea SPEC 04, que el plan marca 🔴 como lo más importante | El orden de sacrificio está escrito en las decisiones: tabs primero, cards después, cero scroll horizontal nunca. Si el paso 9 no cierra en su timebox, se corta por ahí y se sigue con SPEC 04 |
| La matriz de nueve anchos se declara verificada habiendo probado tres | Es un criterio de aceptación explícito con los nueve valores escritos. SPEC 01 ya dejó anotado que el `resize_window` de la extensión de Chrome no baja de forma confiable de ~600px en este entorno: los anchos de 360, 390, 430 y 600px se verifican con un iframe de ancho exacto, igual que se hizo con el topbar del paciente |
| El paso 3 borra la `<ul>` andamio y deja `/medico` sin datos hasta el paso 4 | Es el único paso del plan que muestra menos que el anterior. Está señalado en el plan para que no se confunda con una regresión, y el paso 4 lo cierra |
| Se cuela `Enviar correo` o `Simular llamada` "ya que son dos líneas" | El bloque "Fuera de alcance" es vinculante. `speechSynthesis` es gratis y por eso mismo es la puerta de entrada al correo, que no lo es |
| La asimetría de burbujas de §3.2 se "corrige" durante la implementación por parecer un bug | `DESIGN.md` la marca con ⚠️ explícito y es criterio de aceptación redactado con los lados nombrados. No se revisa a ojo |
| El copy se parafrasea al escribir los componentes | Los textos de §8 son literales y tres criterios de aceptación citan la cadena exacta, incluido el punto final de `Selecciona una sesión o un paciente para ver su información aquí.` |
| `TableStates` crece hasta convertirse en el `DataTable` genérico que se descartó | Solo recibe `isLoading`, `isError`, `isEmpty`, `query` y `onRetry`. No conoce columnas ni filas. Si en la implementación aparece una prop de datos, la decisión se reabre en el spec, no en el código |
| `Modal` sin foco atrapado ni cierre con `Escape` rompe la accesibilidad de §6 | Ambos son criterio de aceptación del paso 8. `Modal` nace en `shared/components/` porque SPEC 06 lo va a reusar; nacer roto multiplica el costo |
| Cambiar `Sidenav` rompe el test de SPEC 01 | `apps/web/src/shared/layouts/Topbar.test.tsx` es el único test de layout existente y no cubre `Sidenav`, pero el paso 3 cambia su firma. `pnpm test` se corre en ese paso, no solo en el 10 |

---

## Lo que **no** entra en este spec

- `Simular llamada` con `speechSynthesis` y `Enviar correo` con Resend. → spec posterior
- Componente `Toast` de §4.12.
- Subida de documentos, borrado de referencias e incremento de `kbVersion`. → SPEC 06
- La vista del ítem `03 Agregar conocimiento` y la barra de progreso del RAG. → SPEC 06
- Animación de pulso del `KbVersionChip`. → SPEC 06
- Panel de citas de §4.13. → D3
- Vista paciente, micrófono, STT y TTS. → SPEC 05
- `LLMPort` y sus drivers. Ningún dato de estas vistas pasa por un LLM. → SPEC 04
- Rutas anidadas y deep-linking.
- Paginación y ordenamiento por columna.
- Cambios en `apps/api` y en `packages/shared`.

Cada uno, si aterriza, va en su propio spec.
