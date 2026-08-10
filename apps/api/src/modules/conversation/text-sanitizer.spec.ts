import { EscalationMarkerFilter, NoReferenceMarkerFilter, sanitizeAssistantText } from './text-sanitizer';

describe('sanitizeAssistantText', () => {
  it('quita negritas dobles asteriscos', () => {
    expect(sanitizeAssistantText('**Descanso:** Busca un lugar tranquilo.')).toBe('Descanso: Busca un lugar tranquilo.');
  });

  it('quita viñetas de guion al inicio de línea', () => {
    expect(sanitizeAssistantText('- Bebe agua\n- Descansa')).toBe('Bebe agua\nDescansa');
  });

  it('quita encabezados con numeral', () => {
    expect(sanitizeAssistantText('## Recomendaciones\nTexto')).toBe('Recomendaciones\nTexto');
  });

  it('quita numerales sueltos usados como énfasis', () => {
    expect(sanitizeAssistantText('#recomendación importante')).toBe('recomendación importante');
  });

  it('deja intacto el texto plano sin marcado', () => {
    expect(sanitizeAssistantText('Todo va bien con tu recuperación.')).toBe('Todo va bien con tu recuperación.');
  });
});

describe('EscalationMarkerFilter', () => {
  it('elimina la marca cuando llega completa en un solo chunk', () => {
    const filter = new EscalationMarkerFilter();
    const out = filter.push('Voy a informar a tu médico.\n[[ESCALAR]]');
    expect(out).toBe('Voy a informar a tu médico.\n');
    expect(filter.escalationDetected).toBe(true);
  });

  it('elimina la marca aunque el streaming la parta entre dos chunks', () => {
    const filter = new EscalationMarkerFilter();
    let out = filter.push('Ya aviso a tu médico.\n[[ESCA');
    out += filter.push('LAR]]');
    out += filter.flush();
    expect(out).toBe('Ya aviso a tu médico.\n');
    expect(filter.escalationDetected).toBe(true);
  });

  it('parte en más de dos chunks también se detecta', () => {
    const filter = new EscalationMarkerFilter();
    let out = filter.push('Texto previo [[');
    out += filter.push('ESCA');
    out += filter.push('LAR]]');
    out += filter.flush();
    expect(out).toBe('Texto previo ');
    expect(filter.escalationDetected).toBe(true);
  });

  it('no retiene texto normal que por casualidad empieza como la marca', () => {
    const filter = new EscalationMarkerFilter();
    let out = filter.push('Un corchete suelto [ sin marca real');
    out += filter.flush();
    expect(out).toBe('Un corchete suelto [ sin marca real');
    expect(filter.escalationDetected).toBe(false);
  });

  it('sin marca, el texto pasa completo y sin retención', () => {
    const filter = new EscalationMarkerFilter();
    const out = filter.push('Todo va bien con tu recuperación.');
    expect(out).toBe('Todo va bien con tu recuperación.');
    expect(filter.flush()).toBe('');
    expect(filter.escalationDetected).toBe(false);
  });
});

describe('NoReferenceMarkerFilter', () => {
  it('elimina la marca cuando llega completa en un solo chunk', () => {
    const filter = new NoReferenceMarkerFilter();
    const out = filter.push('No tengo información confirmada sobre eso.\n[[SIN_REFERENCIA]]');
    expect(out).toBe('No tengo información confirmada sobre eso.\n');
    expect(filter.noReferenceDetected).toBe(true);
  });

  it('elimina la marca aunque el streaming la parta entre dos chunks', () => {
    const filter = new NoReferenceMarkerFilter();
    let out = filter.push('No tengo esa información.\n[[SIN_REFE');
    out += filter.push('RENCIA]]');
    out += filter.flush();
    expect(out).toBe('No tengo esa información.\n');
    expect(filter.noReferenceDetected).toBe(true);
  });

  it('sin marca, el texto pasa completo y no marca noReferenceDetected', () => {
    const filter = new NoReferenceMarkerFilter();
    const out = filter.push('La ducha se permite a partir del quinto día.');
    expect(out).toBe('La ducha se permite a partir del quinto día.');
    expect(filter.flush()).toBe('');
    expect(filter.noReferenceDetected).toBe(false);
  });
});
