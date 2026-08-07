import { validateLlmConfig } from './llm.config';

describe('validateLlmConfig', () => {
  it('LLM_PROVIDER=mock sin LLM_MODEL arranca correctamente', () => {
    const config = validateLlmConfig({ LLM_PROVIDER: 'mock' });
    expect(config.provider).toBe('mock');
  });

  it('LLM_PROVIDER inválido aborta nombrando la variable', () => {
    expect(() => validateLlmConfig({ LLM_PROVIDER: 'basura' })).toThrow(/LLM_PROVIDER/);
  });

  it('LLM_PROVIDER=openai sin OPENAI_API_KEY aborta nombrando la variable', () => {
    expect(() => validateLlmConfig({ LLM_PROVIDER: 'openai', LLM_MODEL: 'x' })).toThrow(/OPENAI_API_KEY/);
  });

  it('LLM_PROVIDER=openai sin LLM_MODEL aborta nombrando la variable', () => {
    expect(() => validateLlmConfig({ LLM_PROVIDER: 'openai', OPENAI_API_KEY: 'k' })).toThrow(/LLM_MODEL/);
  });

  it('LLM_PROVIDER=anthropic sin ANTHROPIC_API_KEY aborta nombrando la variable', () => {
    expect(() => validateLlmConfig({ LLM_PROVIDER: 'anthropic', LLM_MODEL: 'x' })).toThrow(/ANTHROPIC_API_KEY/);
  });

  it('LLM_PROVIDER=openai con LLM_MODEL y OPENAI_API_KEY arranca y expone la config', () => {
    const config = validateLlmConfig({
      LLM_PROVIDER: 'openai',
      LLM_MODEL: 'openai/gpt-oss-120b',
      OPENAI_API_KEY: 'k',
    });
    expect(config).toMatchObject({
      provider: 'openai',
      model: 'openai/gpt-oss-120b',
      openaiApiKey: 'k',
      openaiBaseUrl: 'https://api.openai.com/v1',
    });
  });
});
