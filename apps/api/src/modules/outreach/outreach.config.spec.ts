import { validateOutreachConfig } from './outreach.config';

describe('validateOutreachConfig', () => {
  it('trata TWILIO_TO_OVERRIDE="" como no configurado, no como override vacío', () => {
    const config = validateOutreachConfig({ TWILIO_TO_OVERRIDE: '' });
    expect(config.twilioToOverride).toBeUndefined();
  });

  it('trata RESEND_TO_OVERRIDE="" como no configurado', () => {
    const config = validateOutreachConfig({ RESEND_TO_OVERRIDE: '' });
    expect(config.resendToOverride).toBeUndefined();
  });

  it('conserva un override real cuando sí viene definido', () => {
    const config = validateOutreachConfig({ TWILIO_TO_OVERRIDE: '+573146394774' });
    expect(config.twilioToOverride).toBe('+573146394774');
  });

  it('aplica los defaults cuando no se define nada', () => {
    const config = validateOutreachConfig({});
    expect(config.twilioVoiceLanguage).toBe('es-MX');
    expect(config.resendFrom).toBe('Equipo médico <onboarding@resend.dev>');
  });
});
