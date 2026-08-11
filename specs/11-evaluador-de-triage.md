# SPEC 11 — Evaluador de triage contra el dataset etiquetado

> **Estado:** Implementado
> **Depende de:** SPEC 10
> **Fecha:** 2026-08-10
> **Objetivo:** Correr las reglas determinísticas de triage contra los 160 casos etiquetados de `dataset_final.xlsx` y emitir una matriz de confusión reproducible, con cada falso negativo listado por `caso_id`.

---

## Contexto — por qué existe este spec

`PLAN-RENOVADO-KIT.md:267-273` lo llamó *"la jugada diferencial"* y *"la mejor relación
puntos/hora de todo lo que queda por construir"*. `plan-general.md:153` lo degradó a
*"tercero en la cola de recuperación"* al competir con entregables obligatorios, y
`D3-sab-08-ago.md:194` lo dejó anotado con la frase *"No se abrió spec nuevo para esto"*.

Convierte *"creemos que nuestro triage es bueno"* en *"nuestro triage tiene N falsos
negativos sobre los 12 casos rojos del dataset oficial, y aquí está el script que lo
reproduce"*. Es material directo para el informe, para la Pregunta 2 del video y para el
criterio de repositorio y proceso.

Es barato **por cómo quedó SPEC 10**: `triage.rules.ts` es una función pura sin
dependencias, así que el evaluador no levanta la app, no abre WebSocket, no crea sesiones y
no hace una sola llamada a un modelo. Lee el `.xlsx`, agrupa por `caso_id`, corre las reglas
y compara.

**Lo que este evaluador mide y lo que no.** Mide **solo la rama determinística** del triage.
`RedFlagDetectorService` necesita `GEMINI_API_KEY` y una llamada por turno; el `[[ESCALAR]]`
del modelo no es reproducible offline. La matriz resultante es por tanto un **piso**, no el
rendimiento del sistema completo: en producción esas dos señales solo pueden subir la
severidad, nunca bajarla. El informe tiene que decirlo con esas palabras — la rúbrica
advierte que *"reportar números que no se sostienen es peor que no reportarlos"*.

---

## Alcance

**Dentro**

- Script `tsx` ejecutable con `pnpm --filter api run triage:eval`, mismo patrón que `seed.ts`
  y `backfill-embeddings.ts`.
- Lectura de `dataset-reto/dataset/dataset_final.xlsx` con una dependencia de desarrollo de
  lectura de hojas de cálculo. El dataset está en `.gitignore:40` y se puebla con
  `pnpm dataset:fetch`; si falta, el script aborta con ese mensaje exacto y código distinto
  de cero.
- Agrupación por `caso_id`, reconstruyendo cada caso como si fuera una sesión: los turnos en
  orden de `turno_idx`, alimentando `evaluate()` y la acumulación de SPEC 10 turno a turno, y
  quedándose con el nivel final acumulado.
- **Entradas consideradas:** turnos de `hablante = 'paciente'` y de `hablante = 'tercero'`.
  Los 151 turnos del familiar entran por el mismo micrófono en una llamada real.
- **Las dos capas evaluadas por separado**, con una matriz para `capa1_limpia` y otra para
  `capa2_ruidosa`. La diferencia entre ambas es un resultado en sí misma: mide cuánto se
  degrada el triage con habla realista.
- Matriz de confusión 3×3 (verde/amarillo/rojo, referencia contra predicho) por capa, más
  recall de rojos, y el conteo de falsos negativos separado por gravedad: `rojo→verde`
  (catastrófico) y `rojo→amarillo` (grave).
- **Lista explícita de cada caso fallado** con su `caso_id`, la etiqueta de referencia, la
  predicha y las señales que las reglas sí detectaron. Sin eso el reporte no sirve para
  corregir nada.
- Salida por consola **y** en `reports/triage-eval.md`, commiteable. Es lo que se cita en el
  informe y sobrevive aunque quien lea el repo no tenga el dataset descargado.

**Fuera (para specs futuras)**

- **Evaluar `RedFlagDetectorService`.** Exigiría 3.991 llamadas a Gemini y una clave válida;
  el evaluador dejaría de ser gratuito y reproducible.
- **Evaluar la marca `[[ESCALAR]]` del modelo.** No es reproducible offline ni determinística
  — ese es justamente el hallazgo de `problema-escalamiento-bloque5.md`.
- **Correr el evaluador en CI.** El dataset está en `.gitignore`; CI no lo tiene y clonarlo en
  cada corrida es peso sin beneficio.
- **Ajustar los umbrales de `triage.rules.ts` a lo que diga la matriz.** El evaluador mide, no
  optimiza. Cambiar un umbral es una decisión clínica que se toma aparte, con su
  justificación, no un ajuste de curva contra 160 casos etiquetados por otro modelo.
- **Métricas de conversación** (latencia, tokens, costo). → plan 04
- **Un endpoint HTTP o una vista que muestre la matriz.** Es un script de desarrollo y un
  markdown, no una funcionalidad del producto.

---

## Modelo de datos

