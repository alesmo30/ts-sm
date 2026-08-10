// Misma heurística de stopwords que database/kb-ingest.ts, extraída para que
// el pipeline de ingesta en runtime (SPEC 08) y el script bulk compartan un
// solo criterio de qué es español y qué es inglés.
const SPANISH_STOPWORDS = [
  'de',
  'la',
  'el',
  'en',
  'que',
  'los',
  'las',
  'una',
  'para',
  'con',
  'por',
  'del',
  'como',
  'más',
  'su',
  'al',
];

const ENGLISH_STOPWORDS = [
  'the',
  'and',
  'of',
  'to',
  'in',
  'is',
  'for',
  'with',
  'that',
  'on',
  'as',
  'are',
  'by',
  'an',
  'from',
];

export type DetectedLanguage = 'spanish' | 'english';

export function detectLanguage(text: string): DetectedLanguage {
  const lower = text.toLowerCase();
  const countMatches = (words: string[]): number =>
    words.reduce((total, word) => {
      const matches = lower.match(new RegExp(`\\b${word}\\b`, 'g'));
      return total + (matches?.length ?? 0);
    }, 0);

  const spanishScore = countMatches(SPANISH_STOPWORDS);
  const englishScore = countMatches(ENGLISH_STOPWORDS);

  return englishScore > spanishScore ? 'english' : 'spanish';
}
