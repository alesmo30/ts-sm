import { parseTolerantJson } from './parse';

describe('parseTolerantJson', () => {
  it('parsea JSON directo', () => {
    expect(parseTolerantJson('{"a":1}')).toEqual({ a: 1 });
  });

  it('recupera el objeto envuelto en una valla de código ```json', () => {
    const raw = '```json\n{"a":1,"b":"x"}\n```';
    expect(parseTolerantJson(raw)).toEqual({ a: 1, b: 'x' });
  });

  it('recupera el objeto precedido y seguido de texto en prosa', () => {
    const raw = 'Aquí está el resultado: {"a":1} espero que ayude';
    expect(parseTolerantJson(raw)).toEqual({ a: 1 });
  });

  it('recupera un objeto que contiene una llave } dentro de un valor string', () => {
    const raw = '{"a":"contiene } una llave","b":2}';
    expect(parseTolerantJson(raw)).toEqual({ a: 'contiene } una llave', b: 2 });
  });

  it('lanza un error con parte del texto recibido cuando no hay JSON recuperable', () => {
    expect(() => parseTolerantJson('lo siento, no puedo')).toThrow(/lo siento, no puedo/);
  });
});
