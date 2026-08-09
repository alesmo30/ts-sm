function splitUnits(text: string): string[] {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  // Texto extraído de PDF suele venir sin líneas en blanco entre párrafos
  // (una línea por `\n`, sin separador real). Sin más de una unidad no hay
  // nada que empaquetar, así que se cae a partir por línea simple.
  if (paragraphs.length > 1) {
    return paragraphs;
  }

  return text
    .split(/\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/**
 * Fragmenta texto por párrafos (separados por `\n\n`, o por línea si el texto
 * no trae separadores de párrafo reales) sin cortar ninguna unidad a la
 * mitad, respetando un techo de caracteres por chunk y un pequeño solape
 * entre chunks consecutivos para no perder contexto en el borde.
 */
export function chunkByParagraphs(text: string, maxChars: number, overlap: number): string[] {
  const units = splitUnits(text);

  if (units.length === 0) {
    return [];
  }

  const chunks: string[] = [];
  let current = '';

  for (const unit of units) {
    const candidate = current ? `${current}\n\n${unit}` : unit;

    if (candidate.length <= maxChars || current === '') {
      current = candidate;
      continue;
    }

    chunks.push(current);
    const tail = current.slice(Math.max(0, current.length - overlap));
    current = tail ? `${tail}\n\n${unit}` : unit;
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
}
