import { Module } from '@nestjs/common';

import { validateLlmConfig } from './llm.config';
import { LlmController } from './llm.controller';
import { LlmPort } from './llm.port';
import { LlmService } from './llm.service';
import { LlmMetricsService } from './metrics';
import { createLlmDriver } from './registry';

@Module({
  controllers: [LlmController],
  providers: [
    LlmMetricsService,
    LlmService,
    {
      provide: LlmPort,
      useFactory: (): LlmPort => createLlmDriver(validateLlmConfig(process.env)),
    },
  ],
  exports: [LlmPort, LlmMetricsService],
})
export class LlmModule {}
