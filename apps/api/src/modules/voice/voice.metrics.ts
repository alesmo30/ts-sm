import { Injectable, Logger, Optional } from '@nestjs/common';

import { TurnMetricsService } from '../metrics/turn-metrics';

export interface VoiceCallMetric {
  at: string; // ISO 8601
  kind: 'stt' | 'tts';
  model: string;
  durationMs: number;
  audioMs: number | null;
  characters: number | null;
  ok: boolean;
}

export interface VoiceMetricsSnapshot {
  totalCalls: number;
  totalSttCalls: number;
  totalTtsCalls: number;
  recent: VoiceCallMetric[]; // buffer circular, últimas 50
}

const RECENT_BUFFER_SIZE = 50;

export interface RecordSttInput {
  model: string;
  durationMs: number;
  audioMs?: number;
  ok: boolean;
}

export interface RecordTtsInput {
  model: string;
  durationMs: number;
  characters?: number;
  ok: boolean;
}

@Injectable()
export class VoiceMetricsService {
  private readonly logger = new Logger(VoiceMetricsService.name);
  private totalCalls = 0;
  private totalSttCalls = 0;
  private totalTtsCalls = 0;
  private readonly recent: VoiceCallMetric[] = [];

  constructor(@Optional() private readonly turnMetrics?: TurnMetricsService) {}

  recordStt(input: RecordSttInput): VoiceCallMetric {
    const metric: VoiceCallMetric = {
      at: new Date().toISOString(),
      kind: 'stt',
      model: input.model,
      durationMs: input.durationMs,
      audioMs: input.audioMs ?? null,
      characters: null,
      ok: input.ok,
    };
    this.totalSttCalls += 1;
    this.push(metric);
    this.recordTurnCall(() => this.turnMetrics?.addSttCall());
    return metric;
  }

  recordTts(input: RecordTtsInput): VoiceCallMetric {
    const metric: VoiceCallMetric = {
      at: new Date().toISOString(),
      kind: 'tts',
      model: input.model,
      durationMs: input.durationMs,
      audioMs: null,
      characters: input.characters ?? null,
      ok: input.ok,
    };
    this.totalTtsCalls += 1;
    this.push(metric);
    this.recordTurnCall(() => this.turnMetrics?.addTtsCall());
    return metric;
  }

  // SPEC 13 — una falla acá nunca puede tumbar la llamada real de voz.
  private recordTurnCall(fn: () => void): void {
    try {
      fn();
    } catch (error) {
      this.logger.debug(
        `No fue posible registrar la métrica de turno para esta llamada de voz: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  getSnapshot(): VoiceMetricsSnapshot {
    return {
      totalCalls: this.totalCalls,
      totalSttCalls: this.totalSttCalls,
      totalTtsCalls: this.totalTtsCalls,
      recent: [...this.recent],
    };
  }

  private push(metric: VoiceCallMetric): void {
    this.totalCalls += 1;
    this.recent.push(metric);
    if (this.recent.length > RECENT_BUFFER_SIZE) {
      this.recent.shift();
    }
  }
}
