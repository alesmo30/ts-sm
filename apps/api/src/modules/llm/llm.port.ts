import type { LlmCompletion, LlmMessage, LlmOptions } from './llm.types';

export abstract class LlmPort {
  abstract complete(messages: LlmMessage[], options?: LlmOptions): Promise<LlmCompletion>;
}
