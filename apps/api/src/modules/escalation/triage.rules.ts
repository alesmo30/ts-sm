/**
 * Reglas determinísticas de triage clínico (SPEC 10). Función pura, sin
 * dependencias: cubre lo que RedFlagDetectorService (similitud semántica) no
 * mide bien — magnitudes numéricas — y el nivel amarillo, que hoy no existe
 * en ningún lado. No duplica las señales que RED_FLAG_PHRASES ya cubre
 * (pus, sangrado abundante, disnea, dolor insoportable): esas siguen siendo
 * responsabilidad exclusiva del backstop semántico.
 */
export type TriageArea = 'pain' | 'fever' | 'mobility' | 'wound' | 'appetite' | 'sleep';
export type TriageLevel = 'green' | 'yellow' | 'red';

export interface TriageSignal {
  area: TriageArea;
  level: TriageLevel;
  alert: string;
  value?: number;
}

const LEVEL_ORDER: Record<TriageLevel, number> = { green: 0, yellow: 1, red: 2 };

/** Combina niveles quedándose con el más severo. Base 'green' si la lista está vacía. */
export function maxLevel(levels: TriageLevel[]): TriageLevel {
  return levels.reduce<TriageLevel>((max, level) => (LEVEL_ORDER[level] > LEVEL_ORDER[max] ? level : max), 'green');
}

export const ALL_AREAS: TriageArea[] = ['pain', 'fever', 'mobility', 'wound', 'appetite', 'sleep'];

export const AREA_LABELS: Record<TriageArea, string> = {
  pain: 'dolor',
  fever: 'fiebre',
  mobility: 'movilidad',
  wound: 'herida',
  appetite: 'apetito',
  sleep: 'sueño',
};

export interface TriageAreaState {
  covered: 'no' | 'individual' | 'grouped';
  level: TriageLevel;
  value?: number;
}
export type TriageAreas = Partial<Record<TriageArea, TriageAreaState>>;

const AREA_KEYWORDS: Record<TriageArea, RegExp> = {
  pain: /dolor/i,
  fever: /fiebre|temperatura/i,
  mobility: /moviliz|caminar|moverte|levantarte|desplazarte/i,
  wound: /herida|cicatriz/i,
  appetite: /apetito|comer|comiendo|hambre/i,
  sleep: /dormir|sueño|descansa/i,
};

/** Áreas que el turno anterior del asistente preguntó, detectadas por palabra clave —
 * es lo que permite marcar un área cubierta aunque la respuesta del paciente no
 * produzca ninguna señal clínica (p. ej. "dolor 2" es una respuesta válida). */
export function detectAskedAreas(assistantText: string): TriageArea[] {
  return ALL_AREAS.filter((area) => AREA_KEYWORDS[area].test(assistantText));
}

/** Áreas todavía sin cubrir — lo que se inyecta en el prompt como agenda pendiente. */
export function pendingAreas(areas: TriageAreas): TriageArea[] {
  return ALL_AREAS.filter((area) => !areas[area] || areas[area]?.covered === 'no');
}

/** "fiebre, herida, apetito y sueño" — para nombrar la agenda pendiente en el prompt. */
export function formatAreaList(areas: TriageArea[]): string {
  const labels = areas.map((area) => AREA_LABELS[area]);
  if (labels.length === 0) return '';
  if (labels.length === 1) return labels[0];
  return `${labels.slice(0, -1).join(', ')} y ${labels[labels.length - 1]}`;
}

/**
 * Fusiona las señales de un turno con el estado acumulado de áreas de la sesión.
 * Nunca "descubre" un área ya cubierta: `covered` solo puede pasar de 'no' a
 * 'individual'/'grouped', nunca al revés. Si `grouped` es true, todas las áreas
 * que sigan pendientes tras aplicar señales y preguntas de este turno se
 * marcan cubiertas por confirmación agrupada — una señal de alarma en el mismo
 * turno ya dejó su área en 'individual' antes de llegar a esta etapa, así que
 * nunca queda enmascarada como confirmación agrupada.
 */
