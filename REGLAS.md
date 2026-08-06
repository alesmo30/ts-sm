# REGLAS.md — Harness del Tech Sphere Challenge 2

> **Este archivo se lee antes de cada decisión técnica.** No es documentación: es el conjunto de restricciones que, si se violan, invalidan el trabajo completo.
> Fuente: https://www.sourcemeridian.com/tech-sphere-challenge · Detalle completo en `TECH-SPHERE-CHALLENGE.md`

---

## 🔴 Nivel 0 — Descalifican o eliminan la entrega

Estas no se negocian. Fallar una sola vuelve irrelevante todo lo demás.

| # | Regla | Verificación |
|---|---|---|
| R0.1 | **Solo se puede usar el LLM obligatorio** que se anuncia el 7 de agosto. Usar otro descalifica la entrega | Todo acceso a LLM pasa por `modules/llm`. Cada llamada loguea el `model` usado. Grep del repo sin SDKs de otros proveedores activos |
| R0.2 | **Los 4 entregables completos**: repo, diagrama, informe, video | Checklist de D5 |
| R0.3 | **La solución corre en ≤15 minutos** siguiendo el README, con credenciales provistas | Prueba cronometrada en máquina limpia (D5) |
| R0.4 | **La conversación de voz en tiempo real funciona** | Demo grabada + modo texto de respaldo si falla el micrófono del evaluador |
| R0.5 | **Subir/eliminar conocimiento desde consola funciona** — el agente aprende y olvida | Demo en vivo: preguntar → subir → cambia → borrar → vuelve. Sin reiniciar |
| R0.6 | **Archivo `LICENSE` con Licencia MIT en la raíz** del repositorio | `ls LICENSE` + repo público en GitHub |
| R0.7 | **Sin informe final no se evalúa** la entrega | Entregable 3 |

---

## 🟡 Nivel 1 — Restricciones del reto

| # | Regla |
|---|---|
| R1.1 | Reto **individual**. Sin equipos, sin colaboradores |
| R1.2 | Solo **residentes en Colombia** |
| R1.3 | El agente conversa en **español**, con pacientes colombianos que usan regionalismos |
| R1.4 | **Todos los costos** de infraestructura, APIs y herramientas los paga el participante |
| R1.5 | El repositorio es **público** y bajo **licencia MIT** — el código queda accesible y reutilizable |
| R1.6 | Se otorga a Source Meridian licencia perpetua, mundial y libre de regalías sobre la entrega |
| R1.7 | El participante indemniza al organizador ante reclamos de PI de terceros |
| R1.8 | Fecha límite de entrega: **10 de agosto de 2026** |

---

## ✅ Qué SÍ hay que construir

1. **Conversación de voz adaptable** a las respuestas del paciente (no un árbol rígido de preguntas)
2. **RAG clínico** — respuestas fundamentadas en la base de conocimiento entregada
3. **Consola de conocimiento vivo** — subir y eliminar documentos en tiempo real
4. **Trazabilidad** — cada respuesta clínica registra su fuente documental
5. **Lógica de decisión** para alertar a personal humano
6. **Resumen estructurado** por cada llamada

Además, la ficha técnica del 7 de agosto exige reportar **latencia P50/P95, tokens y costo por llamada**.

---

## ❌ Qué NO hay que construir (no gastar tiempo ni dinero aquí)

- Telefonía real en producción (nada de Twilio/SIP)
- Integración con sistemas hospitalarios reales (HL7, FHIR, EMR)
- Autenticación empresarial, SSO o gestión de roles
- Cobertura de todos los procedimientos médicos

> Una web app con micrófono es entrega válida.

---

## ⚖️ Zona gris — la regla del LLM, interpretada

La regla dice **LLM**. El stack de voz y RAG está declarado libre. Criterio de este proyecto:

| Componente | ¿Permitido? | Razón |
|---|---|---|
| STT (Deepgram, Whisper) | ✅ Sí | Es ASR, no un LLM generativo. "Stack libre en voz" |
| TTS (Azure, ElevenLabs, Piper) | ✅ Sí | Síntesis de voz. "Stack libre en voz" |
| Embeddings (`multilingual-e5`, `bge-m3`) | ✅ Sí | Encoders, no generan lenguaje. "Stack libre en RAG" |
| Reranker (`bge-reranker-v2-m3`) | ✅ Sí | Cross-encoder, clasificador de relevancia |
| **LLM secundario para tareas auxiliares** | ❌ **No** | Aunque sea "solo para normalizar texto", se lee como usar otro modelo. **Todo lo generativo usa el modelo obligatorio** |
| **OpenAI Realtime / Gemini Live** | ❌ **No** | El modelo conversacional *es* un LLM de otro vendor. Descalificación casi segura |
| **LLM de otro vendor como fallback** | ❌ **No** | Ni siquiera como plan B silencioso |

**Obligación derivada:** el README lleva una sección **"Cumplimiento del modelo obligatorio"** que declara explícitamente:
> El 100% de la generación de lenguaje se ejecuta con `<modelo obligatorio>`. Los componentes de STT, TTS, embeddings y reranking son ASR/encoders, no LLMs, y el reglamento declara libre el stack de voz y RAG.

---

## 🔒 Reglas de seguridad clínica (autoimpuestas, suman puntos)

