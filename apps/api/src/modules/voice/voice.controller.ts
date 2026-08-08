import { Controller, Get, Inject } from '@nestjs/common';

import type { VoiceConfig } from './voice.config';
import { VoiceMetricsService, type VoiceMetricsSnapshot } from './voice.metrics';
import { VOICE_CONFIG } from './voice.tokens';

export interface VoiceConfigResponse {
  provider: VoiceConfig['provider'];
  sttModel: string;
  ttsModel: string;
}

@Controller('voice')
export class VoiceController {
  constructor(
    @Inject(VOICE_CONFIG) private readonly config: VoiceConfig,
    private readonly metrics: VoiceMetricsService,
  ) {}

  @Get('config')
  getConfig(): VoiceConfigResponse {
    return {
      provider: this.config.provider,
      sttModel: this.config.sttModel,
      ttsModel: this.config.ttsModel,
    };
  }

  @Get('metrics')
  getMetrics(): VoiceMetricsSnapshot {
    return this.metrics.getSnapshot();
  }
}
