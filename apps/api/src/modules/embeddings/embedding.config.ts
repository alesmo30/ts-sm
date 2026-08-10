import { z } from 'zod';

const rawSchema = z.object({
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_EMBEDDING_MODEL: z.string().default('gemini-embedding-001'),
});

export interface EmbeddingConfig {
  apiKey?: string;
  model: string;
}

export function validateEmbeddingConfig(env: Record<string, unknown>): EmbeddingConfig {
  const parsed = rawSchema.safeParse(env);

  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`).join('\n');
    throw new Error(`Configuración de embeddings inválida:\n${issues}`);
  }

  const { GEMINI_API_KEY, GEMINI_EMBEDDING_MODEL } = parsed.data;

  return {
    apiKey: GEMINI_API_KEY,
    model: GEMINI_EMBEDDING_MODEL,
  };
}
