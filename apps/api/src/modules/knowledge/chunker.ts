/**
 * Fragmenta texto por párrafos (separados por `\n\n`) sin cortar ninguno a la
 * mitad, respetando un techo de caracteres por chunk y un pequeño solape
 * entre chunks consecutivos para no perder contexto en el borde.
 */
export function chunkByParagraphs(text: string, maxChars: number, overlap: number): string[] {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  if (paragraphs.length === 0) {
    return [];
  }

  const chunks: string[] = [];
  let current = '';

  for (const paragraph of paragraphs) {
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;

    if (candidate.length <= maxChars || current === '') {
      current = candidate;
      continue;
    }

    chunks.push(current);
    const tail = current.slice(Math.max(0, current.length - overlap));
    current = tail ? `${tail}\n\n${paragraph}` : paragraph;
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
}
