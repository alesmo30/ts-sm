export interface ModelPricing {
  inputPerMTokUsd: number;
  outputPerMTokUsd: number;
}

// Precios USD por millón de tokens. Se completa con los modelos conocidos al
// momento de implementar; un modelo ausente no es un error (ver priceFor).
export const PRICING: Record<string, ModelPricing> = {
  'llama-3.3-70b-versatile': { inputPerMTokUsd: 0.59, outputPerMTokUsd: 0.79 },
  'claude-3-5-sonnet-20241022': { inputPerMTokUsd: 3.0, outputPerMTokUsd: 15.0 },
  'claude-3-5-haiku-20241022': { inputPerMTokUsd: 0.8, outputPerMTokUsd: 4.0 },
  'gpt-4o-mini': { inputPerMTokUsd: 0.15, outputPerMTokUsd: 0.6 },
};

const ZERO_PRICING: ModelPricing = { inputPerMTokUsd: 0, outputPerMTokUsd: 0 };

export function priceFor(model: string): ModelPricing {
  return PRICING[model] ?? ZERO_PRICING;
}
