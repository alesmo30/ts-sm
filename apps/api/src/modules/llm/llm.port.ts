import type {
  LlmCompletion,
  LlmDelta,
  LlmMessage,
  LlmOptions,
  LlmStreamOptions,
  LlmStructured,
  LlmStructuredOptions,
} from './llm.types';

export abstract class LlmPort {
  abstract complete(messages: LlmMessage[], options?: LlmOptions): Promise<LlmCompletion>;
  abstract stream(messages: LlmMessage[], options?: LlmStreamOptions): AsyncIterable<LlmDelta>;
  abstract structured<T>(messages: LlmMessage[], options: LlmStructuredOptions<T>): Promise<LlmStructured<T>>;
  abstract readonly providerName: 'mock' | 'anthropic' | 'openai';
  abstract readonly modelId: string;
}
