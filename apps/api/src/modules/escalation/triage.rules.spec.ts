import { evaluate, maxLevel } from './triage.rules';

describe('triage.rules', () => {
  describe('fiebre', () => {
    it('37.4 no genera señal', () => {
      expect(evaluate('Tengo fiebre de 37.4')).toEqual([]);
    });

    it('38.4 clasifica amarillo', () => {
      const [signal] = evaluate('Tengo fiebre de 38.4');
      expect(signal).toMatchObject({ area: 'fever', level: 'yellow', value: 38.4 });
    });

    it('38.5 clasifica rojo — el borde exacto', () => {
      const [signal] = evaluate('Tengo fiebre de 38.5');
      expect(signal).toMatchObject({ area: 'fever', level: 'red', value: 38.5 });
    });

    it('reconoce el número antes del término ("39 de fiebre")', () => {
      const [signal] = evaluate('Tengo 39 de fiebre desde anoche');
      expect(signal).toMatchObject({ area: 'fever', level: 'red', value: 39 });
    });

    it('regresión (dataset real): reconoce el número con un conector largo ("ha estado rondando los")', () => {
      const [signal] = evaluate('la temperatura ha estado rondando los 37.6 grados, no sé si eso cuente como fiebre');
      expect(signal).toMatchObject({ area: 'fever', level: 'yellow', value: 37.6 });
    });
  });

  describe('dolor', () => {
    it('4 no genera señal', () => {
      expect(evaluate('Mi dolor es de 4')).toEqual([]);
    });

    it('7 clasifica amarillo', () => {
      const [signal] = evaluate('Mi dolor es de 7');
      expect(signal).toMatchObject({ area: 'pain', level: 'yellow', value: 7 });
    });

    it('8 clasifica rojo — el borde exacto', () => {
      const [signal] = evaluate('Mi dolor es de 8');
      expect(signal).toMatchObject({ area: 'pain', level: 'red', value: 8 });
    });

    it('"dolor de ocho" (palabra, no dígito) clasifica rojo', () => {
      const [signal] = evaluate('Tengo un dolor de ocho');
      expect(signal).toMatchObject({ area: 'pain', level: 'red', value: 8 });
    });
  });

  it('un texto sin señales reconocibles devuelve una lista vacía', () => {
    expect(evaluate('Todo está tranquilo, gracias por preguntar.')).toEqual([]);
  });

  it('un turno con dos síntomas devuelve una señal por cada área', () => {
    const signals = evaluate('fiebre de 39 y dolor de 9');
    expect(signals).toHaveLength(2);
    expect(signals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ area: 'fever', level: 'red' }),
        expect.objectContaining({ area: 'pain', level: 'red' }),
      ]),
    );
  });

  it('un número de otra cláusula de la misma frase no contamina la lectura del área vecina', () => {
    // Regresión: una ventana simétrica alrededor de la palabra clave alguna vez
    // hizo que "fiebre" leyera el "7" de "dolor de 7" en vez de su propio "38".
    const signals = evaluate('dolor de 7 y fiebre de 38');
    expect(signals).toHaveLength(2);
    expect(signals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ area: 'pain', level: 'yellow', value: 7 }),
        expect.objectContaining({ area: 'fever', level: 'yellow', value: 38 }),
      ]),
    );
  });

  describe('movilidad', () => {
    it('limitación leve clasifica amarillo', () => {
      const [signal] = evaluate('Me cuesta caminar un poco desde la cirugía');
      expect(signal).toMatchObject({ area: 'mobility', level: 'yellow' });
    });

    it('movilidad incapacitante clasifica rojo', () => {
      const [signal] = evaluate('No puedo caminar para nada');
      expect(signal).toMatchObject({ area: 'mobility', level: 'red' });
    });

    it('regresión (dataset real): "no hay ninguna dificultad para moverme" no genera señal', () => {
      expect(
        evaluate('Se siente bien, no hay ninguna dificultad para moverme o caminar, casi todo normal'),
      ).toEqual([]);
    });

    it('"sin dificultad para caminar" no genera señal', () => {
      expect(evaluate('Estoy sin dificultad para caminar hoy')).toEqual([]);
    });
  });

  describe('herida', () => {
    it('eritema leve clasifica amarillo', () => {
      const [signal] = evaluate('La herida está un poco roja');
      expect(signal).toMatchObject({ area: 'wound', level: 'yellow' });
    });

    it('no clasifica rojo por texto — esa señal la cubre RedFlagDetectorService', () => {
      expect(evaluate('La herida tiene pus')).toEqual([]);
    });

    it('"sin enrojecimiento ni hinchazón" no genera señal', () => {
      expect(evaluate('La herida está bien, sin secreción ni enrojecimiento, se ve normal')).toEqual([]);
    });

    it('regresión (dataset real): "la herida sigue con un leve enrojecimiento" clasifica amarillo', () => {
      const [signal] = evaluate('la herida sigue con un leve enrojecimiento y el dolor sigue en un 2');
      expect(signal).toMatchObject({ area: 'wound', level: 'yellow' });
    });

    it('"enrojecimiento leve" (orden inverso) también clasifica amarillo', () => {
      const [signal] = evaluate('Se nota un enrojecimiento leve alrededor de la sutura');
      expect(signal).toMatchObject({ area: 'wound', level: 'yellow' });
    });
  });

  describe('apetito y sueño', () => {
    it('pérdida de apetito clasifica amarillo', () => {
      const [signal] = evaluate('No tengo apetito desde ayer');
      expect(signal).toMatchObject({ area: 'appetite', level: 'yellow' });
    });

    it('pérdida de sueño clasifica amarillo', () => {
      const [signal] = evaluate('No he podido dormir bien');
      expect(signal).toMatchObject({ area: 'sleep', level: 'yellow' });
    });
  });

  describe('maxLevel', () => {
    it('devuelve green con una lista vacía', () => {
      expect(maxLevel([])).toBe('green');
    });

    it('devuelve el nivel más severo de la lista', () => {
      expect(maxLevel(['green', 'yellow', 'green'])).toBe('yellow');
      expect(maxLevel(['yellow', 'red', 'green'])).toBe('red');
    });

    it('respeta RC.3: nunca se puede bajar un nivel ya alcanzado', () => {
      expect(maxLevel(['red', 'green'])).toBe('red');
    });
  });
});
