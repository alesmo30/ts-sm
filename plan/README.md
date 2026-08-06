# Plan de ejecución — índice

Planes día a día para el Tech Sphere Challenge 2. Cada archivo es la base para generar specs concretos con `/spec` y luego implementar con `/spec-imp`.

| Día | Archivo | Objetivo | Horas |
|---|---|---|---|
| **D0** · mié 5 ago | [D0-mie-05-ago.md](D0-mie-05-ago.md) | Andamiaje ejecutable: `docker compose up` funcionando + diseño congelado | ~2h |
| **D1** · jue 6 ago | [D1-jue-06-ago.md](D1-jue-06-ago.md) | Front completo con mocks + voz end-to-end + capa agnóstica de LLM | 8h |
| **D2** · vie 7 ago | [D2-vie-07-ago.md](D2-vie-07-ago.md) | Día del anuncio: modelo obligatorio y dataset real enchufados | 8h |
| **D3** · sáb 8 ago | [D3-sab-08-ago.md](D3-sab-08-ago.md) | RAG clínico, trazabilidad, conocimiento vivo, triage | 8h |
| **D4** · dom 9 ago | [D4-dom-09-ago.md](D4-dom-09-ago.md) | Manos libres, latencia, tests. **Congelamiento 17:00** | 8h |
| **D5** · lun 10 ago | [D5-lun-10-ago.md](D5-lun-10-ago.md) | README, diagramas, informe, video, entrega | 8h |

## Documentos de referencia

| Archivo | Para qué |
|---|---|
| [`../REGLAS.md`](../REGLAS.md) | Harness de reglas. **Se lee antes de cada decisión técnica** |
| [`../DESIGN.md`](../DESIGN.md) | Sistema visual congelado. Gana sobre cualquier default de framework |
| [`../TECH-SPHERE-CHALLENGE.md`](../TECH-SPHERE-CHALLENGE.md) | Análisis completo del reto: rúbrica, presupuesto, propuestas |

## Las tres reglas que gobiernan el sprint

1. **Ningún módulo llama a un SDK de LLM directamente.** Todo pasa por `modules/llm`. Es lo que evita la descalificación y permite cambiar de modelo el viernes en minutos.
2. **El código se congela el domingo a las 17:00.** Los 30 puntos de documentación y video son los más baratos del puntaje y los que más gente deja tirados.
3. **La compuerta de 15 minutos se prueba en máquina limpia**, no se asume. Es eliminatoria y es la que más entregas tumba.

## Estado

- [ ] D0 — registro en el reto + andamiaje
- [ ] D1 — front y voz con mocks
- [ ] D2 — modelo y dataset reales
- [ ] D3 — RAG, trazabilidad, triage
- [ ] D4 — manos libres y congelamiento
- [ ] D5 — entrega