export function mergeTriageAreas(
  current: TriageAreas,
  signals: TriageSignal[],
  askedAreas: TriageArea[],
  grouped: boolean,
): TriageAreas {
  const next: TriageAreas = { ...current };

  for (const area of askedAreas) {
    const existing = next[area];
    if (!existing) {
      next[area] = { covered: 'individual', level: 'green' };
    }
  }

  for (const signal of signals) {
    const existing = next[signal.area];
    next[signal.area] = {
      covered: 'individual',
      level: maxLevel([existing?.level ?? 'green', signal.level]),
      value: signal.value ?? existing?.value,
    };
  }

  if (grouped) {
    for (const area of ALL_AREAS) {
      if (!next[area] || next[area]?.covered === 'no') {
        next[area] = { covered: 'grouped', level: next[area]?.level ?? 'green' };
      }
    }
  }

  return next;
}

/** RC.3 aplicado a la cobertura: dos o más áreas en amarillo elevan la sesión a rojo. */
export function accumulatedLevel(areas: TriageAreas): TriageLevel {
  const yellowCount = Object.values(areas).filter((state) => state?.level === 'yellow').length;
  return yellowCount >= 2 ? 'red' : 'green';
}

// Palabras cortas para dolor en letra, más allá de dígitos — lo que el STT no
// siempre transcribe como número. Deliberadamente corta: lo que no reconozca
// esta lista lo cubre RedFlagDetectorService por similitud semántica.
const PAIN_WORDS: Record<string, number> = { ocho: 8, nueve: 9, diez: 10 };

/**
 * Busca un número asociado a `keyword` (dígito o palabra de la lista), anclado
 * a la propia ocurrencia del término — no una ventana simétrica alrededor de
 * él. Un número que pertenece a otra cláusula de la misma frase ("dolor de 7 y
 * fiebre de 38") nunca contamina la lectura del otro término, porque cada
 * patrón busca desde `keyword` hacia adelante primero, y solo hacia atrás con
 * el conector explícito "de" como único puente permitido.
 */
function findNumberNearKeyword(text: string, keyword: RegExp, wordMap?: Record<string, number>): number | undefined {
  // Ventana amplia (30) a propósito: solo busca hacia adelante desde `keyword`,
  // nunca hacia atrás, así que no puede volver a cruzar hacia el número de otra
  // cláusula (ver comentario de arriba) — ampliarla solo cubre conectores
  // largos ("ha estado rondando los", "ha estado cerca de") sin reabrir esa fuga.
  const afterMatch = text.match(new RegExp(`(?:${keyword.source})[^\\d]{0,30}?(\\d{1,2}(?:[.,]\\d)?)`, 'i'));
  if (afterMatch) return parseFloat(afterMatch[1].replace(',', '.'));

  const beforeMatch = text.match(new RegExp(`(\\d{1,2}(?:[.,]\\d)?)\\s*de\\s*(?:${keyword.source})`, 'i'));
  if (beforeMatch) return parseFloat(beforeMatch[1].replace(',', '.'));

  if (wordMap) {
    for (const [word, value] of Object.entries(wordMap)) {
      if (new RegExp(`(?:${keyword.source})[^\\d]{0,30}?\\b${word}\\b`, 'i').test(text)) return value;
    }
  }

  return undefined;
}

function evaluateFever(text: string): TriageSignal | undefined {
  const value = findNumberNearKeyword(text, /fiebre|temperatura/);
  if (value === undefined) return undefined;
  if (value >= 38.5) return { area: 'fever', level: 'red', alert: `Fiebre de ${value}°C reportada.`, value };
  if (value >= 37.5) return { area: 'fever', level: 'yellow', alert: `Fiebre de ${value}°C reportada.`, value };
  return undefined;
}

function evaluatePain(text: string): TriageSignal | undefined {
  const value = findNumberNearKeyword(text, /dolor/, PAIN_WORDS);
  if (value === undefined) return undefined;
  if (value >= 8) return { area: 'pain', level: 'red', alert: `Dolor reportado en ${value}/10.`, value };
  if (value >= 5) return { area: 'pain', level: 'yellow', alert: `Dolor reportado en ${value}/10.`, value };
  return undefined;
}

