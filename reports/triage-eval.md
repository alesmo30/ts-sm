# Evaluación de triage — SPEC 11

**Fecha:** 2026-08-10
**Commit evaluado de `triage.rules.ts`:** 968a64d

> Esta matriz mide **solo la rama determinística** del triage (`triage.rules.ts`). `RedFlagDetectorService` (similitud semántica, requiere `GEMINI_API_KEY`) y la marca `[[ESCALAR]]` del modelo no están incluidas — no son reproducibles offline sin costo. En producción esas dos señales solo pueden subir la severidad, nunca bajarla: esta matriz es un **piso**, no el rendimiento del sistema completo.

## capa1_limpia

### Matriz de confusión (referencia × predicho)

| referencia \\ predicho | verde | amarillo | rojo |
| --- | --- | --- | --- |
| verde | 112 | 10 | 1 |
| amarillo | 18 | 2 | 5 |
| rojo | 3 | 6 | 3 |

**Recall de rojos:** 3/12

**Falsos negativos rojo→verde (catastrófico):** 3
**Falsos negativos rojo→amarillo (grave):** 6

### Casos fallados

| caso_id | esperado | predicho | señales detectadas |
| --- | --- | --- | --- |
| caso_tray_pac_42_00000_1 | verde | amarillo | fever:yellow |
| caso_tray_pac_42_00000_3 | amarillo | rojo | fever:yellow, wound:yellow, wound:yellow |
| caso_tray_pac_42_00000_7 | verde | amarillo | sleep:yellow |
| caso_tray_pac_42_00001_3 | amarillo | verde | (ninguna) |
| caso_tray_pac_42_00001_7 | amarillo | verde | (ninguna) |
| caso_tray_pac_42_00003_3 | amarillo | verde | (ninguna) |
| caso_tray_pac_42_00003_7 | amarillo | verde | (ninguna) |
| caso_tray_pac_42_00005_7 | verde | rojo | pain:red |
| caso_tray_pac_42_00006_3 | amarillo | verde | (ninguna) |
| caso_tray_pac_42_00006_7 | amarillo | verde | (ninguna) |
| caso_tray_pac_42_00010_3 | amarillo | verde | (ninguna) |
| caso_tray_pac_42_00010_7 | verde | amarillo | wound:yellow |
| caso_tray_pac_42_00012_3 | amarillo | verde | (ninguna) |
| caso_tray_pac_42_00012_7 | amarillo | verde | (ninguna) |
| caso_tray_pac_42_00013_3 | amarillo | verde | (ninguna) |
| caso_tray_pac_42_00015_3 | amarillo | verde | (ninguna) |
| caso_tray_pac_42_00016_1 | amarillo | verde | (ninguna) |
| caso_tray_pac_42_00017_7 | rojo | verde | (ninguna) |
| caso_tray_pac_42_00017_14 | rojo | amarillo | fever:yellow |
| caso_tray_pac_42_00019_1 | amarillo | verde | (ninguna) |
| caso_tray_pac_42_00019_3 | amarillo | rojo | pain:yellow, sleep:yellow |
| caso_tray_pac_42_00019_14 | rojo | amarillo | pain:yellow |
| caso_tray_pac_42_00021_7 | amarillo | rojo | fever:yellow, wound:yellow |
| caso_tray_pac_42_00022_3 | verde | amarillo | wound:yellow |
| caso_tray_pac_42_00024_1 | verde | amarillo | wound:yellow |
| caso_tray_pac_42_00025_7 | amarillo | verde | (ninguna) |
| caso_tray_pac_42_00026_3 | verde | amarillo | fever:yellow |
| caso_tray_pac_42_00026_14 | rojo | verde | (ninguna) |
| caso_tray_pac_42_00027_3 | amarillo | verde | (ninguna) |
| caso_tray_pac_42_00027_7 | rojo | amarillo | sleep:yellow |
| caso_tray_pac_42_00027_14 | rojo | amarillo | fever:yellow |
| caso_tray_pac_42_00028_1 | amarillo | verde | (ninguna) |
| caso_tray_pac_42_00028_7 | rojo | amarillo | pain:yellow |
| caso_tray_pac_42_00029_1 | verde | amarillo | fever:yellow |
| caso_tray_pac_42_00030_3 | amarillo | rojo | fever:yellow, sleep:yellow |
| caso_tray_pac_42_00030_7 | rojo | verde | (ninguna) |
| caso_tray_pac_42_00030_14 | rojo | amarillo | fever:yellow |
| caso_tray_pac_42_00034_14 | verde | amarillo | sleep:yellow |
| caso_tray_pac_42_00035_3 | verde | amarillo | fever:yellow |
| caso_tray_pac_42_00035_7 | amarillo | rojo | fever:yellow, wound:yellow |
| caso_tray_pac_42_00037_3 | verde | amarillo | pain:yellow |
| caso_tray_pac_42_00038_3 | amarillo | verde | (ninguna) |
| caso_tray_pac_42_00038_7 | amarillo | verde | (ninguna) |

