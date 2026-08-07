import { validateLlmConfig } from './llm.config';
import { createLlmDriver } from './registry';
import { MockDriver } from './drivers/mock.driver';

describe('createLlmDriver', () => {
  it('devuelve el driver mock para LLM_PROVIDER=mock', () => {
    const config = validateLlmConfig({ LLM_PROVIDER: 'mock' });
    const driver = createLlmDriver(config);
    expect(driver).toBeInstanceOf(MockDriver);
  });

  it('un LLM_PROVIDER inválido aborta antes de llegar al registry', () => {
    expect(() => validateLlmConfig({ LLM_PROVIDER: 'basura' })).toThrow(/LLM_PROVIDER/);
  });

  it('openai y anthropic lanzan "no implementado todavía" (aún no registrados)', () => {
    const openaiConfig = validateLlmConfig({ LLM_PROVIDER: 'openai', LLM_MODEL: 'x', OPENAI_API_KEY: 'k' });
    expect(() => createLlmDriver(openaiConfig)).toThrow(/no implementado todavía/);

    const anthropicConfig = validateLlmConfig({
      LLM_PROVIDER: 'anthropic',
      LLM_MODEL: 'x',
      ANTHROPIC_API_KEY: 'k',
    });
    expect(() => createLlmDriver(anthropicConfig)).toThrow(/no implementado todavía/);
  });
});
