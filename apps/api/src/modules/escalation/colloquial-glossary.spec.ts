import { COLLOQUIAL_GLOSSARY, normalizeColloquialSpeech } from './colloquial-glossary';
import { ALL_AREAS, evaluate } from './triage.rules';

describe('colloquial-glossary', () => {
  it('normaliza "no me deja pegar el ojo" a una forma que triage.rules reconoce', () => {
    const normalized = normalizeColloquialSpeech('doctor, no me deja pegar el ojo desde la operación');
    const [signal] = evaluate(normalized);
    expect(signal).toMatchObject({ area: 'sleep', level: 'yellow' });
  });

  it('el texto normalizado dispara señal de sleep en amarillo', () => {
    const normalized = normalizeColloquialSpeech('no me deja pegar el ojo');
    const [signal] = evaluate(normalized);
    expect(signal).toMatchObject({ area: 'sleep', level: 'yellow' });
  });

  it('no tiene patrones duplicados en el glosario', () => {
    const sources = COLLOQUIAL_GLOSSARY.map((entry) => entry.pattern.source);
    expect(new Set(sources).size).toBe(sources.length);
  });

  it('cubre las 6 áreas de triage.rules', () => {
    const covered = new Set(COLLOQUIAL_GLOSSARY.map((entry) => entry.area));
    for (const area of ALL_AREAS) {
      expect(covered.has(area)).toBe(true);
    }
  });

  it('cada entrada declara origin y area', () => {
    for (const entry of COLLOQUIAL_GLOSSARY) {
      expect(['caso_fallado', 'modismo_general']).toContain(entry.origin);
      expect(ALL_AREAS).toContain(entry.area);
    }
  });

  it('normaliza "me duele" para que dispare la señal de dolor', () => {
    const normalized = normalizeColloquialSpeech('me duele mucho, como un 7');
    const [signal] = evaluate(normalized);
    expect(signal).toMatchObject({ area: 'pain', level: 'yellow' });
  });

  it('normaliza "calorcito" para que evalúe la temperatura reportada', () => {
    const normalized = normalizeColloquialSpeech('sentí un calorcito, 38.2');
    const [signal] = evaluate(normalized);
    expect(signal).toMatchObject({ area: 'fever', level: 'yellow' });
  });

  it('no dispara falso positivo cuando el paciente niega el síntoma', () => {
    const normalized = normalizeColloquialSpeech('no señora, el sueño lo he tenido normal, duermo bien casi todas las noches');
    expect(evaluate(normalized)).toEqual([]);
  });

  it('regresión (dataset real): "ya no duerme como antes" es modismo de edad, no falso positivo de sueño', () => {
    const normalized = normalizeColloquialSpeech('uno ya a esta edad no duerme igual que antes');
    expect(evaluate(normalized)).toEqual([]);
  });

  it('regresión (dataset real): "no duerme como antes" tampoco dispara', () => {
    const normalized = normalizeColloquialSpeech('pero eso será por la edad, uno ya no duerme como antes');
    expect(evaluate(normalized)).toEqual([]);
  });

  it('normaliza "punzada" y "ardor" para que disparen dolor con número', () => {
    expect(evaluate(normalizeColloquialSpeech('siento una punzada de 6'))[0]).toMatchObject({ area: 'pain', level: 'yellow' });
    expect(evaluate(normalizeColloquialSpeech('un ardor como de 7'))[0]).toMatchObject({ area: 'pain', level: 'yellow' });
  });

  it('normaliza "hirviendo", "afiebrado" y "escalofríos" para que disparen fiebre con número', () => {
    expect(evaluate(normalizeColloquialSpeech('estoy hirviendo, como 38.6'))[0]).toMatchObject({ area: 'fever', level: 'red' });
    expect(evaluate(normalizeColloquialSpeech('me siento afiebrada, 37.8'))[0]).toMatchObject({ area: 'fever', level: 'yellow' });
    expect(evaluate(normalizeColloquialSpeech('tengo escalofríos, 38.7'))[0]).toMatchObject({ area: 'fever', level: 'red' });
  });

  it('no dispara falso positivo de fiebre/dolor sin un número al lado (mismo gate que triage.rules)', () => {
    expect(evaluate(normalizeColloquialSpeech('siento una punzada pero nada grave'))).toEqual([]);
    expect(evaluate(normalizeColloquialSpeech('un poco de ardor, nada serio'))).toEqual([]);
    expect(evaluate(normalizeColloquialSpeech('estoy como hirviendo pero se me pasa'))).toEqual([]);
  });

  it('normaliza "no puedo ni pararme" (con "ni") al mismo nivel rojo que "no puedo pararme"', () => {
    const withNi = evaluate(normalizeColloquialSpeech('no puedo ni pararme de la cama'));
    const without = evaluate('no puedo pararme de la cama');
    expect(withNi).toEqual(without);
    expect(withNi[0]).toMatchObject({ area: 'mobility', level: 'red' });
  });

  it('normaliza "caliente la herida" para que dispare wound sin necesitar el descriptor original', () => {
    const [signal] = evaluate(normalizeColloquialSpeech('la herida está caliente al tacto'));
    expect(signal).toMatchObject({ area: 'wound', level: 'yellow' });
  });

  it('normaliza los modismos fuertes de apetito a pérdida total', () => {
    expect(evaluate(normalizeColloquialSpeech('se me cerró el estómago'))[0]).toMatchObject({ area: 'appetite', level: 'yellow' });
    expect(evaluate(normalizeColloquialSpeech('no me pasa la comida'))[0]).toMatchObject({ area: 'appetite', level: 'yellow' });
    expect(evaluate(normalizeColloquialSpeech('me da asco la comida'))[0]).toMatchObject({ area: 'appetite', level: 'yellow' });
  });

  it('normaliza "no logro/puedo pegar el ojo" igual que las variantes ya cubiertas', () => {
    expect(evaluate(normalizeColloquialSpeech('no logro pegar el ojo'))[0]).toMatchObject({ area: 'sleep', level: 'yellow' });
    expect(evaluate(normalizeColloquialSpeech('no puedo pegar el ojo'))[0]).toMatchObject({ area: 'sleep', level: 'yellow' });
  });
});