// Patrones "amarillos" describen un síntoma leve en positivo ("dificultad
// para moverme", "un poco roja") — una negación externa justo antes
// ("no hay ninguna dificultad", "sin enrojecimiento") invierte el sentido a
// "sin novedad" y no debe contar como señal. Los patrones "rojos" no llevan
// esta guarda: en ellos la negación ES el síntoma ("no puedo caminar").
const NEGATION_BEFORE = /\b(no|sin|ningun[oa]?|nada de)\b/i;

function matchesUnnegated(text: string, patterns: RegExp[]): boolean {
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (!match) continue;
    const preceding = text.slice(Math.max(0, match.index - 20), match.index);
    if (!NEGATION_BEFORE.test(preceding)) return true;
  }
  return false;
}

const MOBILITY_RED = [/no puedo (moverme|caminar|levantarme|pararme)/i, /inmoviliz/i, /no me puedo (mover|levantar|parar)/i];
const MOBILITY_YELLOW = [/me cuesta (moverme|caminar)/i, /dificultad (leve )?para (moverme|caminar)/i, /cojeo/i];

function evaluateMobility(text: string): TriageSignal | undefined {
  if (MOBILITY_RED.some((re) => re.test(text))) {
    return { area: 'mobility', level: 'red', alert: 'Movilidad incapacitante nueva reportada.' };
  }
  if (matchesUnnegated(text, MOBILITY_YELLOW)) {
    return { area: 'mobility', level: 'yellow', alert: 'Limitación leve de movilidad reportada.' };
  }
  return undefined;
}

// Solo amarillo — el rojo (secreción purulenta, sangrado abundante) ya lo
// cubre RED_FLAG_PHRASES por similitud semántica. Duplicarlo aquí sería una
// segunda fuente de verdad para la misma señal.
// "enrojec" (no "enrojecid") para cubrir tanto la forma adjetiva
// (enrojecida/enrojecido) como la sustantiva (enrojecimiento), la más común
// en habla natural ("un leve enrojecimiento").
const WOUND_NEAR_HERIDA = /(herida|cicatriz)([^.]{0,25})(un poco roja|rojita|algo hinchada|enrojec)/i;
const WOUND_STANDALONE = [/enrojecimiento leve/i, /leve enrojec/i];

function evaluateWound(text: string): TriageSignal | undefined {
  // La negación puede caer en el conector entre "herida" y el síntoma
  // ("herida... sin... enrojecimiento") — no antes de todo el match, por eso
  // este patrón se revisa aparte con su propio grupo de conector.
  const nearHerida = WOUND_NEAR_HERIDA.exec(text);
  if (nearHerida && !NEGATION_BEFORE.test(nearHerida[2])) {
    return { area: 'wound', level: 'yellow', alert: 'Eritema leve reportado en la herida.' };
  }
  if (matchesUnnegated(text, WOUND_STANDALONE)) {
    return { area: 'wound', level: 'yellow', alert: 'Eritema leve reportado en la herida.' };
  }
  return undefined;
}

const APPETITE_YELLOW = [/no tengo apetito/i, /perd[ií] el apetito/i, /no he (comido|querido comer)/i, /sin ganas de comer/i, /se me quit[oó] el hambre/i];

function evaluateAppetite(text: string): TriageSignal | undefined {
  if (APPETITE_YELLOW.some((re) => re.test(text))) {
    return { area: 'appetite', level: 'yellow', alert: 'Pérdida marcada de apetito reportada.' };
  }
  return undefined;
}

const SLEEP_YELLOW = [/no (he podido |puedo )?dorm/i, /duermo mal/i, /insomnio/i, /no descanso/i];

function evaluateSleep(text: string): TriageSignal | undefined {
  if (SLEEP_YELLOW.some((re) => re.test(text))) {
    return { area: 'sleep', level: 'yellow', alert: 'Pérdida marcada de sueño reportada.' };
  }
  return undefined;
}

/** Evalúa un turno de texto del paciente y devuelve una señal por área detectada. */
export function evaluate(text: string): TriageSignal[] {
  return [
    evaluateFever(text),
    evaluatePain(text),
    evaluateMobility(text),
    evaluateWound(text),
    evaluateAppetite(text),
    evaluateSleep(text),
  ].filter((signal): signal is TriageSignal => signal !== undefined);
}
