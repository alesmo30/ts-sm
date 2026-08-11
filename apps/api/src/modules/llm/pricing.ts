export interface ModelPricing {
  inputPerMTokUsd: number;
  outputPerMTokUsd: number;
}

// 'tarifa_publica': la tarifa de PRICING no se confirmó contra la consola del
// proveedor (ver spec 13, bloque A del plan 04). Cambiar a 'consola_confirmada'
// solo cuando alguien lo verifique con acceso a la consola real.
export const PRICING_SOURCE: 'tarifa_publica' | 'consola_confirmada' = 'tarifa_publica';

// Precios USD por millón de tokens. Se completa con los modelos conocidos al
// momento de implementar; un modelo ausente no es un error (ver priceFor).
export const PRICING: Record<string, ModelPricing> = {
  // Llama 3.3 70B Versatile vía Groq. Intento de verificación 2026-08-10 contra
  // https://groq.com/pricing: la página es un SPA que no expone la tabla de
  // precios al fetch automatizado, así que $0.59/$0.79 por millón de tokens
  // (entrada/salida) queda como la cifra pública conocida sin confirmación
  // directa — ni de la página ni de la consola de la cuenta del equipo (ver
  // PRICING_SOURCE). Antes de reportar costo en el README, confirmar a mano
  // en console.groq.com con la cuenta real.
  'llama-3.3-70b-versatile': { inputPerMTokUsd: 0.59, outputPerMTokUsd: 0.79 },
  'claude-3-5-sonnet-20241022': { inputPerMTokUsd: 3.0, outputPerMTokUsd: 15.0 },
  'claude-3-5-haiku-20241022': { inputPerMTokUsd: 0.8, outputPerMTokUsd: 4.0 },
  'gpt-4o-mini': { inputPerMTokUsd: 0.15, outputPerMTokUsd: 0.6 },
};

const ZERO_PRICING: ModelPricing = { inputPerMTokUsd: 0, outputPerMTokUsd: 0 };

export function priceFor(model: string): ModelPricing {
  return PRICING[model] ?? ZERO_PRICING;
}
