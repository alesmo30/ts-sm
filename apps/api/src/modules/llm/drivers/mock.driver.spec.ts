import { z } from 'zod';

import { MockDriver } from './mock.driver';

describe('MockDriver', () => {
  it('rota entre cuatro respuestas y la quinta repite la primera', async () => {
    const driver = new MockDriver();
    const messages = [{ role: 'user' as const, content: 'hola' }];

    const texts: string[] = [];
    for (let i = 0; i < 5; i += 1) {
      const completion = await driver.complete(messages);
      texts.push(completion.text);
    }

    expect(new Set(texts.slice(0, 4)).size).toBe(4);
    expect(texts[4]).toBe(texts[0]);
  });

  it('stream() emite al menos dos deltas de texto antes de done', async () => {
    const driver = new MockDriver();
    const messages = [{ role: 'user' as const, content: 'hola' }];

    const deltas = [];
    for await (const delta of driver.stream(messages)) {
      deltas.push(delta);
    }

    const textDeltas = deltas.filter((d) => d.type === 'text');
    expect(textDeltas.length).toBeGreaterThanOrEqual(2);
    expect(deltas[deltas.length - 1].type).toBe('done');
  });

  it('la concatenación de los deltas de texto iguala el text del completion final', async () => {
    const driver = new MockDriver();
    const messages = [{ role: 'user' as const, content: 'hola' }];

    let concatenated = '';
    let doneDelta;
    for await (const delta of driver.stream(messages)) {
      if (delta.type === 'text') {
        concatenated += delta.text;
      }
      if (delta.type === 'done') {
        doneDelta = delta;
      }
    }

    expect(doneDelta?.completion.text).toBe(concatenated);
  });

  it('structured() devuelve un objeto que satisface el schema recibido', async () => {
    const driver = new MockDriver();
    const messages = [{ role: 'user' as const, content: 'hola' }];
    const schema = z.object({ greeting: z.string(), count: z.number() });

    const result = await driver.structured(messages, { schema, schemaName: 'Greeting' });

    expect(() => schema.parse(result.data)).not.toThrow();
    expect(result.usedFallbackParser).toBe(false);
  });

  it('expone providerName y modelId', () => {
    const driver = new MockDriver();
    expect(driver.providerName).toBe('mock');
    expect(driver.modelId).toBe('mock');
  });
});
