import { sanitizeAssistantText } from './text-sanitizer';

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
