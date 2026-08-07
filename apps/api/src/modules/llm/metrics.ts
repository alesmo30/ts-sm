import { AsyncLocalStorage } from 'node:async_hooks';

import { Injectable } from '@nestjs/common';

import { priceFor } from './pricing';

export interface LlmCallMetric {
  at: string; // ISO 8601
  provider: string;
  model: string;
  method: 'complete' | 'stream' | 'structured';
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
  ttftMs: number | null; // null salvo en stream()
  ok: boolean;
}

export interface LlmMetricsSnapshot {
  totalCalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
  recent: LlmCallMetric[]; // buffer circular, últimas 50
}

interface LlmCallContext {
  startedAt: number;
  ttftMs: number | null;
}

const RECENT_BUFFER_SIZE = 50;

export interface RecordCallInput {
  provider: string;
  model: string;
  method: LlmCallMetric['method'];
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  ok: boolean;
}

@Injectable()
export class LlmMetricsService {
  private readonly als = new AsyncLocalStorage<LlmCallContext>();

  private totalCalls = 0;
  private totalInputTokens = 0;
  private totalOutputTokens = 0;
  private totalCostUsd = 0;
  private readonly recent: LlmCallMetric[] = [];

  runInScope<T>(fn: () => T): T {
    return this.als.run({ startedAt: Date.now(), ttftMs: null }, fn);
  }

  markFirstToken(): void {
    const store = this.als.getStore();
    if (store && store.ttftMs === null) {
      store.ttftMs = Date.now() - store.startedAt;
    }
  }

  recordCall(input: RecordCallInput): LlmCallMetric {
    const store = this.als.getStore();
    const pricing = priceFor(input.model);
    const costUsd =
      (input.inputTokens / 1_000_000) * pricing.inputPerMTokUsd +
      (input.outputTokens / 1_000_000) * pricing.outputPerMTokUsd;

    const metric: LlmCallMetric = {
      at: new Date().toISOString(),
      provider: input.provider,
      model: input.model,
      method: input.method,
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
      costUsd,
      latencyMs: input.latencyMs,
      ttftMs: store?.ttftMs ?? null,
      ok: input.ok,
    };

    this.totalCalls += 1;
    this.totalInputTokens += input.inputTokens;
    this.totalOutputTokens += input.outputTokens;
    this.totalCostUsd += costUsd;

    this.recent.push(metric);
    if (this.recent.length > RECENT_BUFFER_SIZE) {
      this.recent.shift();
    }

    return metric;
  }

  getSnapshot(): LlmMetricsSnapshot {
    return {
      totalCalls: this.totalCalls,
      totalInputTokens: this.totalInputTokens,
      totalOutputTokens: this.totalOutputTokens,
      totalCostUsd: this.totalCostUsd,
      recent: [...this.recent],
    };
  }
}
