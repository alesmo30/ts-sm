import { chunkByParagraphs } from './chunker';

describe('chunkByParagraphs', () => {
  it('devuelve un solo chunk si el texto entero cabe en maxChars', () => {
    const text = 'Párrafo uno.\n\nPárrafo dos.';

    const chunks = chunkByParagraphs(text, 1000, 50);

    expect(chunks).toEqual(['Párrafo uno.\n\nPárrafo dos.']);
  });

  it('no corta un párrafo a la mitad al superar maxChars', () => {
    const p1 = 'a'.repeat(60);
    const p2 = 'b'.repeat(60);
    const text = `${p1}\n\n${p2}`;

    const chunks = chunkByParagraphs(text, 100, 10);

    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toBe(p1);
    expect(chunks[1].endsWith(p2)).toBe(true);
  });

  it('incluye solape del chunk anterior en el siguiente', () => {
    const p1 = 'a'.repeat(60);
    const p2 = 'b'.repeat(60);
    const text = `${p1}\n\n${p2}`;

    const chunks = chunkByParagraphs(text, 100, 10);

    expect(chunks[1].startsWith(p1.slice(-10))).toBe(true);
  });

  it('conserva un párrafo más largo que maxChars sin partirlo', () => {
    const longParagraph = 'x'.repeat(500);

    const chunks = chunkByParagraphs(longParagraph, 100, 10);

    expect(chunks).toEqual([longParagraph]);
  });

  it('ignora párrafos vacíos y espacios sobrantes', () => {
    const text = '\n\n  Párrafo real.  \n\n\n\n';

    const chunks = chunkByParagraphs(text, 1000, 10);

    expect(chunks).toEqual(['Párrafo real.']);
  });

  it('cae a partir por línea simple cuando no hay separadores de párrafo (texto tipo PDF)', () => {
    const lines = Array.from({ length: 5 }, (_, i) => `línea ${i} `.repeat(5)).join('\n');

    const chunks = chunkByParagraphs(lines, 100, 10);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join('\n\n')).not.toHaveLength(0);
  });

  it('devuelve arreglo vacío para texto vacío', () => {
    expect(chunkByParagraphs('', 1000, 10)).toEqual([]);
    expect(chunkByParagraphs('   \n\n  ', 1000, 10)).toEqual([]);
  });
});
