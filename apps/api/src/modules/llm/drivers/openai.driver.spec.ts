import type OpenAI from 'openai';
import { z } from 'zod';

import { OpenAiDriver } from './openai.driver';

function makeDriver(create: jest.Mock): OpenAiDriver {
  const fakeClient = { chat: { completions: { create } } } as unknown as OpenAI;
  return new OpenAiDriver({ apiKey: 'k', baseUrl: 'https://example.test/v1', model: 'test-model' }, fakeClient);
}

describe('OpenAiDriver', () => {
  it('complete() traduce la respuesta a LlmCompletion', async () => {
    const create = jest.fn().mockResolvedValue({
      model: 'test-model',
      choices: [{ message: { content: 'hola desde openai' } }],
      usage: { prompt_tokens: 5, completion_tokens: 3 },
    });
    const driver = makeDriver(create);

    const completion = await driver.complete([{ role: 'user', content: 'hola' }]);

    expect(completion.text).toBe('hola desde openai');
    expect(completion.model).toBe('test-model');
    expect(completion.usage).toEqual({ inputTokens: 5, outputTokens: 3, costUsd: 0 });
  });

  it('stream() produce un delta tool_call con arguments ya parseado como objeto', async () => {
    async function* chunks() {
      yield {
        model: 'test-model',
        choices: [
          {
            delta: {
              tool_calls: [{ index: 0, id: 'call_1', function: { name: 'get_weather', arguments: '{"city":' } }],
            },
          },
        ],
      };
      yield {
        model: 'test-model',
        choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '"Bogotá"}' } }] } }],
      };
      yield { model: 'test-model', choices: [{ delta: {} }], usage: { prompt_tokens: 10, completion_tokens: 4 } };
    }

    const create = jest.fn().mockResolvedValue(chunks());
    const driver = makeDriver(create);

    const deltas = [];
    for await (const delta of driver.stream([{ role: 'user', content: 'clima en Bogotá' }])) {
      deltas.push(delta);
    }

    const toolCallDelta = deltas.find((d) => d.type === 'tool_call');
    expect(toolCallDelta?.toolCall.arguments).toEqual({ city: 'Bogotá' });
    expect(typeof toolCallDelta?.toolCall.arguments).toBe('object');
  });

  it('structured() usa el camino nativo cuando el proveedor lo acepta', async () => {
    const create = jest.fn().mockResolvedValue({
      model: 'test-model',
      choices: [{ message: { content: '{"greeting":"hola","count":1}' } }],
      usage: { prompt_tokens: 8, completion_tokens: 2 },
    });
    const driver = makeDriver(create);
    const schema = z.object({ greeting: z.string(), count: z.number() });

    const result = await driver.structured([{ role: 'user', content: 'saluda' }], {
      schema,
      schemaName: 'Greeting',
    });

    expect(result.data).toEqual({ greeting: 'hola', count: 1 });
    expect(result.usedFallbackParser).toBe(false);
  });

  it('structured() cae al parser tolerante cuando el proveedor rechaza json_schema', async () => {
    const create = jest
      .fn()
      .mockRejectedValueOnce(new Error('response_format no soportado'))
      .mockResolvedValueOnce({
        model: 'test-model',
        choices: [{ message: { content: 'Aquí está: {"greeting":"hola","count":1} gracias' } }],
        usage: { prompt_tokens: 8, completion_tokens: 2 },
      });
    const driver = makeDriver(create);
    const schema = z.object({ greeting: z.string(), count: z.number() });

    const result = await driver.structured([{ role: 'user', content: 'saluda' }], {
      schema,
      schemaName: 'Greeting',
    });

    expect(result.data).toEqual({ greeting: 'hola', count: 1 });
    expect(result.usedFallbackParser).toBe(true);
    expect(create).toHaveBeenCalledTimes(2);
  });
});
