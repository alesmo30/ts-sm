import { z, type ZodTypeAny } from 'zod';

import { LlmPort } from '../llm.port';
import type {
  LlmCompletion,
  LlmDelta,
  LlmMessage,
  LlmOptions,
  LlmStreamOptions,
  LlmStructured,
  LlmStructuredOptions,
} from '../llm.types';

const FIXED_RESPONSES = [
  'Entendido, voy a revisar la información del paciente antes de continuar.',
  'Según el protocolo indicado, conviene mantener reposo relativo durante las próximas 48 horas.',
  'No hay evidencia de complicaciones por ahora, pero conviene monitorear la temperatura.',
  'Registro esta observación en el resumen de la sesión para el equipo médico.',
];

const SIMULATED_DELAY_MS = 20;
const STREAM_FRAGMENT_DELAY_MS = 5;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

function mockValueForSchema(schema: ZodTypeAny): unknown {
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape as Record<string, ZodTypeAny>;
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(shape)) {
      result[key] = mockValueForSchema(shape[key]);
    }
    return result;
  }
  if (schema instanceof z.ZodString) return 'mock';
  if (schema instanceof z.ZodNumber) return 0;
  if (schema instanceof z.ZodBoolean) return true;
  if (schema instanceof z.ZodArray) return [mockValueForSchema(schema.element as ZodTypeAny)];
  if (schema instanceof z.ZodEnum) return (schema.options as unknown[])[0];
  if (schema instanceof z.ZodOptional) return mockValueForSchema(schema.unwrap());
  if (schema instanceof z.ZodNullable) return mockValueForSchema(schema.unwrap());
  if (schema instanceof z.ZodDefault) return mockValueForSchema(schema.removeDefault());
  if (schema instanceof z.ZodDate) return new Date();
  return null;
}

export class MockDriver extends LlmPort {
  readonly providerName = 'mock' as const;
  readonly modelId = 'mock';

  private callCount = 0;

  private nextResponse(): string {
    const response = FIXED_RESPONSES[this.callCount % FIXED_RESPONSES.length];
    this.callCount += 1;
    return response;
  }

  async complete(messages: LlmMessage[], _options?: LlmOptions): Promise<LlmCompletion> {
    const start = Date.now();
    await delay(SIMULATED_DELAY_MS);
    const text = this.nextResponse();
    const latencyMs = Date.now() - start;

    return {
      text,
      model: this.modelId,
      usage: {
        inputTokens: estimateTokens(messages.map((m) => m.content).join(' ')),
        outputTokens: estimateTokens(text),
        costUsd: 0,
      },
      latencyMs,
    };
  }

  async *stream(messages: LlmMessage[], _options?: LlmStreamOptions): AsyncIterable<LlmDelta> {
    const start = Date.now();
    const text = this.nextResponse();
    const words = text.split(' ');
    let emitted = '';

    for (const [index, word] of words.entries()) {
      await delay(STREAM_FRAGMENT_DELAY_MS);
      const fragment = index === 0 ? word : ` ${word}`;
      emitted += fragment;
      yield { type: 'text', text: fragment };
    }

    const latencyMs = Date.now() - start;
    const completion: LlmCompletion = {
      text: emitted,
      model: this.modelId,
      usage: {
        inputTokens: estimateTokens(messages.map((m) => m.content).join(' ')),
        outputTokens: estimateTokens(emitted),
        costUsd: 0,
      },
      latencyMs,
    };

    yield { type: 'done', completion };
  }

  async structured<T>(messages: LlmMessage[], options: LlmStructuredOptions<T>): Promise<LlmStructured<T>> {
    const start = Date.now();
    await delay(SIMULATED_DELAY_MS);
    const raw = mockValueForSchema(options.schema as unknown as ZodTypeAny);
    const data = options.schema.parse(raw);
    const latencyMs = Date.now() - start;

    return {
      data,
      model: this.modelId,
      usage: {
        inputTokens: estimateTokens(messages.map((m) => m.content).join(' ')),
        outputTokens: estimateTokens(JSON.stringify(data)),
        costUsd: 0,
      },
      latencyMs,
      usedFallbackParser: false,
    };
  }
}
