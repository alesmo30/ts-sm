# DESIGN.md — Sistema visual congelado

> **Contrato visual del proyecto.** Extraído del prototipo de Open Design (`/Users/alejandro/Downloads/voice-agent-prototype`) y del brand spec derivado de sourcemeridian.com.
> Ante cualquier ambigüedad: **se respeta lo que dice este archivo**, no los defaults de Tailwind ni de shadcn/ui.

---

## 1. Postura del sistema

**Tech-utility oscuro.** Herencia visual de dashboards clínicos serios (Datadog, Linear en modo oscuro), no de healthtech consumer pastel. Producto para industria regulada: sobrio, denso en datos, sin decoración.

Cinco reglas que gobiernan todo:

1. Fondo oscuro casi negro, **nunca negro puro**. Las superficies son un tono más claras que el fondo, **nunca cards blancas**.
2. **Un solo acento teal**, usado con moderación: estado positivo, botón primario, bordes activos. No se decora todo con él.
3. **Bordes sutiles** (`rgba(249,249,249,.07)`), nunca sombras duras. La jerarquía viene del contraste tipográfico y el espaciado, no de cajas.
4. Tipografía display **geométrica y firme** (Space Grotesk) con tracking negativo en headings; el cuerpo en gris (`--muted`) para no competir.
5. **Sin gradientes decorativos, sin iconos redundantes.** Datos en mono con alineación tabular.

**Prohibido:** fondos beige/crema/durazno, gradientes decorativos, sombras difusas de colores, emojis en la UI de producto, cards blancas, tipografía por defecto del framework.

---

## 2. Tokens

Fuente de verdad. Van a `tailwind.config.ts` como tema extendido y a `index.css` como variables CSS.

### 2.1 Color

```css
:root {
  /* superficies */
  --bg:         #1A1C1E;   /* fondo de página */
  --surface:    #1E2023;   /* topbar, sidenav, cards, modales */
  --surface-2:  #25272A;   /* inputs, hover de fila, burbuja entrante, chips */
  --surface-3:  #2C2F33;   /* track de progreso, elevación máxima */

  /* texto */
  --fg:         #F0F0EE;   /* texto principal */
  --muted:      #8C9097;   /* texto secundario, labels */
  --tx-muted:   #52575D;   /* placeholders, timestamps, numeración */

  /* bordes */
  --border:     rgba(249,249,249,.07);   /* divisores, bordes de reposo */
  --border-mid: rgba(249,249,249,.14);   /* inputs, bordes interactivos */

  /* acento */
  --accent:      #0FE8C4;
  --accent-rgb:  15,232,196;
  --accent-soft: rgba(15,232,196,.12);
  --accent-hover:#3FF2D4;
  --on-accent:   #0B1211;   /* texto sobre fondo acento */

  /* estados */
  --danger:      #FF7A66;
  --danger-soft: rgba(255,122,102,.14);
  --on-danger:   #1A0F0D;
  --warn:        #F5B14C;
  --warn-soft:   rgba(245,177,76,.14);
}
```

**Semántica de estado — uso obligatorio y consistente:**

| Token | Significado | Dónde aparece |
|---|---|---|
| `--accent` teal | Éxito, activo, primario | Sesión exitosa, botón primario, nav activo, TTS activo |
| `--warn` ámbar | Requiere atención humana | Tag "Atención humana", escalamiento nivel medio |
| `--danger` coral | Fallo, error, grabando | Tag "No exitosa", mic grabando, eliminar, escalamiento crítico |

> El rojo del micrófono grabando es intencional: es el mismo token que el error, porque comunica "estado activo que demanda atención". No se cambia.

### 2.2 Tipografía

```css
--font-display: 'Space Grotesk', 'Helvetica Neue', Arial, sans-serif;  /* 500 600 700 */
--font-body:    'DM Sans', 'Helvetica Neue', Arial, sans-serif;        /* 400 500 600 */
--font-mono:    ui-monospace, 'JetBrains Mono', 'SF Mono', Menlo, monospace;
```

