import { z } from 'zod';

const rawSchema = z.object({
  // Calibrado empíricamente contra gemini-embedding-001 (ver
  // specs/problema-escalamiento-bloque5.md, sección Resolución): la
  // similitud coseno base entre dos frases médicas cualesquiera de este
  // dominio ya ronda 0.60-0.78, así que un umbral cercano a 0.51 dispara
  // falsos positivos con mensajes benignos. 0.83 separa con margen los
  // negativos medidos (≤0.78) de los positivos reales (≥0.88).
  ESCALATION_SIMILARITY_THRESHOLD: z.coerce.number().default(0.83),
});

export interface EscalationConfig {
  similarityThreshold: number;
}

export function validateEscalationConfig(env: Record<string, unknown>): EscalationConfig {
  const parsed = rawSchema.safeParse(env);

  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`).join('\n');
    throw new Error(`Configuración de escalada inválida:\n${issues}`);
  }

  return {
    similarityThreshold: parsed.data.ESCALATION_SIMILARITY_THRESHOLD,
  };
}
