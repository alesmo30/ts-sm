import { z } from 'zod';

const rawSchema = z.object({
  LLM_PROVIDER: z.enum(['mock', 'anthropic', 'openai']).default('mock'),
  LLM_MODEL: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_BASE_URL: z.string().url().default('https://api.openai.com/v1'),
});

export interface LlmConfig {
  provider: 'mock' | 'anthropic' | 'openai';
  model: string;
  anthropicApiKey?: string;
  openaiApiKey?: string;
  openaiBaseUrl: string;
}

export function validateLlmConfig(env: Record<string, unknown>): LlmConfig {
  const parsed = rawSchema.safeParse(env);

  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`).join('\n');
    throw new Error(`Configuración de LLM inválida:\n${issues}`);
  }

  const { LLM_PROVIDER, LLM_MODEL, ANTHROPIC_API_KEY, OPENAI_API_KEY, OPENAI_BASE_URL } = parsed.data;

  if (LLM_PROVIDER !== 'mock' && !LLM_MODEL) {
    throw new Error(`Configuración de LLM inválida:\n  - LLM_MODEL: obligatorio cuando LLM_PROVIDER=${LLM_PROVIDER}`);
  }

  if (LLM_PROVIDER === 'anthropic' && !ANTHROPIC_API_KEY) {
    throw new Error('Configuración de LLM inválida:\n  - ANTHROPIC_API_KEY: obligatorio cuando LLM_PROVIDER=anthropic');
  }

  if (LLM_PROVIDER === 'openai' && !OPENAI_API_KEY) {
    throw new Error('Configuración de LLM inválida:\n  - OPENAI_API_KEY: obligatorio cuando LLM_PROVIDER=openai');
  }

  return {
    provider: LLM_PROVIDER,
    model: LLM_MODEL ?? 'mock',
    anthropicApiKey: ANTHROPIC_API_KEY,
    openaiApiKey: OPENAI_API_KEY,
    openaiBaseUrl: OPENAI_BASE_URL,
  };
}
