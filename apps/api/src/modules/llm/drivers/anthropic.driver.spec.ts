import type Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

import { AnthropicDriver } from './anthropic.driver';

function makeDriver(create: jest.Mock): AnthropicDriver {
  const fakeClient = { messages: { create } } as unknown as Anthropic;
  return new AnthropicDriver({ apiKey: 'k', model: 'test-model' }, fakeClient);
}

describe('AnthropicDriver', () => {
  it('envía role:system en el parámetro system de nivel superior, no en el array de mensajes', async () => {
    const create = jest.fn().mockResolvedValue({
      model: 'test-model',
      content: [{ type: 'text', text: 'hola' }],
      usage: { input_tokens: 5, output_tokens: 2 },
    });
    const driver = makeDriver(create);

    await driver.complete([
      { role: 'system', content: 'Eres un asistente médico' },
      { role: 'user', content: 'hola' },
    ]);

    const body = create.mock.calls[0][0];
    expect(body.system).toBe('Eres un asistente médico');
    expect(body.messages).toEqual([{ role: 'user', content: 'hola' }]);
    expect(body.messages.some((m: { role: string }) => m.role === 'system')).toBe(false);
  });

  it('traduce role:tool a un mensaje user con un bloque tool_result que conserva el toolCallId', async () => {
    const create = jest.fn().mockResolvedValue({
      model: 'test-model',
      content: [{ type: 'text', text: 'ok' }],
      usage: { input_tokens: 5, output_tokens: 2 },
    });
    const driver = makeDriver(create);

    await driver.complete([
      { role: 'user', content: '¿Qué clima hace?' },
      { role: 'tool', content: '{"temp":20}', toolCallId: 'call_abc' },
    ]);

    const body = create.mock.calls[0][0];
    const toolResultMessage = body.messages[1];
    expect(toolResultMessage.role).toBe('user');
    expect(toolResultMessage.content).toEqual([{ type: 'tool_result', tool_use_id: 'call_abc', content: '{"temp":20}' }]);
  });

  it('usage.input_tokens de la respuesta llega a LlmUsage.inputTokens', async () => {
    const create = jest.fn().mockResolvedValue({
      model: 'test-model',
      content: [{ type: 'text', text: 'hola' }],
      usage: { input_tokens: 17, output_tokens: 4 },
    });
    const driver = makeDriver(create);

    const completion = await driver.complete([{ role: 'user', content: 'hola' }]);

    expect(completion.usage.inputTokens).toBe(17);
    expect(completion.usage.outputTokens).toBe(4);
    expect(completion.text).toBe('hola');
  });

  it('structured() usa el tool forzado y devuelve el input ya parseado', async () => {
    const create = jest.fn().mockResolvedValue({
      model: 'test-model',
      content: [{ type: 'tool_use', id: 'call_1', name: 'Greeting', input: { greeting: 'hola', count: 1 } }],
      usage: { input_tokens: 10, output_tokens: 5 },
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

  it('structured() cae al parser tolerante cuando no hay tool_use en la respuesta', async () => {
    const create = jest
      .fn()
      .mockResolvedValueOnce({
        model: 'test-model',
        content: [{ type: 'text', text: 'no puedo usar la herramienta' }],
        usage: { input_tokens: 10, output_tokens: 5 },
      })
      .mockResolvedValueOnce({
        model: 'test-model',
        content: [{ type: 'text', text: 'Aquí tienes: {"greeting":"hola","count":1}' }],
        usage: { input_tokens: 8, output_tokens: 3 },
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
