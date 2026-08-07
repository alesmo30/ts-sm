import Anthropic from '@anthropic-ai/sdk';
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

export interface AnthropicDriverConfig {
  apiKey: string;
  model: string;
}

const DEFAULT_MAX_TOKENS = 1024;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toJsonSchema(schema: any): Record<string, unknown> {
  return zodToJsonSchema(schema) as Record<string, unknown>;
}

interface SplitMessages {
  system: string | undefined;
  messages: Anthropic.Messages.MessageParam[];
}

function toAnthropicMessages(messages: LlmMessage[]): SplitMessages {
  const systemParts: string[] = [];
  const anthropicMessages: Anthropic.Messages.MessageParam[] = [];

  for (const message of messages) {
    if (message.role === 'system') {
      systemParts.push(message.content);
      continue;
    }

    if (message.role === 'tool') {
      anthropicMessages.push({
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: message.toolCallId ?? '', content: message.content }],
      });
      continue;
    }

    if (message.role === 'assistant' && message.toolCalls?.length) {
      const blocks: Anthropic.Messages.ContentBlockParam[] = [];
      if (message.content) {
        blocks.push({ type: 'text', text: message.content });
      }
      for (const toolCall of message.toolCalls) {
        blocks.push({ type: 'tool_use', id: toolCall.id, name: toolCall.name, input: toolCall.arguments });
      }
      anthropicMessages.push({ role: 'assistant', content: blocks });
      continue;
    }

    anthropicMessages.push({ role: message.role, content: message.content });
  }

  return {
    system: systemParts.length > 0 ? systemParts.join('\n\n') : undefined,
    messages: anthropicMessages,
  };
}

function toAnthropicTools(tools?: LlmToolDefinition[]): Anthropic.Messages.Tool[] | undefined {
  if (!tools?.length) {
    return undefined;
  }

  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.parameters as Anthropic.Messages.Tool.InputSchema,
  }));
}

function extractText(content: Anthropic.Messages.ContentBlock[]): string {
  return content
    .filter((block): block is Anthropic.Messages.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');
}

export class AnthropicDriver extends LlmPort {
  readonly providerName = 'anthropic' as const;
  readonly modelId: string;

  private readonly client: Anthropic;

  constructor(config: AnthropicDriverConfig, client?: Anthropic) {
    super();
    this.modelId = config.model;
    this.client = client ?? new Anthropic({ apiKey: config.apiKey });
  }

  async complete(messages: LlmMessage[], options?: LlmOptions): Promise<LlmCompletion> {
    const start = Date.now();
    const { system, messages: anthropicMessages } = toAnthropicMessages(messages);

    const response = await this.client.messages.create({
      model: this.modelId,
      system,
      messages: anthropicMessages,
      max_tokens: options?.maxTokens ?? DEFAULT_MAX_TOKENS,
      temperature: options?.temperature,
    });

    const latencyMs = Date.now() - start;

    return {
      text: extractText(response.content),
      model: response.model,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        costUsd: 0,
      },
      latencyMs,
    };
  }

  async *stream(messages: LlmMessage[], options?: LlmStreamOptions): AsyncIterable<LlmDelta> {
    const start = Date.now();
    const { system, messages: anthropicMessages } = toAnthropicMessages(messages);

    let text = '';
    let inputTokens = 0;
    let outputTokens = 0;
    let modelUsed = this.modelId;
    const pendingBlocks = new Map<number, { type: 'text' | 'tool_use'; id?: string; name?: string; json: string }>();

    const stream = await this.client.messages.create({
      model: this.modelId,
      system,
      messages: anthropicMessages,
      max_tokens: options?.maxTokens ?? DEFAULT_MAX_TOKENS,
      temperature: options?.temperature,
      tools: toAnthropicTools(options?.tools),
      stream: true,
    });

    for await (const event of stream) {
      if (event.type === 'message_start') {
        modelUsed = event.message.model;
        inputTokens = event.message.usage.input_tokens;
      }

      if (event.type === 'content_block_start') {
        if (event.content_block.type === 'tool_use') {
          pendingBlocks.set(event.index, {
            type: 'tool_use',
            id: event.content_block.id,
            name: event.content_block.name,
            json: '',
          });
        } else {
          pendingBlocks.set(event.index, { type: 'text', json: '' });
        }
      }

      if (event.type === 'content_block_delta') {
        const pending = pendingBlocks.get(event.index);
        if (event.delta.type === 'text_delta') {
          text += event.delta.text;
          yield { type: 'text', text: event.delta.text };
        }
        if (event.delta.type === 'input_json_delta' && pending) {
          pending.json += event.delta.partial_json;
        }
      }

      if (event.type === 'content_block_stop') {
        const pending = pendingBlocks.get(event.index);
        if (pending?.type === 'tool_use') {
          const toolCall: LlmToolCall = {
            id: pending.id ?? '',
            name: pending.name ?? '',
            arguments: (parseTolerantJson(pending.json || '{}') as Record<string, unknown>) ?? {},
          };
          yield { type: 'tool_call', toolCall };
        }
      }

      if (event.type === 'message_delta') {
        outputTokens = event.usage.output_tokens;
      }
    }

    const latencyMs = Date.now() - start;
    const completion: LlmCompletion = {
      text,
      model: modelUsed,
      usage: { inputTokens, outputTokens, costUsd: 0 },
      latencyMs,
    };

    yield { type: 'done', completion };
  }

  async structured<T>(messages: LlmMessage[], options: LlmStructuredOptions<T>): Promise<LlmStructured<T>> {
    const start = Date.now();
    const jsonSchema = toJsonSchema(options.schema as unknown as ZodTypeAny);
    const { system, messages: anthropicMessages } = toAnthropicMessages(messages);

    const response = await this.client.messages.create({
      model: this.modelId,
      system,
      messages: anthropicMessages,
      max_tokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
      temperature: options.temperature,
      tools: [{ name: options.schemaName, description: `Schema ${options.schemaName}`, input_schema: jsonSchema as Anthropic.Messages.Tool.InputSchema }],
      tool_choice: { type: 'tool', name: options.schemaName },
    });

    const toolUse = response.content.find(
      (block): block is Anthropic.Messages.ToolUseBlock => block.type === 'tool_use' && block.name === options.schemaName,
    );

    let usedFallbackParser = false;
    let parsedRaw: unknown;
    let inputTokens = response.usage.input_tokens;
    let outputTokens = response.usage.output_tokens;
    let modelUsed = response.model;

    if (toolUse) {
      parsedRaw = toolUse.input;
    } else {
      usedFallbackParser = true;

      const fallbackMessages = toAnthropicMessages([
        {
          role: 'system',
          content: `Responde únicamente con un objeto JSON, sin texto adicional, que cumpla este JSON Schema: ${JSON.stringify(jsonSchema)}`,
        },
        ...messages,
      ]);

      const fallbackResponse = await this.client.messages.create({
        model: this.modelId,
        system: fallbackMessages.system,
        messages: fallbackMessages.messages,
        max_tokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
        temperature: options.temperature,
      });

      inputTokens = fallbackResponse.usage.input_tokens;
      outputTokens = fallbackResponse.usage.output_tokens;
      modelUsed = fallbackResponse.model;
      parsedRaw = parseTolerantJson(extractText(fallbackResponse.content));
    }

    const data = options.schema.parse(parsedRaw);
    const latencyMs = Date.now() - start;

    return {
      data,
      model: modelUsed,
      usage: { inputTokens, outputTokens, costUsd: 0 },
      latencyMs,
      usedFallbackParser,
    };
  }
}
