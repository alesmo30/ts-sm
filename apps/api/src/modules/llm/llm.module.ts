import { Module } from '@nestjs/common';

import { validateLlmConfig } from './llm.config';
import { LlmPort } from './llm.port';
import { LlmMetricsService } from './metrics';
import { createLlmDriver } from './registry';

@Module({
  providers: [
    LlmMetricsService,
    {
      provide: LlmPort,
      useFactory: (): LlmPort => createLlmDriver(validateLlmConfig(process.env)),
    },
  ],
  exports: [LlmPort, LlmMetricsService],
})
export class LlmModule {}
