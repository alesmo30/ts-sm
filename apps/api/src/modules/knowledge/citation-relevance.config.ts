import { z } from 'zod';

const rawSchema = z.object({
  // Calibrado con gemini-embedding-001 contra la base de conocimiento real
  // (ver specs/problema-escalamiento-bloque5.md, sección Resolución): el
  // retrieval léxico (ts_rank) siempre devuelve top-K aunque solo coincida
  // una palabra genérica ("control", "cita") con documentos irrelevantes, y
  // ts_rank no distingue eso de un match real — el score léxico de ambos
  // casos cae en el mismo rango. La similitud coseno de embeddings entre la
  // pregunta y el fragmento sí separa: coincidencias reales midieron 0.75-0.80,
  // coincidencias por palabra suelta midieron 0.52-0.64. 0.7 separa con margen.
  CITATION_RELEVANCE_THRESHOLD: z.coerce.number().default(0.7),
});

export interface CitationRelevanceConfig {
  threshold: number;
}

export function validateCitationRelevanceConfig(env: Record<string, unknown>): CitationRelevanceConfig {
  const parsed = rawSchema.safeParse(env);

  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`).join('\n');
    throw new Error(`Configuración de relevancia de citas inválida:\n${issues}`);
  }

  return {
    threshold: parsed.data.CITATION_RELEVANCE_THRESHOLD,
  };
}
