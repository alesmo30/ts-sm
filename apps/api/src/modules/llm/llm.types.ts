export interface LlmUsage {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmCompletion {
  text: string;
  model: string;
  usage: LlmUsage;
  latencyMs: number;
}

export interface LlmOptions {
  temperature?: number;
  maxTokens?: number;
}
