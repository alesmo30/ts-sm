import { Injectable, Logger } from '@nestjs/common';

import type { LlmCompletion, LlmMessage, LlmOptions } from './llm.types';
import { LlmPort } from './llm.port';
import { LlmMetricsService, type LlmMetricsSnapshot } from './metrics';

export interface LlmHealth {
  provider: string;
  model: string;
  ready: boolean;
}

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);

  constructor(
    private readonly llmPort: LlmPort,
    private readonly metrics: LlmMetricsService,
  ) {}

  complete(messages: LlmMessage[], options?: LlmOptions): Promise<LlmCompletion> {
    return this.metrics.runInScope(async () => {
      const start = Date.now();

      try {
        const completion = await this.llmPort.complete(messages, options);

        this.metrics.recordCall({
          provider: this.llmPort.providerName,
          model: completion.model,
          method: 'complete',
          inputTokens: completion.usage.inputTokens,
          outputTokens: completion.usage.outputTokens,
          latencyMs: completion.latencyMs,
          ok: true,
        });

        this.logger.log(
          `provider=${this.llmPort.providerName} model=${completion.model} method=complete latencyMs=${completion.latencyMs} inputTokens=${completion.usage.inputTokens} outputTokens=${completion.usage.outputTokens}`,
        );

        return completion;
      } catch (error) {
        this.metrics.recordCall({
          provider: this.llmPort.providerName,
          model: this.llmPort.modelId,
          method: 'complete',
          inputTokens: 0,
          outputTokens: 0,
          latencyMs: Date.now() - start,
          ok: false,
        });

        this.logger.error(
          `provider=${this.llmPort.providerName} model=${this.llmPort.modelId} method=complete falló: ${error instanceof Error ? error.message : String(error)}`,
        );

        throw error;
      }
    });
  }

  health(): LlmHealth {
    return {
      provider: this.llmPort.providerName,
      model: this.llmPort.modelId,
      ready: true,
    };
  }

  metricsSnapshot(): LlmMetricsSnapshot {
    return this.metrics.getSnapshot();
  }
}
