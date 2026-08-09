# Plan 06 — Despliegue en la nube

> **Cuándo:** domingo 9 por la noche, con el código ya completo · **Presupuesto:** 2–2.5 horas
> **Cierra:** **G2** por la vía rápida (URL en vivo = 0 minutos) · elimina el riesgo de credenciales de G4
> **Depende de:** planes 01, 02 y 03 cerrados

## Objetivo en una frase

Dejar la solución corriendo en una URL pública, de modo que el jurado la evalúe sin instalar nada y sin que nuestras keys aparezcan nunca en el README.

## Por qué, y por qué no el lunes

G2 admite explícitamente una solución ya desplegada: *"siguiendo únicamente tu README —credenciales, URLs y accesos incluidos— la solución queda corriendo y accesible en 15 minutos o menos"*. Una URL en vivo son cero minutos.

El beneficio mayor **no es el tiempo, son las credenciales**. Desplegado, las keys de Groq, Deepgram y Gemini viven en variables de entorno del servidor. Desaparece el escenario de "documentamos nuestra key en el README y se agota entre el 10 y el 18 de agosto", que la rúbrica castiga con un único reintento de 24 horas.

**El domingo por la noche, no el lunes:** los deploys fallan la primera vez, y el lunes son los cuatro entregables. Desplegar código incompleto tampoco sirve — cada cambio obligaría a redesplegar.

## Reparto — Vercel solo no alcanza

| Pieza | Dónde | Notas |
|---|---|---|
| `apps/web` (Vite estático) | **Vercel** | Trivial. Variable `VITE_API_URL` apuntando al API desplegado. |
| `apps/api` (NestJS + WebSocket) | **Railway** (o Render / Fly.io) | Contenedor persistente. Ya tenemos `apps/api/Dockerfile`. |
| Postgres + pgvector | **Railway** (o Neon) | Junto al API para que la latencia interna sea mínima. |

**Por qué el API no va en Vercel:** Vercel sacó soporte de WebSocket en beta pública (junio 2026), pero las conexiones quedan clavadas a una instancia de función por su duración máxima, sin broadcast entre instancias, y NestJS es un proceso persistente, no serverless. Nuestro gateway de conversación es el corazón de la app — no es negociable.

## Decisiones ya cerradas

- **El README ofrece las dos vías.** *"Opción A: URL en vivo (0 min). Opción B: `docker compose up`"*. G2 pasa por la rápida; el criterio de repositorio reproducible se mantiene por la segunda. **La opción B tiene que seguir funcionando y probada** — no se abandona.
- **Migraciones y seed corren contra la base remota** una vez, con el mismo `drizzle-kit migrate` y `seed.ts` del entrypoint. Sin proceso nuevo.
- **El seed del corpus del plan 01 se carga también en remoto**, para que el RAG tenga material desde el primer minuto.
- **CORS y `VITE_API_URL`** son los dos puntos donde esto se rompe. Presupuestarlos.
- **`wss://`, no `ws://`.** El front en HTTPS no puede abrir un WebSocket inseguro; el cliente tiene que derivar el esquema del origen, no tenerlo fijo.

## Plan de implementación

1. **Base de datos.** Postgres con pgvector en Railway/Neon. Habilitar `CREATE EXTENSION vector`. Guardar `DATABASE_URL`.
2. **API.** Servicio en Railway desde `apps/api/Dockerfile`. Variables: `DATABASE_URL`, `LLM_PROVIDER`, `LLM_MODEL`, `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `VOICE_PROVIDER`, `DEEPGRAM_API_KEY`, y `GEMINI_API_KEY` si el plan 05 entró.
3. **Migraciones y seed** contra la base remota.
4. **Web.** Vercel desde `apps/web`, con `VITE_API_URL` apuntando al dominio del API.
5. **CORS y WebSocket.** Permitir el origen de Vercel en el API; verificar que el cliente abra `wss://`.
6. **Prueba completa en la URL pública**, no en local: conversación de voz, subida de documento, borrado, escalamiento.
7. **README** con las dos opciones y la URL en vivo arriba.

## Criterios de aceptación

- [ ] La URL pública carga `/paciente` y `/medico`.
- [ ] Una conversación completa funciona en la URL pública, con voz.
- [ ] El WebSocket conecta por `wss://` sin errores de contenido mixto.
- [ ] La demo de G5 (subir → cambia → borrar → vuelve) funciona en la URL pública.
- [ ] Ninguna key aparece en el repositorio ni en el README.
- [ ] **`docker compose up` en local sigue funcionando** — la opción B no se rompió.
- [ ] El README documenta las dos vías, con la URL primero.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| El deploy se cae durante la ventana de evaluación (10–18 ago) | La opción B (`docker compose`) queda viva y probada. Revisar la URL cada día de esa ventana. |
| Se come más de 2.5 h y arrastra al lunes | **Timebox duro: 2.5 h.** Si a esa hora no está en pie, se abandona y se entrega con `docker compose` + keys documentadas. No se toca el lunes. |
| El free tier del host duerme el contenedor por inactividad | Verificar la política del plan elegido. Un arranque en frío de 30 s durante la evaluación es aceptable; que no responda, no. |
| Las migraciones fallan contra la base remota | Correrlas y verificar con una consulta real antes de cablear el front. |
| Divergencia entre lo desplegado y el repositorio | Desplegar desde `main` ya mergeado. La rúbrica levanta bandera de integridad si el demo no corresponde al repositorio. |
