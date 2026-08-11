import { Global, Module } from '@nestjs/common';

import { LlmModule } from '../llm/llm.module';

import { MetricsController } from './metrics.controller';
import { TurnMetricsService } from './turn-metrics';

@Global()
@Module({
  imports: [LlmModule],
  controllers: [MetricsController],
  providers: [TurnMetricsService],
  exports: [TurnMetricsService],
})
export class MetricsModule {}
