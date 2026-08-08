import { Module } from '@nestjs/common';

import { validateVoiceConfig, type VoiceConfig } from './voice.config';
import { VoiceController } from './voice.controller';
import { VoiceMetricsService } from './voice.metrics';
import { VoiceService } from './voice.service';
import { VOICE_CONFIG } from './voice.tokens';

@Module({
  controllers: [VoiceController],
  providers: [
    VoiceMetricsService,
    {
      provide: VOICE_CONFIG,
      useFactory: (): VoiceConfig => validateVoiceConfig(process.env),
    },
    {
      provide: VoiceService,
      inject: [VOICE_CONFIG, VoiceMetricsService],
      useFactory: (config: VoiceConfig, metrics: VoiceMetricsService): VoiceService => new VoiceService(config, metrics),
    },
  ],
  exports: [VoiceService, VoiceMetricsService, VOICE_CONFIG],
})
export class VoiceModule {}
