import { z } from 'zod';

const rawSchema = z.object({
  VOICE_PROVIDER: z.enum(['off', 'deepgram', 'webspeech']).default('off'),
  DEEPGRAM_API_KEY: z.string().optional(),
  DEEPGRAM_STT_MODEL: z.string().default('nova-3'),
  DEEPGRAM_TTS_MODEL: z.string().default('aura-2-celeste-es'),
});

export interface VoiceConfig {
  provider: 'off' | 'deepgram' | 'webspeech';
  deepgramApiKey?: string;
  sttModel: string;
  ttsModel: string;
}

export function validateVoiceConfig(env: Record<string, unknown>): VoiceConfig {
  const parsed = rawSchema.safeParse(env);

  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`).join('\n');
    throw new Error(`Configuración de voz inválida:\n${issues}`);
  }

  const { VOICE_PROVIDER, DEEPGRAM_API_KEY, DEEPGRAM_STT_MODEL, DEEPGRAM_TTS_MODEL } = parsed.data;

  if (VOICE_PROVIDER === 'deepgram' && !DEEPGRAM_API_KEY) {
    throw new Error('Configuración de voz inválida:\n  - DEEPGRAM_API_KEY: obligatorio cuando VOICE_PROVIDER=deepgram');
  }

  return {
    provider: VOICE_PROVIDER,
    deepgramApiKey: DEEPGRAM_API_KEY,
    sttModel: DEEPGRAM_STT_MODEL,
    ttsModel: DEEPGRAM_TTS_MODEL,
  };
}
