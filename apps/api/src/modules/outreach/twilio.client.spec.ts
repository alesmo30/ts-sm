import { buildTwiml, escapeXml, toE164Colombia } from './twilio.client';

describe('twilio.client', () => {
  it('escapa & y < para no romper el documento TwiML', () => {
    expect(escapeXml('Dolor 5 < 7 & sube')).toBe('Dolor 5 &lt; 7 &amp; sube');
  });

  it('envuelve el guion escapado en un <Say> con el idioma dado y una pausa antes de colgar', () => {
    const twiml = buildTwiml('Hola & bienvenido', 'es-MX');
    expect(twiml).toBe(
      '<?xml version="1.0" encoding="UTF-8"?><Response><Say language="es-MX">Hola &amp; bienvenido</Say><Pause length="2"/></Response>',
    );
  });
});

describe('toE164Colombia', () => {
  it('antepone +57 a un número local de 10 dígitos', () => {
    expect(toE164Colombia('3005553333')).toBe('+573005553333');
  });

  it('deja intacto un número que ya viene en E.164', () => {
    expect(toE164Colombia('+573005553333')).toBe('+573005553333');
  });

  it('antepone solo el + si el número ya trae el indicativo 57', () => {
    expect(toE164Colombia('573005553333')).toBe('+573005553333');
  });

  it('ignora espacios, guiones y paréntesis', () => {
    expect(toE164Colombia('(300) 555-3333')).toBe('+573005553333');
  });
});
