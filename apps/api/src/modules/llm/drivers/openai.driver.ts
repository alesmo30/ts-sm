import OpenAI from 'openai';
import type { ZodTypeAny } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

import { LlmPort } from '../llm.port';
import type {
  LlmCompletion,
  LlmDelta,
  LlmMessage,
  LlmOptions,
  LlmStreamOptions,
  LlmStructured,
  LlmStructuredOptions,
  LlmToolCall,
  LlmToolDefinition,
} from '../llm.types';
import { parseTolerantJson } from '../parse';

export interface OpenAiDriverConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

function toOpenAiMessages(messages: LlmMessage[]): OpenAI.Chat.ChatCompletionMessageParam[] {
  return messages.map((message): OpenAI.Chat.ChatCompletionMessageParam => {
    if (message.role === 'tool') {
      return { role: 'tool', content: message.content, tool_call_id: message.toolCallId ?? '' };
    }

    if (message.role === 'assistant' && message.toolCalls?.length) {
      return {
        role: 'assistant',
        content: message.content || null,
        tool_calls: message.toolCalls.map((toolCall) => ({
          id: toolCall.id,
          type: 'function',
          function: { name: toolCall.name, arguments: JSON.stringify(toolCall.arguments) },
        })),
      };
    }

    return { role: message.role, content: message.content };
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toJsonSchema(schema: any): Record<string, unknown> {
  return zodToJsonSchema(schema) as Record<string, unknown>;
}

function toOpenAiTools(tools?: LlmToolDefinition[]): OpenAI.Chat.ChatCompletionTool[] | undefined {
  if (!tools?.length) {
    return undefined;
  }

  return tools.map((tool) => ({
    type: 'function',
    function: { name: tool.name, description: tool.description, parameters: tool.parameters },
  }));
}

export class OpenAiDriver extends LlmPort {
  readonly providerName = 'openai' as const;
  readonly modelId: string;

  private readonly client: OpenAI;

  constructor(config: OpenAiDriverConfig, client?: OpenAI) {
    super();
    this.modelId = config.model;
    this.client = client ?? new OpenAI({ apiKey: config.apiKey, baseURL: config.baseUrl });
  }

  async complete(messages: LlmMessage[], options?: LlmOptions): Promise<LlmCompletion> {
    const start = Date.now();

    const response = await this.client.chat.completions.create({
      model: this.modelId,
      messages: toOpenAiMessages(messages),
      temperature: options?.temperature,
      max_tokens: options?.maxTokens,
    });

    const latencyMs = Date.now() - start;
    const choice = response.choices[0];

    return {
      text: choice.message.content ?? '',
      model: response.model,
      usage: {
        inputTokens: response.usage?.prompt_tokens ?? 0,
        outputTokens: response.usage?.completion_tokens ?? 0,
        costUsd: 0,
      },
      latencyMs,
    };
  }

  async *stream(messages: LlmMessage[], options?: LlmStreamOptions): AsyncIterable<LlmDelta> {
    const start = Date.now();
    let text = '';
    let usage: OpenAI.CompletionUsage | undefined;
    let modelUsed = this.modelId;
    const pendingToolCalls = new Map<number, { id: string; name: string; arguments: string }>();

    const stream = await this.client.chat.completions.create({
      model: this.modelId,
      messages: toOpenAiMessages(messages),
      temperature: options?.temperature,
      max_tokens: options?.maxTokens,
      tools: toOpenAiTools(options?.tools),
      stream: true,
      stream_options: { include_usage: true },
    });

    for await (const chunk of stream) {
      modelUsed = chunk.model || modelUsed;
      if (chunk.usage) {
        usage = chunk.usage;
      }

      const delta = chunk.choices[0]?.delta;
      if (!delta) {
        continue;
      }

      if (delta.content) {
        text += delta.content;
        yield { type: 'text', text: delta.content };
      }

      if (delta.tool_calls) {
        for (const toolCallDelta of delta.tool_calls) {
          const existing = pendingToolCalls.get(toolCallDelta.index) ?? { id: '', name: '', arguments: '' };
          if (toolCallDelta.id) existing.id = toolCallDelta.id;
          if (toolCallDelta.function?.name) existing.name = toolCallDelta.function.name;
          if (toolCallDelta.function?.arguments) existing.arguments += toolCallDelta.function.arguments;
          pendingToolCalls.set(toolCallDelta.index, existing);
        }
      }
    }

    const toolCalls: LlmToolCall[] = [];
    for (const pending of pendingToolCalls.values()) {
      const toolCall: LlmToolCall = {
        id: pending.id,
        name: pending.name,
        arguments: (parseTolerantJson(pending.arguments || '{}') as Record<string, unknown>) ?? {},
      };
      toolCalls.push(toolCall);
      yield { type: 'tool_call', toolCall };
    }

    const latencyMs = Date.now() - start;
    const completion: LlmCompletion = {
      text,
      model: modelUsed,
      usage: {
        inputTokens: usage?.prompt_tokens ?? 0,
        outputTokens: usage?.completion_tokens ?? 0,
        costUsd: 0,
      },
      latencyMs,
    };

    yield { type: 'done', completion };
  }

  async structured<T>(messages: LlmMessage[], options: LlmStructuredOptions<T>): Promise<LlmStructured<T>> {
    const start = Date.now();
    const jsonSchema = toJsonSchema(options.schema as unknown as ZodTypeAny);

    let usedFallbackParser = false;
    let response: OpenAI.Chat.Completions.ChatCompletion;

    try {
      response = await this.client.chat.completions.create({
        model: this.modelId,
        messages: toOpenAiMessages(messages),
        temperature: options.temperature,
        max_tokens: options.maxTokens,
        response_format: {
          type: 'json_schema',
          json_schema: { name: options.schemaName, schema: jsonSchema, strict: true },
        },
      });
    } catch {
      usedFallbackParser = true;

      const fallbackMessages: LlmMessage[] = [
        {
          role: 'system',
          content: `Responde únicamente con un objeto JSON, sin texto adicional, que cumpla este JSON Schema: ${JSON.stringify(jsonSchema)}`,
        },
        ...messages,
      ];

      response = await this.client.chat.completions.create({
        model: this.modelId,
        messages: toOpenAiMessages(fallbackMessages),
        temperature: options.temperature,
        max_tokens: options.maxTokens,
        response_format: { type: 'json_object' },
      });
    }

    const rawContent = response.choices[0].message.content ?? '';
    const usage = response.usage;
    const modelUsed = response.model;
    const parsedRaw = parseTolerantJson(rawContent);
    const data = options.schema.parse(parsedRaw);
    const latencyMs = Date.now() - start;

    return {
      data,
      model: modelUsed,
      usage: {
        inputTokens: usage?.prompt_tokens ?? 0,
        outputTokens: usage?.completion_tokens ?? 0,
        costUsd: 0,
      },
      latencyMs,
      usedFallbackParser,
    };
  }
}