## capa2_ruidosa

### Matriz de confusión (referencia × predicho)

| referencia \\ predicho | verde | amarillo | rojo |
| --- | --- | --- | --- |
| verde | 114 | 9 | 0 |
| amarillo | 18 | 4 | 3 |
| rojo | 3 | 6 | 3 |

**Recall de rojos:** 3/12

**Falsos negativos rojo→verde (catastrófico):** 3
**Falsos negativos rojo→amarillo (grave):** 6

### Casos fallados

| caso_id | esperado | predicho | señales detectadas |
| --- | --- | --- | --- |
| caso_tray_pac_42_00000_1 | verde | amarillo | fever:yellow |
| caso_tray_pac_42_00000_3 | amarillo | rojo | fever:yellow, wound:yellow, wound:yellow |
| caso_tray_pac_42_00000_7 | verde | amarillo | sleep:yellow |
| caso_tray_pac_42_00001_3 | amarillo | verde | (ninguna) |
| caso_tray_pac_42_00001_7 | amarillo | verde | (ninguna) |
| caso_tray_pac_42_00003_3 | amarillo | verde | (ninguna) |
| caso_tray_pac_42_00003_7 | amarillo | verde | (ninguna) |
| caso_tray_pac_42_00006_3 | amarillo | verde | (ninguna) |
| caso_tray_pac_42_00006_7 | amarillo | verde | (ninguna) |
| caso_tray_pac_42_00010_3 | amarillo | verde | (ninguna) |
| caso_tray_pac_42_00010_7 | verde | amarillo | wound:yellow |
| caso_tray_pac_42_00012_3 | amarillo | verde | (ninguna) |
| caso_tray_pac_42_00012_7 | amarillo | verde | (ninguna) |
| caso_tray_pac_42_00013_3 | amarillo | verde | (ninguna) |
| caso_tray_pac_42_00026_3 | verde | amarillo | fever:yellow |
| caso_tray_pac_42_00027_14 | rojo | amarillo | fever:yellow |
| caso_tray_pac_42_00027_3 | amarillo | verde | (ninguna) |
| caso_tray_pac_42_00027_7 | rojo | amarillo | sleep:yellow |
| caso_tray_pac_42_00028_1 | amarillo | verde | (ninguna) |
| caso_tray_pac_42_00028_7 | rojo | amarillo | pain:yellow |
| caso_tray_pac_42_00029_1 | verde | amarillo | fever:yellow |
| caso_tray_pac_42_00030_14 | rojo | amarillo | fever:yellow |
| caso_tray_pac_42_00030_3 | amarillo | rojo | fever:yellow, sleep:yellow |
| caso_tray_pac_42_00030_7 | rojo | verde | (ninguna) |
| caso_tray_pac_42_00034_14 | verde | amarillo | sleep:yellow |
| caso_tray_pac_42_00035_3 | verde | amarillo | fever:yellow |
| caso_tray_pac_42_00038_3 | amarillo | verde | (ninguna) |
| caso_tray_pac_42_00038_7 | amarillo | verde | (ninguna) |
| caso_tray_pac_42_00015_3 | amarillo | verde | (ninguna) |
| caso_tray_pac_42_00016_1 | amarillo | verde | (ninguna) |
| caso_tray_pac_42_00017_14 | rojo | amarillo | fever:yellow |
| caso_tray_pac_42_00017_7 | rojo | verde | (ninguna) |
| caso_tray_pac_42_00019_1 | amarillo | verde | (ninguna) |
| caso_tray_pac_42_00019_14 | rojo | amarillo | pain:yellow |
| caso_tray_pac_42_00021_7 | amarillo | rojo | fever:yellow, wound:yellow |
| caso_tray_pac_42_00022_3 | verde | amarillo | wound:yellow |
| caso_tray_pac_42_00024_1 | verde | amarillo | wound:yellow |
| caso_tray_pac_42_00025_7 | amarillo | verde | (ninguna) |
| caso_tray_pac_42_00026_14 | rojo | verde | (ninguna) |
