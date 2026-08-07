import type { ZodType } from 'zod';

export interface LlmUsage {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

// 'tool' transporta el resultado de una herramienta de vuelta al modelo.
// Anthropic lo expresa como un bloque tool_result dentro de un mensaje user;
// OpenAI como un mensaje con role:'tool'. El driver traduce; el puerto no se entera.
export interface LlmMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string; // obligatorio cuando role === 'tool'
  toolCalls?: LlmToolCall[]; // presente cuando role === 'assistant' y el modelo pidió herramientas
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

export interface LlmToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema
}

export interface LlmToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>; // ya parseado; OpenAI lo entrega como string
}

// Evento normalizado de streaming. Anthropic emite content_block_delta,
// OpenAI emite choices[].delta — los dos se aplanan a esto.
export type LlmDelta =
  | { type: 'text'; text: string }
  | { type: 'tool_call'; toolCall: LlmToolCall }
  | { type: 'done'; completion: LlmCompletion };

export interface LlmStreamOptions extends LlmOptions {
  tools?: LlmToolDefinition[];
}

export interface LlmStructuredOptions<T> extends LlmOptions {
  schema: ZodType<T>;
  schemaName: string; // algunos proveedores lo exigen en el json_schema nativo
}

export interface LlmStructured<T> {
  data: T;
  model: string;
  usage: LlmUsage;
  latencyMs: number;
  usedFallbackParser: boolean; // true si el proveedor no soportó JSON schema nativo
}