Se cargan desde Google Fonts con `preconnect`. **Autohospedar las fuentes** en `apps/web/public/fonts` antes de la entrega: el evaluador puede correr sin red abierta y R0.3 no puede depender de fonts.googleapis.com.

| Uso | Familia | Tamaño | Peso | Extra |
|---|---|---|---|---|
| Base del body | body | 15px | 400 | `line-height: 1.5` |
| H1 topbar | display | 17–18px | 600 | |
| H2 encabezado de panel | display | 21px | 600 | `letter-spacing:-.01em` |
| H2 pre-sesión | display | 24px | 600 | |
| H3 modal | display | 17px | 600 | |
| Descripción de panel | body | 13px | 400 | color `--muted` |
| Encabezado de tabla | **mono** | 11px | 500 | `uppercase`, `letter-spacing:.05em`, color `--muted` |
| Celda de tabla | body | 13.5px | 400 | |
| Columna numérica / ID | **mono** | 13.5px | 400 | `font-variant-numeric: tabular-nums` |
| Burbuja de chat | body | 14.5px | 400 | |
| Flag de voz/TTS | **mono** | 10.5px | 400 | `uppercase`, `letter-spacing:.03em` |
| Timestamp | body | 10.5px | 400 | color `--tx-muted` |
| Label de campo | body | 13px | 400 | color `--muted` |
| Botón | body | 13.5px | 500 | |
| Numeración de nav | **mono** | 11px | 400 | color `--tx-muted` |

**Regla mono:** todo dato identificador o numérico va en mono — IDs de sesión, fechas, horas, versiones de KB, métricas, encabezados de tabla. Prosa nunca va en mono.

### 2.3 Forma y movimiento

```css
--radius:    10px;    /* botones, inputs, cards pequeñas, nav items */
--radius-lg: 16px;    /* modales, cards grandes, burbujas de chat */
/* 999px para pills: tags, switch-btn, composer input, toast, start-btn */
/* 4px en la esquina "de origen" de cada burbuja (cola del mensaje) */
```

**Sombras:** solo en elementos flotantes. `box-shadow: 0 30px 80px rgba(0,0,0,.5)` en modales, `0 12px 30px rgba(0,0,0,.4)` en toast. **En ningún otro lugar.**

**Transiciones:** `.12s` en hover de filas, `.15s` en bordes y color, `.3s ease` en la barra de progreso. Sin animaciones de entrada elaboradas.

**Backdrop de modal:** `rgba(10,11,12,.65)` + `backdrop-filter: blur(4px)`.

---

## 3. Layout

### 3.1 Vista médico (`/medico`)

```
┌──────────────────────────────────────────────────────────────┐
│ TOPBAR  sticky · 16px 28px · border-bottom · bg surface      │
│ [Dr] Hola Doc                          [Cambiar a paciente]  │
├────────────────────┬─────────────────────────────────────────┤
│ SIDENAV            │ CONTENT PANE                            │
│ minmax(260px,1fr)  │ minmax(0,2fr)     padding 26px 30px     │
│ 4 items            │                                         │
│ border-right       │ pane-head + tabla / detalle             │
├────────────────────┴─────────────────────────────────────────┤
│ BOTTOM PANEL  border-top · padding 22px 30px 30px            │
│ Detalle del registro seleccionado                            │
└──────────────────────────────────────────────────────────────┘
```

```css
.shell { display:grid; grid-template-columns: minmax(260px,1fr) minmax(0,2fr); }
@media (max-width:920px) { .shell { grid-template-columns: 1fr; } }
```

El panel inferior está **oculto por defecto** y aparece al seleccionar una fila. Nunca se muestra vacío con contenido; muestra el texto de reposo *"Selecciona una sesión o un paciente para ver su información aquí."*

### 3.2 Vista paciente (`/paciente`)