No introduce estructuras persistentes: ninguna tabla, ninguna columna, ningún contrato
nuevo. El evaluador es un script de solo lectura sobre un `.xlsx` y sobre funciones puras.

Las estructuras internas del script:

```ts
type Label = 'verde' | 'amarillo' | 'rojo';   // vocabulario del dataset
type Capa = 'capa1_limpia' | 'capa2_ruidosa';

interface EvalCase {
  casoId: string;
  capa: Capa;
  expected: Label;              // label_ground_truth, constante dentro del caso_id
  turns: string[];              // textos de 'paciente' y 'tercero', en orden de turno_idx
}

interface EvalResult {
  casoId: string;
  capa: Capa;
  expected: Label;
  predicted: Label;             // nivel acumulado traducido al vocabulario del dataset
  signals: TriageSignal[];      // lo que las reglas sí detectaron — sin esto no se corrige nada
}
```

El mapeo entre el vocabulario del dataset y el de SPEC 10 es el mismo de la tabla de estados:
`verde ↔ green`, `amarillo ↔ yellow`, `rojo ↔ red`.

---

## Plan de implementación

1. **Dependencia y esqueleto.** `exceljs` como `devDependency` de `apps/api` —mantenida, de
   solo lectura para este uso, y sin los antecedentes de registro de SheetJS—. Script en
   `apps/api/src/evaluation/triage-eval.ts` con el patrón `tsx` de `seed.ts`, y el script
   `triage:eval` en `apps/api/package.json`. De momento solo abre el `.xlsx` e imprime el
   conteo de filas.
   **Verificación:** `pnpm --filter api run triage:eval` imprime `3991 turnos, 160 casos`; sin
   el dataset, aborta con el mensaje que indica correr `pnpm dataset:fetch` y código ≠ 0.

2. **Reconstrucción de los casos.** Agrupar por `caso_id` y `capa`, ordenar por `turno_idx`,
   quedarse con los textos de `paciente` y `tercero`, y leer `label_ground_truth` del caso
   —verificando que sea constante dentro del grupo, como promete el README—.
   **Verificación:** el script reporta 160 casos por capa y ninguna inconsistencia de
   etiqueta.

3. **Predicción.** Por cada caso, correr `evaluate()` de SPEC 10 turno a turno y acumular con
   la misma cadena que `ConversationService`: `mergeTriageAreas(areasPrevias, signals, [], false)`
   seguido de `maxLevel([nivelPrevio, ...signals.map((s) => s.level), accumulatedLevel(areasSiguientes)])`.
   `askedAreas` va vacío y `grouped` en `false` porque el evaluador no consume turnos del
   agente — y no altera el resultado: ambas entradas solo escriben `covered`, con
   `level: 'green'`, y `accumulatedLevel` solo cuenta áreas en `yellow`. El nivel final se
   traduce al vocabulario del dataset.
   **Verificación:** un caso rojo conocido del dataset predice `rojo`, y un caso con dos áreas
   amarillas distintas predice `rojo` por `accumulatedLevel`.

4. **Matriz y reporte.** Matriz 3×3 por capa, recall de rojos, falsos negativos separados en
   `rojo→verde` y `rojo→amarillo`, y la tabla de casos fallados con `caso_id`, esperado,
   predicho y señales detectadas. Salida por consola y escritura de `reports/triage-eval.md`.
   **Verificación:** el markdown se genera, se lee bien en GitHub y sus números cuadran con
   los de consola.

5. **Línea base commiteada.** Correr el evaluador, commitear `reports/triage-eval.md` con el
   resultado real, y anotar en el propio reporte la fecha, el commit de `triage.rules.ts`
   evaluado y la advertencia de que mide solo la rama determinística.

---

## Criterios de aceptación

- [ ] `pnpm --filter api run triage:eval` corre sin variables de entorno, sin base de datos y
      sin una sola llamada a un modelo.
- [ ] Sin `dataset-reto/`, aborta con un mensaje que nombra `pnpm dataset:fetch` y devuelve
      código distinto de cero.
- [ ] Reporta 160 casos en `capa1_limpia` y 160 en `capa2_ruidosa`, con matrices separadas.
- [ ] La distribución de referencia coincide con la del dataset: 123 verde, 25 amarillo,
      12 rojo por capa.
- [ ] Los turnos de `hablante = 'tercero'` entran como entrada; el conteo de turnos evaluados
      en capa 2 los incluye.
- [ ] Los turnos de `hablante = 'agente'` **no** entran: el evaluador clasifica lo que dice el
      paciente, no lo que pregunta el agente.
- [ ] El reporte lista **cada** caso fallado con su `caso_id`, la etiqueta esperada, la
      predicha y las señales que las reglas detectaron.
- [ ] Los falsos negativos aparecen separados en `rojo→verde` y `rojo→amarillo`.
- [ ] La acumulación usa `mergeTriageAreas` + `accumulatedLevel`, no solo `maxLevel` sobre las
      señales: un caso con dos áreas amarillas distintas sale `rojo`.
