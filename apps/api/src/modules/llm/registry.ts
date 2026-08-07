import { AnthropicDriver } from './drivers/anthropic.driver';
import { MockDriver } from './drivers/mock.driver';
import { OpenAiDriver } from './drivers/openai.driver';
import type { LlmConfig } from './llm.config';
import { LlmPort } from './llm.port';

export function createLlmDriver(config: LlmConfig): LlmPort {
  switch (config.provider) {
    case 'mock':
      return new MockDriver();
    case 'openai':
      return new OpenAiDriver({
        apiKey: config.openaiApiKey ?? '',
        baseUrl: config.openaiBaseUrl,
        model: config.model,
      });
    case 'anthropic':
      return new AnthropicDriver({ apiKey: config.anthropicApiKey ?? '', model: config.model });
  }
}
