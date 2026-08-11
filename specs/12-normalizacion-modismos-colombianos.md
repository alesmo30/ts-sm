# SPEC 12 — Normalización de modismos colombianos para triage

> **Estado:** Implementado
> **Depende de:** SPEC 10, SPEC 11
> **Fecha:** 2026-08-10
> **Objetivo:** Agregar una capa de normalización de modismos y diminutivos del español coloquial colombiano antes de `evaluate()` —en producción y en el evaluador de SPEC 11 por igual— y volver a correr `triage-eval` para comparar recall contra la línea base ya commiteada.

---

## Alcance

**Dentro**

- Función nueva `normalizeColloquialSpeech(text: string): string` en `apps/api/src/modules/escalation/colloquial-glossary.ts` (o archivo equivalente dentro de `escalation/`) — reemplaza modismos/diminutivos por su forma clara, vía tabla de patrones determinística. Sin modelo, sin LLM: pura sustitución de texto.
- Se llama **antes** de `evaluate()` en los dos únicos lugares donde `evaluate()` se invoca hoy: `conversation.service.ts` (producción) y `triage-eval.ts` (evaluador). `triage.rules.ts` no se toca — cero cambios a umbrales o patrones existentes, la capa nueva es puramente previa.
- Glosario extenso, limitado a las 6 áreas que `triage.rules.ts` ya reconoce (dolor, fiebre, movilidad, herida, apetito, sueño). Cada entrada: `{ pattern: RegExp, replacement: string, origin: 'caso_fallado' | 'modismo_general' }`. Semilla: vocabulario de los 25 casos fallados en `reports/triage-eval.md` + modismos colombianos generales de esas mismas 6 áreas, buscados en la web.
- `triage-eval.ts` corre **dos pasadas** en la misma ejecución sobre el mismo dataset: sin normalización (debe reproducir exacto los números ya commiteados de SPEC 11 — guardia de no-regresión) y con normalización. Ambas matrices quedan lado a lado en `reports/triage-eval.md`, reemplazando el contenido actual del archivo.
- Criterio de éxito explícito: recall de rojo y amarillo sube con normalización, **sin** que la precisión de verde caiga — si un caso que hoy predice verde correctamente empieza a fallar por una entrada del glosario, esa entrada se ajusta o se saca.

**Fuera (para specs futuras o descartado)**

- Tocar umbrales, ventanas o patrones dentro de `triage.rules.ts` — sigue descartado desde SPEC 11, intacto.
- Modismos de otros países — glosario específico a Colombia.
- Normalizar el texto en cualquier otro consumo: retrieval del RAG, transcripción guardada, prompt al LLM. Solo se normaliza la copia de texto que entra a `evaluate()`, nunca lo que ve el médico o lo que arma la respuesta del asistente.
- Normalizar turnos del `agente` — igual que SPEC 11, el agente queda fuera del triage.
- Cualquier forma de traducción/normalización con modelo generativo — segundo LLM, prohibido por `REGLAS.md`.
- Evaluar `RedFlagDetectorService` o `[[ESCALAR]]` — sigue fuera, igual que SPEC 11.
- Correr en CI — mismo motivo que SPEC 11, dataset en `.gitignore`.

---

## Modelo de datos

No introduce tablas ni contratos nuevos — sigue la misma lógica que SPEC 11: estructuras internas de módulo, en memoria.

```ts
type ColloquialOrigin = 'caso_fallado' | 'modismo_general';

interface ColloquialEntry {
  pattern: RegExp;           // modismo/diminutivo colombiano a detectar
  replacement: string;       // forma clara que reconoce triage.rules.ts
  origin: ColloquialOrigin;  // trazabilidad: de dónde salió la entrada
  area: TriageArea;          // misma unión de SPEC 10 — para agrupar el glosario por área clínica
}
```