```
┌──────────────────────────────────────────────────────────────┐
│ TOPBAR  16px 24px                                            │
│ [Pa] Hola Paciente   [Actualizar conocimiento] [Cambiar a Dr]│
├──────────────────────────────────────────────────────────────┤
│                                                              │
│   STAGE  max-width:720px · centrado · padding 0 20px         │
│                                                              │
│   pre-sesión (centrada)   →   chat-view (al iniciar)         │
│                                                              │
│                              ┌──────────────────────────┐    │
│                              │ chat-scroll  flex:1      │    │
│                              ├──────────────────────────┤    │
│                              │ composer  border-top     │    │
│                              │ [🎤] [input pill] [➤]    │    │
│                              └──────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

El chat es de **columna única centrada, máximo 720px**. Burbujas del paciente a la derecha (`--accent-soft`), del asistente a la izquierda (`--surface-2`).

> ⚠️ **Ojo con la asimetría entre vistas:** en la vista médico (read-only) el prototipo pinta al asistente a la derecha con acento y al paciente a la izquierda. En la vista paciente es al revés (el paciente es "yo", va a la derecha). **Es correcto y se conserva:** en cada vista, "yo" va a la derecha. Documentarlo para no "corregirlo" por error.

---

## 4. Componentes

### 4.1 Topbar

Marca cuadrada de 34px, `border-radius:9px`, fondo `--accent-soft`, texto `--accent`, display bold 15px. `Dr` en médico, `Pa` en paciente. Título 17–18px display 600, subtítulo 12.5–13px `--muted`.

`switch-btn`: pill, `--surface-2`, borde `--border-mid`. En hover el borde y el texto pasan a `--accent`. Icono de 14px a la izquierda del texto.

`knowledge-btn` (solo paciente, a la izquierda del switch): misma forma que `switch-btn`, icono de documento. **Nunca en estado primario** — no compite con el foco de la conversación.

### 4.2 Nav item (sidenav)

Padding `12px 14px`, radio `--radius`, icono 17px, gap 12px, numeración mono a la derecha con `margin-left:auto`.

| Estado | Estilo |
|---|---|
| Reposo | texto `--muted`, fondo transparente, borde transparente |
| Hover | texto `--fg`, fondo `--surface-2` |
| **Activo** | texto `--accent`, fondo `--accent-soft`, borde `rgba(var(--accent-rgb),.3)` |

Los cuatro ítems, en orden, con su numeración: `01 Dashboard de control` · `02 Pacientes con atención personalizada` · `03 Agregar conocimiento` · `04 Referencias`.

### 4.3 Tabla

```css
.ds-table th { font-family: mono; font-size:11px; uppercase; letter-spacing:.05em; color: --muted; }
.ds-table td { padding:12px 14px; border-bottom:1px solid --border; font-size:13.5px; }
tbody tr:hover     { background: --surface-2; cursor:pointer; transition: background .12s; }
tbody tr.selected  { background: --accent-soft; }
```

Fecha, hora e ID de sesión en mono con `tabular-nums`. La fila entera es clicable.

**Estados obligatorios:** cargando (skeleton de filas, no spinner), vacío (mensaje centrado en `--muted`, nunca una tabla vacía muda), error (mensaje + botón de reintento), sin resultados de búsqueda (distinto del vacío: *"Sin resultados para «X»"*).

### 4.4 Tag de estado

Pill con punto de 6px del mismo color, padding `4px 10px`, 11.5px peso 500.

| Variante | Fondo | Texto | Uso |
|---|---|---|---|
| `ok` | `--accent-soft` | `--accent` | **Exitosa** |
| `attn` | `--warn-soft` | `--warn` | **Atención humana** |
| `fail` | `--danger-soft` | `--danger` | **No exitosa** |
| `plain` | `--surface-2` | `--muted` | Neutro, con borde `--border-mid`, sin punto |

### 4.5 Botones

| Variante | Estilo | Hover |
|---|---|---|
| `primary` | fondo `--accent`, texto `--on-accent` | fondo `--accent-hover` |
| `secondary` | transparente, borde `--border-mid`, texto `--fg` | borde `--fg` |
| `ghost` | transparente, texto `--muted`, padding `8px 10px` | texto `--fg` |
| `danger` | fondo `--danger-soft`, texto `--danger`, borde `--danger` a 30% | fondo `--danger`, texto `--on-danger` |

Deshabilitado: `opacity:.4; cursor:not-allowed`. Cargando: spinner de 14px en el slot del icono, texto intacto, botón deshabilitado. Padding `10px 18px`, gap 8px, icono 14px.

### 4.6 Burbuja de chat

Máximo 76% de ancho, padding `11px 15px`, radio 16px con 4px en la esquina de origen, 14.5px.

- **Entrante:** `--surface-2` + borde `--border`, esquina inferior izquierda a 4px.
- **Saliente:** `--accent-soft` + borde `rgba(var(--accent-rgb),.25)`, esquina inferior derecha a 4px.
- **Flag de voz** (arriba, mono 10.5px, `--muted`): `🎙 TRANSCRITO DE AUDIO`.
- **Flag de TTS** (abajo, mono 10.5px, `--accent`): `🔊 Leído en voz alta`.
- **Timestamp** abajo a la derecha, 10.5px, `--tx-muted`.
- **Chips de cita** debajo del texto del asistente: pills `--surface-2`, mono 10.5px, clicables, abren el fragmento fuente.

**Indicador de escritura:** tres puntos de 6px en `--muted`, `animation: blink 1.2s infinite` con retardos de .2s y .4s, dentro de una burbuja entrante.

### 4.7 Composer

`border-top` de separación. Tres elementos: botón mic (44px circular), input pill (`flex:1`, `--surface-2`, borde `--border-mid`, radio 999px, padding `13px 18px`), botón enviar (44px circular, fondo `--accent`).

Input en foco: borde `--accent`.

**Botón de micrófono, estados:**

| Estado | Estilo |
|---|---|
| Reposo | `--surface-2`, borde `--border-mid` |
| Hover | borde y color `--accent` |
| **Grabando** | fondo `--danger`, texto `--on-danger`, `animation: pulse 1s infinite` con halo expansivo |
| Procesando | spinner, deshabilitado |
| Denegado | icono tachado, tooltip con instrucción de permisos |

### 4.8 Modal

Backdrop `rgba(10,11,12,.65)` + blur 4px. Card `--surface`, borde `--border-mid`, radio `--radius-lg`, padding 26px, sombra `0 30px 80px rgba(0,0,0,.5)`.

- Estándar: `max-width:420–440px`.
- Ancho (visor de referencias): `max-width:680px`, `max-height:82vh`, cuerpo con scroll propio.
- Acciones abajo a la derecha, gap 10px, secundaria primero.
- Cierra con `Esc` y con clic en el backdrop. **Foco atrapado dentro** mientras está abierto, y devuelto al disparador al cerrar.

**Cuerpo del visor:** mono 13.5px, `line-height:1.7`, `white-space:pre-wrap`, fondo `--surface-2`, radio 8px, padding 16px.

### 4.9 Dropzone y lista de archivos

Dropzone: borde punteado 1.5px `--border-mid`, radio `--radius-lg`, padding 32px, centrado, `--muted`, fondo `--surface-2`. El texto de acción en `--fg`.
En arrastre activo: borde `--accent` y fondo `--accent-soft`.

Filechip: fila `--surface-2`, borde `--border`, radio 8px, padding `8px 12px`, 13px. Botón de quitar a la derecha, `--muted`, en hover `--danger`.

### 4.10 Barra de progreso del RAG

```css
.progress-track { height:6px; background:var(--surface-3); border-radius:999px; }
.progress-fill  { height:100%; background:var(--accent); transition: width .3s ease; }
```

Etiqueta superior en mono 12.5px `--muted`, con la etapa a la izquierda y el porcentaje a la derecha.

**Etapas del pipeline, en este orden y con este texto:**
`Recibido` → `Extrayendo texto` → `Fragmentando` → `Generando embeddings` → `Indexado`

En error: barra en `--danger`, etiqueta con el motivo y botón de reintento.

### 4.11 Ítem de referencia

Fila clicable: checkbox (`accent-color: var(--accent)`, 15px), badge de tipo (32px, radio 8px, `--surface-2`, texto `--accent` en mono 10px bold: `PDF`/`MD`/`TXT`/`JSON`/`NOTA`), nombre 13.5px peso 500 con elipsis, metadatos 12px `--muted` (fecha + tamaño).

Hover: borde pasa a `--border-mid`. Seleccionado: fondo `--accent-soft`.

### 4.12 Toast

Pill flotante centrada abajo (`bottom:24px`), `--surface-2`, borde `--border-mid`, sombra `0 12px 30px rgba(0,0,0,.4)`, 13px, icono de 14px en `--accent`. Se autodescarta a los 2.6s.

### 4.13 Componentes nuevos (no están en el prototipo)

**Chip de versión del KB** — en el header del chat del paciente. Pill mono 11px, `--surface-2`, borde `--border-mid`, texto `KB v3`. Al incrementar: pulso breve a `--accent-soft` y vuelta al reposo. Nunca compite visualmente con la conversación.

**Chip de progreso flotante de ingesta** — esquina inferior derecha, sobre el composer, no bloqueante. Contiene la etapa actual, una barra de 4px y el nombre del archivo truncado. Al completar: se transforma en confirmación verde durante 2s y se desvanece.

**Separador de sistema en el hilo** — línea horizontal `--border` a ambos lados de un texto centrado en mono 10.5px `--muted`:

```
──────  Base de conocimiento actualizada · protocolo-dolor-v2.pdf · 14:32  ──────
```

Sin fondo, sin burbuja. **No es un mensaje del asistente** y no debe parecerlo. Se persiste con la transcripción y se renderiza igual en la vista read-only del médico.

**Panel de citas** — al hacer clic en un chip de cita: sheet lateral (desktop) o modal (móvil) con el fragmento exacto resaltado, el nombre del documento, su versión y la `kb_version` del turno.

---

## 5. Responsive

Matriz de validación obligatoria — **sin scroll horizontal en ninguno**:

`360×800` · `390×844` · `430×932` · `600×960` · `820×1180` · `1024×768` · `1366×768` · `1440×900` · `1920×1080`

| Umbral | Comportamiento |
|---|---|
| `<920px` | El shell del médico colapsa a una columna. El sidenav pasa a tabs horizontales con scroll |
| `<1180px` | `detail-grid` de dos columnas colapsa a una |
| `<768px` | La tabla se convierte en lista de cards (fecha+hora en una línea, paciente destacado, tag a la derecha). **Nunca una tabla con scroll horizontal** |
| `<640px` | El topbar reduce el texto de los botones a solo icono, con `aria-label` |

Todo contenido ancho (tablas, diagramas, bloques de código) vive dentro de su propio contenedor `overflow-x:auto`. El `body` jamás scrollea en horizontal.

---

## 6. Accesibilidad

No es opcional: producto clínico, y suma en calidad de código.

- Jerarquía de headings sin saltos. Un solo `<h1>` por vista.
- Controles reales: `<button>`, `<input>`, `<table>`. Nada de `<div onClick>`.
- **Foco visible siempre**: `outline: 2px solid var(--accent); outline-offset: 2px`. No se elimina el outline sin sustituto.
- Contraste mínimo AA: `--fg` sobre `--bg` cumple; **`--tx-muted` (#52575D) solo para texto decorativo o de 10px**, nunca para información esencial.
- Modales: foco atrapado, `Esc` cierra, foco devuelto al disparador.
- El chat es una `aria-live="polite"` region para que un lector de pantalla anuncie los mensajes entrantes.
- El estado del micrófono se anuncia por texto, no solo por color (rojo pulsante + etiqueta "Grabando").
- Los estados nunca se comunican **solo** por color: cada tag lleva texto y punto.
- Objetivos táctiles de 44px mínimo en móvil.
- `prefers-reduced-motion`: se desactivan el pulso del micrófono y el blink del typing.

---

## 7. Implementación en el stack

**Tailwind:** los tokens van a `theme.extend` (`colors.bg`, `colors.surface`, `colors.accent`, …), no como clases arbitrarias sueltas. Las fuentes a `fontFamily.display / body / mono`. Los radios a `borderRadius`.

**shadcn/ui:** se instala y **se retematiza con estos tokens antes de usar cualquier componente**. Las variables de shadcn (`--background`, `--foreground`, `--primary`, `--muted-foreground`, `--border`, `--ring`) se mapean a las de este archivo. Componentes a usar: `dialog`, `table`, `input`, `button`, `checkbox`, `progress`, `sheet`, `toast`, `tabs`, `scroll-area`, `skeleton`.

> ⚠️ El default de shadcn es un gris azulado que **no** es esta paleta. Si al levantar la app se ve gris neutro en vez de `#1A1C1E`, la retematización no se aplicó.

