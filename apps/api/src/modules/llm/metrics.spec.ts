import { TurnMetricsService } from '../metrics/turn-metrics';

import { LlmMetricsService } from './metrics';

function recordSample(service: LlmMetricsService, overrides: Partial<Parameters<LlmMetricsService['recordCall']>[0]> = {}) {
  service.recordCall({
    provider: 'mock',
    model: 'mock',
    method: 'complete',
    inputTokens: 10,
    outputTokens: 20,
    latencyMs: 5,
    ok: true,
    ...overrides,
  });
}

describe('LlmMetricsService', () => {
  it('acumula totales y longitud del buffer tras tres llamadas', () => {
    const service = new LlmMetricsService();

    recordSample(service);
    recordSample(service);
    recordSample(service);

    const snapshot = service.getSnapshot();
    expect(snapshot.totalCalls).toBe(3);
    expect(snapshot.totalInputTokens).toBe(30);
    expect(snapshot.totalOutputTokens).toBe(60);
    expect(snapshot.recent).toHaveLength(3);
  });

  it('desaloja la primera entrada cuando el buffer supera 50', () => {
    const service = new LlmMetricsService();

    for (let i = 0; i < 51; i += 1) {
      recordSample(service, { model: `model-${i}` });
    }

    const snapshot = service.getSnapshot();
    expect(snapshot.totalCalls).toBe(51);
    expect(snapshot.recent).toHaveLength(50);
    expect(snapshot.recent[0].model).toBe('model-1');
    expect(snapshot.recent.some((entry) => entry.model === 'model-0')).toBe(false);
  });

  it('registra ttftMs no nulo dentro de runInScope tras markFirstToken', () => {
    const service = new LlmMetricsService();

    service.runInScope(() => {
      service.markFirstToken();
      service.recordCall({
        provider: 'mock',
        model: 'mock',
        method: 'stream',
        inputTokens: 1,
        outputTokens: 1,
        latencyMs: 5,
        ok: true,
      });
    });

    const snapshot = service.getSnapshot();
    expect(snapshot.recent[0].ttftMs).not.toBeNull();
  });

  it('deja ttftMs nulo cuando no se llama markFirstToken (complete)', () => {
    const service = new LlmMetricsService();
    recordSample(service, { method: 'complete' });

    const snapshot = service.getSnapshot();
    expect(snapshot.recent[0].ttftMs).toBeNull();
  });

  it('SPEC 13 — recordCall con method structured cuenta como llmCalls.structured del turno activo', async () => {
    const turnMetrics = new TurnMetricsService();
    const service = new LlmMetricsService(turnMetrics);

    await turnMetrics.runInTurn('session-1', async () => {
      recordSample(service, { method: 'structured' });
      recordSample(service, { method: 'stream' });
    });

    const metric = turnMetrics.getSnapshot().recentTurns[0];
    expect(metric.llmCalls.structured).toBe(1);
    expect(metric.llmCalls.stream).toBe(1);
    expect(metric.inputTokens).toBe(20);
  });

  it('SPEC 13 — sin TurnMetricsService inyectado, recordCall sigue funcionando (es opcional)', () => {
    const service = new LlmMetricsService();
    expect(() => recordSample(service)).not.toThrow();
  });

  it('SPEC 14 — recordCall propaga latencyMs a stageMs.llm del turno activo', async () => {
    const turnMetrics = new TurnMetricsService();
    const service = new LlmMetricsService(turnMetrics);

    await turnMetrics.runInTurn('session-1', async () => {
      recordSample(service, { latencyMs: 2200 });
    });

    const metric = turnMetrics.getSnapshot().recentTurns[0];
    expect(metric.stageMs.llm).toBe(2200);
  });
});