`normalizeColloquialSpeech(text: string): string` aplica cada `pattern.replacement` en orden sobre el texto y devuelve el resultado — función pura, sin dependencias, mismo estilo que `evaluate()`.

En `triage-eval.ts`, `EvalResult` gana un campo para distinguir la pasada:

```ts
interface EvalResult {
  casoId: string;
  capa: Capa;
  expected: Label;
  predicted: Label;
  signals: TriageSignal[];
  normalized: boolean;   // false = línea base SPEC 11, true = con glosario aplicado
}
```

---

## Plan de implementación

1. **Esqueleto del glosario y la función.** `apps/api/src/modules/escalation/colloquial-glossary.ts` con el tipo `ColloquialEntry`, un array inicial pequeño (2-3 entradas de prueba) y `normalizeColloquialSpeech(text)`. `colloquial-glossary.spec.ts` con casos concretos, incluido `'no me deja pegar el ojo'` → contiene `'dorm'` tras normalizar.
   **Verificación:** `pnpm --filter api test -- colloquial-glossary` en verde.

2. **Glosario extenso.** Llenar las 6 áreas con entradas mezclando `'caso_fallado'` (vocabulario de los 25 casos fallados en `reports/triage-eval.md`) y `'modismo_general'` (modismos colombianos de esas mismas áreas, investigados en la web). Sin patrones duplicados, cada entrada con su `area` correcta.
   **Verificación:** test que recorre el glosario y falla si dos entradas comparten `pattern.source`, o si falta alguna de las 6 áreas.

3. **Wiring en producción.** `normalizeColloquialSpeech(text)` se llama en `conversation.service.ts` justo antes de `evaluateTriage(text)` — únicamente para esa llamada. El texto que se guarda en `transcripts` y el que arma `retrievalQuery` para el RAG siguen siendo el original del paciente, sin tocar.
   **Verificación:** `conversation.service.spec.ts` sigue en verde, más un test nuevo que confirma que el transcript guardado no cambia aunque el triage sí detecte la señal normalizada.

4. **Wiring en el evaluador y segunda pasada.** `triage-eval.ts` corre dos pasadas sobre el mismo dataset: sin normalizar (debe reproducir exacto los números ya commiteados de SPEC 11 — guardia de no-regresión) y con `normalizeColloquialSpeech` aplicado antes de `evaluate()`. `EvalResult` gana `normalized`. El reporte muestra ambas matrices por capa, una junto a la otra.
   **Verificación:** la pasada sin normalizar iguala byte a byte los números de `reports/triage-eval.md` actual; la pasada normalizada corre sin errores.

5. **Corrida real, verificación de no-regresión y commit.** Correr el evaluador, confirmar que la precisión de verde no cae en ninguna capa y que recall de amarillo/rojo sube, commitear `reports/triage-eval.md` actualizado y el glosario con su justificación.
   **Verificación:** los números del paso 5 quedan en el reporte commiteado, con el resumen "antes vs. después" explícito.

---

## Criterios de aceptación

- [ ] `pnpm --filter api test -- colloquial-glossary` corre en verde, sin patrones duplicados y con las 6 áreas cubiertas.
- [ ] `normalizeColloquialSpeech('no me deja pegar el ojo')` produce un texto que `evaluate()` clasifica como señal de `sleep` en `yellow`.
- [ ] `conversation.service.spec.ts` sigue en verde tras el wiring.
- [ ] El transcript guardado en `sessions`/`transcripts` conserva el texto original del paciente, no el normalizado — solo la detección de triage usa la versión normalizada.
- [ ] `retrievalQuery` del RAG (SPEC 07/09) no cambia por esta capa — sigue construyéndose con el texto original.
- [ ] La pasada "sin normalizar" de `triage-eval.ts` reproduce exactamente los números ya commiteados en `reports/triage-eval.md` (SPEC 11) — cero regresión introducida por el wiring.
- [ ] La pasada "con normalizar" no baja la precisión de `verde` respecto a la pasada sin normalizar, en ninguna de las dos capas.
- [ ] La pasada "con normalizar" sube el recall de `amarillo` y/o `rojo` respecto a la línea base, en al menos una capa.
- [ ] `reports/triage-eval.md` queda commiteado con ambas matrices (sin/con normalizar) lado a lado por capa, más un resumen explícito de la diferencia.
- [ ] Cada entrada del glosario tiene `origin` (`'caso_fallado'` o `'modismo_general'`) y `area` — nada sin trazabilidad.
- [ ] `pnpm lint` y `pnpm typecheck` en verde.
- [ ] `triage.rules.ts` queda sin modificar — diff del archivo vacío contra el commit evaluado en SPEC 11.

