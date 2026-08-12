import { AsyncLocalStorage } from 'node:async_hooks';

import { Injectable, Logger } from '@nestjs/common';

import { latencyStats, type LatencyStats } from './percentiles';

export type LlmCallMethod = 'stream' | 'structured' | 'complete';

export type TurnStage = 'rag' | 'embedding' | 'llm' | 'stt' | 'tts';

/** Milisegundos acumulados por etapa dentro de un turno. Las etapas se solapan:
 *  `rag` incluye el embedOne de la consulta, que también cuenta en `embedding`.
 *  Su suma NO es responseLatencyMs. */
export interface StageMs {
  rag: number;
  embedding: number;
  llm: number;
  stt: number;
  tts: number;
}

export type StageLatencyStats = Record<TurnStage, LatencyStats>;

const STAGES: TurnStage[] = ['rag', 'embedding', 'llm', 'stt', 'tts'];

function emptyStageMs(): StageMs {
  return { rag: 0, embedding: 0, llm: 0, stt: 0, tts: 0 };
}

function emptyStageLatencies(): Record<TurnStage, number[]> {
  return { rag: [], embedding: [], llm: [], stt: [], tts: [] };
}

/** Lo que se acumula mientras el turno está en vuelo (dentro del AsyncLocalStorage). */
interface TurnScope {
  sessionId: string;
  startedAt: number;
  audioEndAt: number | null;
  firstAudioAt: number | null;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  llmCalls: { stream: number; structured: number; complete: number };
  embeddingCalls: number;
  ragQueries: number;
  sttCalls: number;
  ttsCalls: number;
  stageMs: StageMs;
}

/** El turno cerrado, ya inmutable, que entra al buffer. */
export interface TurnMetric {
  at: string;
  sessionId: string;
  responseLatencyMs: number;
  endOfSpeechLatencyMs: number | null;
  spoke: boolean;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  llmCalls: { stream: number; structured: number; complete: number };
  embeddingCalls: number;
  ragQueries: number;
  sttCalls: number;
  ttsCalls: number;
  stageMs: StageMs;
}

export interface SessionMetrics {
  sessionId: string;
  turns: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  llmCalls: number;
  llmCallsPerTurn: number;
  embeddingCalls: number;
  ragQueries: number;
  ragQueriesPerTurn: number;
  sttCalls: number;
  ttsCalls: number;
  responseLatency: LatencyStats;
  endOfSpeechLatency: LatencyStats;
  stageLatency: StageLatencyStats;
}

export interface TurnMetricsSnapshot {
  observedTurns: number;
  overall: {
    responseLatency: LatencyStats;
    endOfSpeechLatency: LatencyStats;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
    llmCalls: number;
    embeddingCalls: number;
    ragQueries: number;
    stageLatency: StageLatencyStats;
  };
  bySession: SessionMetrics[];
  recentTurns: TurnMetric[];
}

interface SessionAgg {
  sessionId: string;
  turns: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  llmCalls: number;
  embeddingCalls: number;
  ragQueries: number;
  sttCalls: number;
  ttsCalls: number;
  responseLatencies: number[];
  endOfSpeechLatencies: number[];
  stageLatencies: Record<TurnStage, number[]>;
}

const RECENT_TURNS_BUFFER_SIZE = 50;
const LATENCY_WINDOW_SIZE = 500;
const MAX_SESSIONS = 200;

function emptyScope(sessionId: string): TurnScope {
  return {
    sessionId,
    startedAt: Date.now(),
    audioEndAt: null,
    firstAudioAt: null,
    inputTokens: 0,
    outputTokens: 0,
    costUsd: 0,
    llmCalls: { stream: 0, structured: 0, complete: 0 },
    embeddingCalls: 0,
    ragQueries: 0,
    sttCalls: 0,
    ttsCalls: 0,
    stageMs: emptyStageMs(),
  };
}

function pushWindowed(values: number[], value: number, limit: number): void {
  values.push(value);
  if (values.length > limit) values.shift();
}

/**
 * Acumulador de métricas por turno. Ningún método `add*`/`mark*` puede lanzar
 * ni hacer I/O — todos retornan temprano si no hay turno activo, porque una
 * excepción acá no puede tumbar el turno real del paciente (ver spec 13,
 * riesgo "instrumentación en el camino crítico").
 */
@Injectable()
export class TurnMetricsService {
  private readonly logger = new Logger(TurnMetricsService.name);
  private readonly als = new AsyncLocalStorage<TurnScope>();

