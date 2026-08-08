/**
 * Limpia marcado Markdown que el LLM a veces emite pese al system prompt
 * (negritas, encabezados, viñetas). El asistente es de voz — nada de esto se
 * debe leer ni verse en la burbuja como "asterisco asterisco".
 * Aplicado por chunk de delta, no al texto completo: puede fallar en un
 * marcador partido justo en el borde de dos chunks (caso raro, se acepta).
 */
export function sanitizeAssistantText(chunk: string): string {
  return chunk
    .replace(/\*\*/g, '')
    .replace(/__/g, '')
    .replace(/`+/g, '')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/^[-*]\s+/gm, '')
    .replace(/#/g, '');
}