Estas no las exige el reto explícitamente, pero un jurado de una empresa de healthcare las va a buscar.

| # | Regla |
|---|---|
| RC.1 | El agente **nunca diagnostica** ni cambia medicación |
| RC.2 | **Sin fuente recuperada, no hay afirmación clínica.** Si no está en el contexto, se dice y se escala |
| RC.3 | Las **reglas determinísticas de banderas rojas solo pueden subir la severidad**, nunca bajarla. El LLM no puede desescalar una alerta disparada por regla |
| RC.4 | Si el paciente **pide hablar con un humano**, se escala de inmediato, sin negociar |
| RC.5 | Ante **emergencia detectada**, se interrumpe el guion y se da instrucción de urgencia |
| RC.6 | **Fallo técnico = escalamiento automático**, no disculpa pasiva. Si se cae el RAG, no se improvisa consejo médico |
| RC.7 | Ante **ambigüedad que podría ser bandera roja**, se pregunta o se escala. Nunca se asume el caso benigno |
| RC.8 | Disclaimer al inicio de la sesión: es un asistente automatizado de seguimiento |

---

## 🛡️ Reglas de seguridad del repositorio

El repo es **público**. Una clave filtrada es un incidente, no un descuido.

- `.env` **nunca** se commitea. Solo `.env.example` con valores de ejemplo.
- Antes del push final: `git ls-files` revisado, y búsqueda de secretos en el historial completo.
- Nada de datos clínicos reales de pacientes identificables en el repo.
- Sin dependencias GPL/AGPL (contaminan la licencia MIT y activan R1.7).
- Modelos ML y `node_modules` fuera del árbol versionado.

---

## 📐 Reglas de arquitectura del proyecto

Derivadas de las anteriores. Se aplican en cada PR mental.

| # | Regla | Por qué |
|---|---|---|
| RA.1 | **Ningún módulo llama a un SDK de LLM directamente.** Todo pasa por `modules/llm/llm.port.ts` | R0.1 — permite cambiar de modelo en minutos y demuestra el cumplimiento |
| RA.2 | **Todo corre con `docker compose up`**, sin cuentas externas obligatorias salvo el LLM | R0.3 |
| RA.3 | **Los modelos de embeddings se descargan en el `docker build`**, nunca en runtime | R0.3 — 500 MB de descarga se comen el presupuesto de 15 minutos |
| RA.4 | **El RAG no se acopla a Databricks.** Ingesta con dos fuentes: Delta Share y carpeta local | Si Delta Share falla el día de la evaluación, el sistema sigue funcionando |
| RA.5 | **STT y TTS son intercambiables por configuración**, con fallback a Web Speech API del navegador | R0.4 — el demo no puede depender de que una API externa esté viva |
| RA.6 | **El modo texto siempre está disponible** junto al modo voz | R0.4 — si el evaluador no tiene micrófono, igual puede probar el agente |
| RA.7 | **Cada respuesta clínica retorna sus citas** (`doc_id`, `chunk_id`, `version`, `kb_version`) | Requisito 4 de la entrega |
| RA.8 | **El borrado de conocimiento es soft-delete** + filtro en retrieval + invalidación de caché + refresco de BM25 | R0.5 — "olvidar" no es solo borrar el vector |
| RA.9 | **Las métricas (latencia, tokens, costo) se emiten automáticamente** por turno, no se calculan a mano | Exigencia de la ficha técnica |
| RA.10 | **Un solo entry point por capa.** Nada de cinco pipelines de RAG paralelos marcados "experimental" | Calidad de código, 15 pts |

---

## 🗓️ Fechas inamovibles

| Fecha | Hito |
|---|---|
| **7 ago 2026** | Cierre de registro · Se anuncia el modelo obligatorio · Llega dataset y ficha técnica |
| **10 ago 2026** | **Entrega de los 4 entregables** |
| 10–18 ago 2026 | Evaluación y anuncio de finalistas |
| 5 sep 2026 | Demo en vivo ante panel, Medellín o remoto |

**Regla de calendario autoimpuesta:** el código se congela el **domingo 9 a las 17:00**. El lunes 10 es solo documentación, video y entrega. Los 30 puntos de documentación y video se pierden por codear hasta el último minuto.

---

## 🎯 Dónde están los puntos (para decidir qué sacrificar)

| Criterio | Puntos | Prioridad de sacrificio |
|---|---|---|
| RAG, precisión clínica, conocimiento vivo, trazabilidad | 20 | 🔴 Nunca |
| Calidad de conversación de voz y UX | 20 | 🔴 Nunca |
| Arquitectura e implementación técnica | 15 | 🟡 Baja |
| Lógica de decisión y alertas | 15 | 🔴 Nunca |
| Calidad de código, documentación, reproducibilidad | 15 | 🟢 Se asegura en D5 |
| Video y respuestas a las preguntas de cierre | 15 | 🟢 Se asegura en D5 |

**30 de 100 puntos (documentación + video) se ganan con disciplina, no con genialidad técnica.** Es la parte más barata del puntaje y la que más gente deja tirada.

---

## ❓ Pendientes de confirmar con el organizador

- Duración exigida del video (no aparece en la página pública)
- Alcance literal de la regla del LLM respecto a embeddings y componentes auxiliares
- Contacto: communications@sourcemeridian.com · admon@sourcemeridian.com