  private observedTurns = 0;
  private readonly overallResponseLatencies: number[] = [];
  private readonly overallEndOfSpeechLatencies: number[] = [];
  private readonly overallStageLatencies: Record<TurnStage, number[]> = emptyStageLatencies();
  private overallInputTokens = 0;
  private overallOutputTokens = 0;
  private overallCostUsd = 0;
  private overallLlmCalls = 0;
  private overallEmbeddingCalls = 0;
  private overallRagQueries = 0;
  private readonly recentTurns: TurnMetric[] = [];
  private readonly sessions = new Map<string, SessionAgg>();

  async runInTurn<T>(sessionId: string, fn: () => Promise<T>): Promise<T> {
    const scope = emptyScope(sessionId);
    try {
      return await this.als.run(scope, fn);
    } finally {
      this.closeTurn(scope);
    }
  }

  markAudioEnd(atMs: number): void {
    const scope = this.als.getStore();
    if (!scope) return;
    scope.audioEndAt = atMs;
  }

  markFirstAudio(): void {
    const scope = this.als.getStore();
    if (!scope || scope.firstAudioAt !== null) return;
    scope.firstAudioAt = Date.now();
  }

  addLlmCall(method: LlmCallMethod, inputTokens: number, outputTokens: number, costUsd: number): void {
    const scope = this.als.getStore();
    if (!scope) return;
    scope.llmCalls[method] += 1;
    scope.inputTokens += inputTokens;
    scope.outputTokens += outputTokens;
    scope.costUsd += costUsd;
  }

  addEmbeddingCall(): void {
    const scope = this.als.getStore();
    if (!scope) return;
    scope.embeddingCalls += 1;
  }

  addRagQuery(): void {
    const scope = this.als.getStore();
    if (!scope) return;
    scope.ragQueries += 1;
  }

  addSttCall(): void {
    const scope = this.als.getStore();
    if (!scope) return;
    scope.sttCalls += 1;
  }

  addTtsCall(): void {
    const scope = this.als.getStore();
    if (!scope) return;
    scope.ttsCalls += 1;
  }

  /** Suma `ms` a la etapa del turno en vuelo. No-op sin turno activo. No lanza. */
  addStageMs(stage: TurnStage, ms: number): void {
    const scope = this.als.getStore();
    if (!scope) return;
    if (!Number.isFinite(ms) || ms < 0) return; // una medición corrupta no envenena el p95
    scope.stageMs[stage] += ms;
  }

  getSnapshot(): TurnMetricsSnapshot {
    return {
      observedTurns: this.observedTurns,
      overall: {
        responseLatency: latencyStats(this.overallResponseLatencies),
        endOfSpeechLatency: latencyStats(this.overallEndOfSpeechLatencies),
        inputTokens: this.overallInputTokens,
        outputTokens: this.overallOutputTokens,
        costUsd: this.overallCostUsd,
        llmCalls: this.overallLlmCalls,
        embeddingCalls: this.overallEmbeddingCalls,
        ragQueries: this.overallRagQueries,
        stageLatency: this.toStageLatencyStats(this.overallStageLatencies),
      },
      bySession: [...this.sessions.values()].reverse().map((agg) => this.toSessionMetrics(agg)),
      recentTurns: [...this.recentTurns],
    };
  }

  private toStageLatencyStats(stageLatencies: Record<TurnStage, number[]>): StageLatencyStats {
    return STAGES.reduce((acc, stage) => {
      acc[stage] = latencyStats(stageLatencies[stage]);
      return acc;
    }, {} as StageLatencyStats);
  }

