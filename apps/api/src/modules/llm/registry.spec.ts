import { AnthropicDriver } from './drivers/anthropic.driver';
import { MockDriver } from './drivers/mock.driver';
import { OpenAiDriver } from './drivers/openai.driver';
import { validateLlmConfig } from './llm.config';
import { createLlmDriver } from './registry';

describe('createLlmDriver', () => {
  it('devuelve el driver mock para LLM_PROVIDER=mock', () => {
    const config = validateLlmConfig({ LLM_PROVIDER: 'mock' });
    const driver = createLlmDriver(config);
    expect(driver).toBeInstanceOf(MockDriver);
  });

  it('un LLM_PROVIDER inválido aborta antes de llegar al registry', () => {
    expect(() => validateLlmConfig({ LLM_PROVIDER: 'basura' })).toThrow(/LLM_PROVIDER/);
  });

  it('devuelve el driver openai para LLM_PROVIDER=openai', () => {
    const config = validateLlmConfig({ LLM_PROVIDER: 'openai', LLM_MODEL: 'x', OPENAI_API_KEY: 'k' });
    const driver = createLlmDriver(config);
    expect(driver).toBeInstanceOf(OpenAiDriver);
    expect(driver.providerName).toBe('openai');
    expect(driver.modelId).toBe('x');
  });

  it('devuelve el driver anthropic para LLM_PROVIDER=anthropic', () => {
    const config = validateLlmConfig({
      LLM_PROVIDER: 'anthropic',
      LLM_MODEL: 'x',
      ANTHROPIC_API_KEY: 'k',
    });
    const driver = createLlmDriver(config);
    expect(driver).toBeInstanceOf(AnthropicDriver);
    expect(driver.providerName).toBe('anthropic');
    expect(driver.modelId).toBe('x');
  });
});
