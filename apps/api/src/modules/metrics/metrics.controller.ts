import { Controller, Get } from '@nestjs/common';

import { LlmPort } from '../llm/llm.port';
import { priceFor, PRICING_SOURCE } from '../llm/pricing';

import { TurnMetricsService, type TurnMetricsSnapshot } from './turn-metrics';

export interface MetricsSnapshot extends TurnMetricsSnapshot {
  model: string;
  provider: string;
  pricing: { inputPerMTokUsd: number; outputPerMTokUsd: number; source: 'tarifa_publica' | 'consola_confirmada' };
}

@Controller('metrics')
export class MetricsController {
  constructor(
    private readonly turnMetrics: TurnMetricsService,
    private readonly llmPort: LlmPort,
  ) {}

  @Get()
  metrics(): MetricsSnapshot {
    const pricing = priceFor(this.llmPort.modelId);
    return {
      model: this.llmPort.modelId,
      provider: this.llmPort.providerName,
      pricing: { ...pricing, source: PRICING_SOURCE },
      ...this.turnMetrics.getSnapshot(),
    };
  }
}