  private closeTurn(scope: TurnScope): void {
    try {
      const spoke = scope.firstAudioAt !== null;
      const responseLatencyMs = (scope.firstAudioAt ?? Date.now()) - scope.startedAt;
      const endOfSpeechLatencyMs =
        spoke && scope.audioEndAt !== null ? (scope.firstAudioAt as number) - scope.audioEndAt : null;

      const totalLlmCalls = scope.llmCalls.stream + scope.llmCalls.structured + scope.llmCalls.complete;

      const metric: TurnMetric = {
        at: new Date().toISOString(),
        sessionId: scope.sessionId,
        responseLatencyMs,
        endOfSpeechLatencyMs,
        spoke,
        inputTokens: scope.inputTokens,
        outputTokens: scope.outputTokens,
        costUsd: scope.costUsd,
        llmCalls: { ...scope.llmCalls },
        embeddingCalls: scope.embeddingCalls,
        ragQueries: scope.ragQueries,
        sttCalls: scope.sttCalls,
        ttsCalls: scope.ttsCalls,
        stageMs: { ...scope.stageMs },
      };

      this.observedTurns += 1;
      this.overallInputTokens += scope.inputTokens;
      this.overallOutputTokens += scope.outputTokens;
      this.overallCostUsd += scope.costUsd;
      this.overallLlmCalls += totalLlmCalls;
      this.overallEmbeddingCalls += scope.embeddingCalls;
      this.overallRagQueries += scope.ragQueries;

      if (spoke) {
        pushWindowed(this.overallResponseLatencies, responseLatencyMs, LATENCY_WINDOW_SIZE);
        if (endOfSpeechLatencyMs !== null) {
          pushWindowed(this.overallEndOfSpeechLatencies, endOfSpeechLatencyMs, LATENCY_WINDOW_SIZE);
        }
      }

      // Las etapas se acumulan siempre, hable o no el asistente (a diferencia
      // de responseLatency) — un turno de texto igual gastó RAG/embedding/LLM.
      // Un cero (etapa no ejercida) no entra a la ventana de esa etapa.
      for (const stage of STAGES) {
        const ms = metric.stageMs[stage];
        if (ms > 0) pushWindowed(this.overallStageLatencies[stage], ms, LATENCY_WINDOW_SIZE);
      }

      this.recentTurns.push(metric);
      if (this.recentTurns.length > RECENT_TURNS_BUFFER_SIZE) {
        this.recentTurns.shift();
      }

      this.recordSession(metric, totalLlmCalls);
    } catch (error) {
      this.logger.debug(
        `No fue posible cerrar el turno de métricas: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private recordSession(metric: TurnMetric, totalLlmCalls: number): void {
    let agg = this.sessions.get(metric.sessionId);
    if (agg) {
      // Mover al final del Map = "más reciente" para el tope por LRU.
      this.sessions.delete(metric.sessionId);
    } else {
      agg = {
        sessionId: metric.sessionId,
        turns: 0,
        inputTokens: 0,
        outputTokens: 0,
        costUsd: 0,
        llmCalls: 0,
        embeddingCalls: 0,
        ragQueries: 0,
        sttCalls: 0,
        ttsCalls: 0,
        responseLatencies: [],
        endOfSpeechLatencies: [],
        stageLatencies: emptyStageLatencies(),
      };
    }

    agg.turns += 1;
    agg.inputTokens += metric.inputTokens;
    agg.outputTokens += metric.outputTokens;
    agg.costUsd += metric.costUsd;
    agg.llmCalls += totalLlmCalls;
    agg.embeddingCalls += metric.embeddingCalls;
    agg.ragQueries += metric.ragQueries;
    agg.sttCalls += metric.sttCalls;
    agg.ttsCalls += metric.ttsCalls;
    if (metric.spoke) {
      pushWindowed(agg.responseLatencies, metric.responseLatencyMs, LATENCY_WINDOW_SIZE);
      if (metric.endOfSpeechLatencyMs !== null) {
        pushWindowed(agg.endOfSpeechLatencies, metric.endOfSpeechLatencyMs, LATENCY_WINDOW_SIZE);
      }
    }
    for (const stage of STAGES) {
      const ms = metric.stageMs[stage];
      if (ms > 0) pushWindowed(agg.stageLatencies[stage], ms, LATENCY_WINDOW_SIZE);
    }

    this.sessions.set(metric.sessionId, agg);

    if (this.sessions.size > MAX_SESSIONS) {
      const oldestKey = this.sessions.keys().next().value;
      if (oldestKey !== undefined) this.sessions.delete(oldestKey);
    }
  }

  private toSessionMetrics(agg: SessionAgg): SessionMetrics {
    return {
      sessionId: agg.sessionId,
      turns: agg.turns,
      inputTokens: agg.inputTokens,
      outputTokens: agg.outputTokens,
      costUsd: agg.costUsd,
      llmCalls: agg.llmCalls,
      llmCallsPerTurn: agg.turns > 0 ? agg.llmCalls / agg.turns : 0,
      embeddingCalls: agg.embeddingCalls,
      ragQueries: agg.ragQueries,
      ragQueriesPerTurn: agg.turns > 0 ? agg.ragQueries / agg.turns : 0,
      sttCalls: agg.sttCalls,
      ttsCalls: agg.ttsCalls,
      responseLatency: latencyStats(agg.responseLatencies),
      endOfSpeechLatency: latencyStats(agg.endOfSpeechLatencies),
      stageLatency: this.toStageLatencyStats(agg.stageLatencies),
    };
  }
}
