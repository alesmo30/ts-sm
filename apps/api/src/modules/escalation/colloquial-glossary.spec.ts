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
});
