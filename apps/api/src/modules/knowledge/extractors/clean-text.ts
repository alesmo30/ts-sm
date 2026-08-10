// Bytes de control (excepto tab/newline/CR) que algunos PDFs con fuentes
// corruptas dejan en el texto extraído y que Postgres UTF8 rechaza directamente.
// Misma lista que database/kb-ingest.ts.
const CONTROL_CHAR_CODES = Array.from({ length: 32 }, (_, code) => code).filter(
  (code) => code !== 9 && code !== 10 && code !== 13,
);
const CONTROL_CHARS_REGEX = new RegExp(
  `[${CONTROL_CHAR_CODES.map((code) => String.fromCharCode(code)).join('')}]`,
  'g',
);

export function cleanExtractedText(text: string): string {
  return text.replace(CONTROL_CHARS_REGEX, '').trim();
}
