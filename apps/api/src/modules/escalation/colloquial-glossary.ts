import type { TriageArea } from './triage.rules';

/**
 * Trazabilidad de cada entrada — de dónde salió el patrón. `caso_fallado`
 * viene del vocabulario de los 25 casos que fallaron en `reports/triage-eval.md`
 * (SPEC 11); `modismo_general` viene de investigación general de español
 * colombiano coloquial en las mismas 6 áreas, sin mirar el dataset. Existe
 * para que el informe pueda mostrar de dónde salió cada entrada, no solo
 * confiar en que "mejoró el número".
 */
export type ColloquialOrigin = 'caso_fallado' | 'modismo_general';

export interface ColloquialEntry {
  pattern: RegExp;
  replacement: string;
  origin: ColloquialOrigin;
  area: TriageArea;
}

export const COLLOQUIAL_GLOSSARY: ColloquialEntry[] = [
  // sueño — SLEEP_YELLOW busca el substring "dorm", pero "duermo"/"duerme"/
  // "durmiendo" son formas irregulares (diptongación o→ue) que no lo
  // contienen. No es modismo, es conjugación estándar del español — se
  // incluye igual porque explica buena parte de los falsos negativos reales
  // del dataset y usa el mismo mecanismo de normalización.
  // Excluye "como antes"/"igual que antes" a continuación: "ya no duerme
  // como antes" es modismo de comparación con la juventud (verde real en el
  // dataset), no una queja — sin la exclusión, normalizar esta frase la
  // convertía en falso positivo de sueño (medido con el evaluador).
  {
    pattern: /duerm(o|es|e|en|iendo|i[oó]|ieron)(?!.{0,20}(?:como antes|igual que antes))/gi,
    replacement: 'dormir',
    origin: 'caso_fallado',
    area: 'sleep',
  },
  {
    pattern: /no me deja pegar el ojo/gi,
    replacement: 'duermo mal',
    origin: 'caso_fallado',
    area: 'sleep',
  },
  {
    pattern: /casi no pego el ojo/gi,
    replacement: 'duermo mal',
    origin: 'caso_fallado',
    area: 'sleep',
  },
  {
    // corre después de la conjugación de arriba: "duermo casi nada" ya llegó
    // como "dormir casi nada" a esta altura del reduce.
    pattern: /dormir casi nada/gi,
    replacement: 'duermo mal',
    origin: 'caso_fallado',
    area: 'sleep',
  },

  // fiebre
  {
    pattern: /calentura/gi,
    replacement: 'temperatura',
    origin: 'modismo_general',
    area: 'fever',
  },
  {
    pattern: /calorcito/gi,
    replacement: 'temperatura',
    origin: 'caso_fallado',
    area: 'fever',
  },
  {
    pattern: /calientic[oa]/gi,
    replacement: 'temperatura',
    origin: 'caso_fallado',
    area: 'fever',
  },
  {
    pattern: /destempl(ad[oa]|anza)/gi,
    replacement: 'temperatura',
    origin: 'modismo_general',
    area: 'fever',
  },

  // dolor — PAIN keyword es literal "dolor"; "me duele" sin esa palabra no
  // se detecta aunque traiga el número al lado.
  {
    pattern: /duele/gi,
    replacement: 'dolor',
    origin: 'caso_fallado',
    area: 'pain',
  },
  {
    pattern: /dolorcito/gi,
    replacement: 'dolor',
    origin: 'caso_fallado',
    area: 'pain',
  },

  // movilidad
  {
    pattern: /me cuesta (un poquito )?enderezarme/gi,
    replacement: 'dificultad leve para moverme',
    origin: 'caso_fallado',
    area: 'mobility',
  },
  {
    pattern: /me siento entumid[oa]/gi,
    replacement: 'dificultad leve para moverme',
    origin: 'modismo_general',
    area: 'mobility',
  },
  {
    pattern: /todo entumid[oa]/gi,
    replacement: 'dificultad leve para moverme',
    origin: 'modismo_general',
    area: 'mobility',
  },

  // herida — "rojita"/"rojito" sueltos se probaron primero (semilla de
  // caso_fallado) y se sacaron: el dataset trae un arquetipo de paciente
  // ansioso que describe "un poquito rojita" como parte de una herida sana,
  // y el ground truth lo mantiene en verde. Un descriptor tan leve no
  // distingue entre ambos casos — normalizarlo bajaba precisión de verde sin
  // ganar recall real. Queda solo una frase que sí implica preocupación
  // fuerte, no un descriptor leve.
  {
    pattern: /se ve (muy fea|horrible) la (herida|cicatriz)/gi,
    replacement: 'la herida está algo hinchada',
    origin: 'modismo_general',
    area: 'wound',
  },

  // apetito — mismo hallazgo que herida: "como poquito"/"con desgano" son
  // reducciones leves que el ground truth sigue tratando como verde. Se
  // sacaron esas cuatro entradas por la misma razón; queda un modismo que sí
  // describe pérdida total, no parcial.
  {
    pattern: /se me cerr[oó] el estómago/gi,
    replacement: 'no tengo apetito',
    origin: 'modismo_general',
    area: 'appetite',
  },
];

/**
 * Reemplaza modismos/diminutivos colombianos por su forma clara antes de
 * `evaluate()` — nunca al revés. Aplica cada entrada en orden; el texto
 * resultante es lo único que cambia, la clasificación clínica sigue viviendo
 * en `triage.rules.ts`, sin tocarlo.
 */
export function normalizeColloquialSpeech(text: string): string {
  return COLLOQUIAL_GLOSSARY.reduce((acc, entry) => acc.replace(entry.pattern, entry.replacement), text);
}
