import { useEffect, useState } from 'react';
import { z } from 'zod';

import { apiClient } from '../../../shared/lib/apiClient';

const VoiceConfigSchema = z.object({
  provider: z.enum(['off', 'deepgram', 'webspeech']),
  sttModel: z.string(),
  ttsModel: z.string(),
});

export type VoiceConfig = z.infer<typeof VoiceConfigSchema>;

const OFF_CONFIG: VoiceConfig = { provider: 'off', sttModel: '', ttsModel: '' };

/** Consulta GET /voice/config al montar. Fuente única de verdad del proveedor de voz activo. */
export function useVoiceConfig(): VoiceConfig {
  const [config, setConfig] = useState<VoiceConfig>(OFF_CONFIG);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get('/voice/config', VoiceConfigSchema)
      .then((result) => {
        if (!cancelled) setConfig(result);
      })
      .catch(() => {
        if (!cancelled) setConfig(OFF_CONFIG);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return config;
}