**Iconos:** `lucide-react`, stroke-width `1.6–1.8`, tamaño 14px en botones, 17px en nav, 19px en composer. Coinciden con los SVG inline del prototipo.

**Estructura:** `components/ui/` para shadcn retematizado, `components/` para compuestos propios (`StatusTag`, `SessionTable`, `ChatBubble`, `SystemDivider`, `KbVersionChip`, `IngestProgressChip`, `CitationChip`).

---

## 8. Copy (texto de interfaz)

Se conserva literal el del prototipo. Español de Colombia, tono profesional sin ser frío. **Nunca jerga médica dirigida al paciente.**

| Ubicación | Texto |
|---|---|
| Topbar médico | `Hola Doc` / `Panel de sesiones del asistente de voz` |
| Topbar paciente | `Hola Paciente` / `Asistente de voz — MeridianAsiste` |
| Dashboard | `Dashboard de control` / `Todas las sesiones atendidas por el asistente de voz` |
| Prioridad | `Pacientes con atención personalizada` / `Solicitada por el paciente o detectada por el asistente de voz` |
| Conocimiento | `Agregar conocimiento` / `Actualiza el RAG con texto crudo o documentos` |
| Referencias | `Referencias` / `Documentos e indicaciones que alimentan el RAG del asistente` |
| Panel inferior | `Detalle del registro seleccionado` / `Selecciona una sesión o un paciente para ver su información aquí.` |
| Pre-sesión | `Habla con tu asistente de voz` / `Podrás escribir o hablar tus preguntas sobre tu procedimiento. Todo queda registrado para tu médico.` |
| Nota de micrófono | `Se te pedirá permiso de micrófono si usas voz` |
| Modal salir (médico) | `¿Cambiar a vista paciente?` / `Vas a salir del panel del médico. Si hay una sesión de voz activa, se dará por finalizada y se guardará.` |
| Modal salir (paciente) | `¿Cambiar a vista médico?` / `Esto finaliza tu sesión actual con el asistente. Tu conversación se guardará antes de salir.` |
| Modal conocimiento | `Actualizar conocimiento` / `Acción del personal clínico. El asistente aplicará los cambios sin interrumpir la conversación en curso.` |
| Aviso de versión | `Se aplicará en tu próxima pregunta` |
| Resumen de sesión | `Resumen de recomendaciones enviado al paciente` |

---

## 9. Checklist de fidelidad visual

Antes de dar por terminada cualquier vista:

- [ ] El fondo es `#1A1C1E`, no el gris por defecto de shadcn
- [ ] Los headings usan Space Grotesk, no la fuente del sistema
- [ ] IDs, fechas, horas y métricas están en mono con `tabular-nums`
- [ ] Los encabezados de tabla están en mono, mayúsculas, 11px
- [ ] El acento teal aparece con moderación, no decorando todo
- [ ] No hay sombras salvo en modales y toast
- [ ] Cada estado tiene texto, no solo color
- [ ] El foco es visible en todos los controles interactivos
- [ ] Sin scroll horizontal en los 9 viewports de la matriz
- [ ] Los estados de carga, vacío y error están implementados, no solo el feliz