---

## Decisiones tomadas y descartadas

**Tomadas**

- **Glosario mixto: casos fallados + investigación web.** Decisión explícita del usuario, con el riesgo de curve-fit conocido y aceptado. Mitigado con `origin` por entrada (trazabilidad) y el criterio de no-regresión en `verde` (punto 5) como freno real, no solo declarativo.
- **Normalización antes de `evaluate()`, sin tocar `triage.rules.ts`.** Mínimo blast radius: la capa nueva es un preprocesamiento externo, reversible, que no reabre ninguna decisión de SPEC 10 ni el "no ajustar umbrales" de SPEC 11.
- **Se aplica en producción, no solo en el evaluador.** Si el modismo es real, afecta la llamada real — limitarlo al evaluador sería inflar el número del informe sin mejorar el sistema. Consistente con el objetivo declarado del reto.
- **Solo la copia de texto que entra a triage se normaliza.** El transcript guardado y el `retrievalQuery` del RAG siguen con el texto original — no hay razón clínica ni de producto para que el médico vea texto reescrito, y tocar el RAG sería un cambio de alcance no pedido.
- **Sin modelo generativo para la normalización.** Tabla de patrones determinística. Un LLM para "traducir" modismos sería un segundo LLM generativo — prohibido por `REGLAS.md`, sin excepción posible.
- **Limitado a las 6 áreas de `triage.rules.ts`.** Un glosario general de español colombiano sin atarlo a esas áreas es un proyecto de NLP aparte, no esto.
- **Reporte único con ambas pasadas lado a lado.** `reports/triage-eval.md` se reemplaza (no se agrega un segundo archivo) — la comparación antes/después vive en el mismo lugar que cita el informe.

**Descartadas**

- **Ajustar umbrales o patrones de `triage.rules.ts`.** Sigue descartado desde SPEC 11 — ver diff-vacío como criterio de aceptación explícito.
- **Normalizar el texto del agente.** Fuera del triage desde SPEC 11, sin motivo para reabrirlo acá.
- **Traducción/normalización vía modelo (Gemini, Claude, etc.).** Prohibido por la regla de un solo LLM generativo del reto.
- **Glosario de modismos de otros países hispanohablantes.** El dataset y el reto son colombianos — ampliar la cobertura geográfica no tiene evidencia que lo justifique acá.

---

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| El glosario sobreajusta a los 25 casos fallados y no generaliza | `origin` por entrada da trazabilidad; criterio de no-regresión en verde actúa de freno medible, no solo de intención |
| Una entrada muy amplia introduce falsos positivos nuevos en casos hoy correctos | Punto 5 de scope y criterio de aceptación correspondiente: si `verde` cae, esa entrada se ajusta o se saca antes de commitear |
| El glosario no alcanza a resolver los otros dos problemas ya diagnosticados (ventana numérica corta, falta de contexto entre turnos) | Fuera de alcance explícito — esos dos quedan anotados para un spec futuro si se decide perseguirlos, no se prometen acá |
| La normalización de producción introduce latencia perceptible por turno | Es sustitución de texto por regex, sin llamada a red — costo despreciable frente a la llamada al LLM que ya ocurre por turno |
