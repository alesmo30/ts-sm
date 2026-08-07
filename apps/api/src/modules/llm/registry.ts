import type { LlmConfig } from './llm.config';
import { LlmPort } from './llm.port';
import { MockDriver } from './drivers/mock.driver';

export function createLlmDriver(config: LlmConfig): LlmPort {
  switch (config.provider) {
    case 'mock':
      return new MockDriver();
    case 'openai':
      throw new Error('Driver openai no implementado todavía');
    case 'anthropic':
      throw new Error('Driver anthropic no implementado todavía');
  }
}
