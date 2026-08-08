import { Injectable } from '@nestjs/common';

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
  private totalCalls = 0;
  private totalSttCalls = 0;
  private totalTtsCalls = 0;
  private readonly recent: VoiceCallMetric[] = [];

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
    return metric;
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