- [ ] `reports/triage-eval.md` queda commiteado, con fecha, commit evaluado y la advertencia
      de que mide solo la rama determinística.
- [ ] Dos corridas seguidas sobre el mismo dataset producen resultados idénticos.
- [ ] El script no llega a la imagen de producción: `apps/api/Dockerfile` sigue copiando solo
      `dist/` y `src/database/`.
- [ ] `pnpm lint` y `pnpm typecheck` en verde.

---

## Decisiones tomadas y descartadas

**Tomadas**

- **Evaluar solo la rama determinística, y decirlo.** Es lo único reproducible sin claves ni
  costo. La matriz es un piso: en producción las otras dos señales solo pueden subir la
  severidad. La rúbrica advierte que *"reportar números que no se sostienen es peor que no
  reportarlos"*.
- **Las dos capas por separado.** La caída de `capa1_limpia` a `capa2_ruidosa` mide cuánto se
  degrada el triage con evasivas, información faltante y un tercero interrumpiendo.
  Promediarlas escondería justo el número interesante.
- **Los turnos del `tercero` cuentan.** En una llamada real ese audio entra por el mismo
  micrófono. Si el familiar dice que el paciente está sangrando, el sistema debe reaccionar.
- **Los turnos del `agente` no cuentan.** Las preguntas del agente sintético contienen los
  nombres de los síntomas —"¿ha notado fiebre?"— y meterlas dispararía señales por el texto de
  la pregunta, no por el estado del paciente.
- **Reporte en `reports/triage-eval.md`, commiteado.** El dataset está en `.gitignore`, así que
  el resultado tiene que sobrevivir sin él. Es lo que se cita en el informe y en el video.
- **Criterio descriptivo, no puerta.** La primera corrida fija la línea base; el spec exige que
  el reporte exista, sea reproducible y liste los fallos uno a uno. Exigir cero falsos
  negativos presionaría a bajar umbrales hasta llenar el sistema de falsos positivos,
  optimizando contra 160 casos etiquetados por otro modelo.
- **`exceljs` como dependencia de desarrollo.** Mantenida y suficiente para lectura. No entra
  al runtime: el evaluador no es parte del producto.
- **El script vive fuera de `src/database/`.** `apps/api/Dockerfile` solo copia `dist/` y esa
  carpeta —la razón por la que `red-flag-phrases.ts` es `.ts` y no `.md`—, así que quedarse
  fuera es lo que garantiza que no llegue a producción.

**Descartadas**

- **Correr el evaluador en CI.** El dataset no está en el repo y clonarlo en cada corrida es
  peso sin beneficio. Se corre a mano y su resultado se commitea.
- **Ajustar los umbrales de `triage.rules.ts` con la matriz en la mano.** El evaluador mide, no
  optimiza. Mover un umbral es una decisión clínica con su propia justificación, no un ajuste
  de curva.
- **Evaluar el sistema completo levantando la app y reproduciendo las 160 conversaciones.**
  Serían miles de llamadas al LLM y a Deepgram, horas de corrida y un resultado no
  determinístico — justo lo contrario de lo que sirve para un informe.
- **Commitear un extracto del dataset en JSON para independizarse de `dataset:fetch`.**
  Duplica datos del organizador dentro de un repo público y hay que mantenerlos sincronizados.
- **Un endpoint o una vista que muestre la matriz.** Es una herramienta de desarrollo, no una
  funcionalidad del producto, y la rúbrica dice literal que la estética no puntúa.

---

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| La matriz sale mala y el número juega en contra en el informe | Es información útil aunque sea baja, y se reporta acompañada de lo que mide: solo reglas, sin las otras dos señales. Un recall de rojos honesto con su explicación es más defendible que no medir. La alternativa —callarlo— es lo que la rúbrica llama reportar números que no se sostienen. |
| Los textos del dataset no dicen magnitudes y las reglas no ven casi nada | Es un resultado, no un fallo del evaluador: significaría que la rama determinística depende más de lo que suponíamos del detector semántico. Se anota en el reporte y se decide aparte. |
| `label_ground_truth` no es constante dentro de un `caso_id` en alguna fila | El paso 2 lo verifica y lo reporta en vez de asumirlo. El README lo promete, pero el evaluador no depende de esa promesa. |
| El evaluador tienta a mover umbrales hasta que la matriz se vea bien | Está descartado explícitamente. Sobreajustar contra 160 casos etiquetados por otro modelo empeoraría el sistema real mientras mejora el número del informe. |
| `exceljs` engorda `node_modules` y roza los 15 minutos de G2 | Es `devDependency` y no entra a la imagen de `api`. G2 se cronometra sobre `docker compose up`, que nunca la instala. |

---

## Lo que **no** está en este spec

- La evaluación de `RedFlagDetectorService` y de la marca `[[ESCALAR]]` del modelo.
- Cualquier ajuste de los umbrales de `triage.rules.ts`.
- La ejecución en CI.
- Métricas de latencia, tokens y costo. → plan 04
- Cualquier superficie de producto —endpoint, vista— que exponga la matriz.
