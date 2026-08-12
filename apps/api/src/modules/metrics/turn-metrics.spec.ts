import { TurnMetricsService } from './turn-metrics';

describe('TurnMetricsService', () => {
  it('los add*/mark* no lanzan y no hacen nada sin turno activo', () => {
    const service = new TurnMetricsService();

    expect(() => {
      service.markAudioEnd(Date.now());
      service.markFirstAudio();
      service.addLlmCall('stream', 1, 1, 0.01);
      service.addEmbeddingCall();
      service.addRagQuery();
      service.addSttCall();
      service.addTtsCall();
    }).not.toThrow();

    expect(service.getSnapshot().observedTurns).toBe(0);
  });

  it('un turno con audio deja spoke=true y aporta a los percentiles', async () => {
    const service = new TurnMetricsService();

    await service.runInTurn('session-1', async () => {
      service.addLlmCall('stream', 10, 20, 0.05);
      service.addRagQuery();
      service.markFirstAudio();
    });

    const snapshot = service.getSnapshot();
    expect(snapshot.observedTurns).toBe(1);
    expect(snapshot.recentTurns[0].spoke).toBe(true);
    expect(snapshot.recentTurns[0].responseLatencyMs).toBeGreaterThanOrEqual(0);
    expect(snapshot.overall.responseLatency.count).toBe(1);
    expect(snapshot.overall.inputTokens).toBe(10);
    expect(snapshot.overall.outputTokens).toBe(20);
    expect(snapshot.overall.llmCalls).toBe(1);
    expect(snapshot.overall.ragQueries).toBe(1);
  });

  it('un turno sin audio deja spoke=false y no aporta a los percentiles', async () => {
    const service = new TurnMetricsService();

    await service.runInTurn('session-1', async () => {
      service.addLlmCall('complete', 5, 5, 0.01);
    });

    const snapshot = service.getSnapshot();
    expect(snapshot.observedTurns).toBe(1);
    expect(snapshot.recentTurns[0].spoke).toBe(false);
    expect(snapshot.overall.responseLatency.count).toBe(0);
  });

  it('endOfSpeechLatencyMs es null si no hubo audio_end, incluso con audio', async () => {
    const service = new TurnMetricsService();

    await service.runInTurn('session-1', async () => {
      service.markFirstAudio();
    });

    expect(service.getSnapshot().recentTurns[0].endOfSpeechLatencyMs).toBeNull();
  });

  it('endOfSpeechLatencyMs se calcula desde markAudioEnd hasta el primer audio', async () => {
    const service = new TurnMetricsService();
    const audioEndAt = Date.now() - 100;

    await service.runInTurn('session-1', async () => {
      service.markAudioEnd(audioEndAt);
      service.markFirstAudio();
    });

    const metric = service.getSnapshot().recentTurns[0];
    expect(metric.endOfSpeechLatencyMs).not.toBeNull();
    expect(metric.endOfSpeechLatencyMs as number).toBeGreaterThanOrEqual(90);
  });

  it('markFirstAudio es idempotente: solo la primera llamada cuenta', async () => {
    const service = new TurnMetricsService();

    await service.runInTurn('session-1', async () => {
      service.markFirstAudio();
      await new Promise((resolve) => setTimeout(resolve, 5));
      service.markFirstAudio();
    });

    expect(service.getSnapshot().recentTurns[0].spoke).toBe(true);
  });

  it('un turno con multi-query reporta ragQueries=4 y llmCalls.structured=1', async () => {
    const service = new TurnMetricsService();

    await service.runInTurn('session-1', async () => {
      service.addRagQuery();
      service.addLlmCall('structured', 1, 1, 0);
      service.addRagQuery();
      service.addRagQuery();
      service.addRagQuery();
      service.addLlmCall('stream', 1, 1, 0);
      service.markFirstAudio();
    });

    const metric = service.getSnapshot().recentTurns[0];
    expect(metric.ragQueries).toBe(4);
    expect(metric.llmCalls.structured).toBe(1);
    expect(metric.llmCalls.stream).toBe(1);
  });

  it('embeddingCalls se cuenta aparte de llmCalls', async () => {
    const service = new TurnMetricsService();

    await service.runInTurn('session-1', async () => {
      service.addEmbeddingCall();
      service.addEmbeddingCall();
      service.addLlmCall('stream', 1, 1, 0);
    });

    const snapshot = service.getSnapshot();
    expect(snapshot.overall.embeddingCalls).toBe(2);
    expect(snapshot.overall.llmCalls).toBe(1);
  });

  it('agrega bySession con llmCallsPerTurn y ragQueriesPerTurn', async () => {
    const service = new TurnMetricsService();

    await service.runInTurn('session-a', async () => {
      service.addLlmCall('stream', 1, 1, 0);
      service.addRagQuery();
      service.markFirstAudio();
    });
    await service.runInTurn('session-a', async () => {
      service.addLlmCall('stream', 1, 1, 0);
      service.addLlmCall('structured', 1, 1, 0);
      service.addRagQuery();
      service.addRagQuery();
      service.markFirstAudio();
    });

    const session = service.getSnapshot().bySession.find((s) => s.sessionId === 'session-a');
    expect(session?.turns).toBe(2);
    expect(session?.llmCalls).toBe(3);
    expect(session?.llmCallsPerTurn).toBe(1.5);
    expect(session?.ragQueries).toBe(3);
    expect(session?.ragQueriesPerTurn).toBe(1.5);
  });

  it('bySession está acotado a 200 sesiones por última actividad', async () => {
    const service = new TurnMetricsService();

    for (let i = 0; i < 201; i += 1) {
      await service.runInTurn(`session-${i}`, async () => {
        service.markFirstAudio();
      });
    }

    const snapshot = service.getSnapshot();
    expect(snapshot.bySession).toHaveLength(200);
    expect(snapshot.bySession.some((s) => s.sessionId === 'session-0')).toBe(false);
    expect(snapshot.bySession.some((s) => s.sessionId === 'session-200')).toBe(true);
  });

  it('recentTurns se limita a 50 con buffer circular', async () => {
    const service = new TurnMetricsService();

    for (let i = 0; i < 51; i += 1) {
      await service.runInTurn(`session-${i}`, async () => {
        service.markFirstAudio();
      });
    }

    const snapshot = service.getSnapshot();
    expect(snapshot.recentTurns).toHaveLength(50);
    expect(snapshot.recentTurns[0].sessionId).toBe('session-1');
  });

  describe('addStageMs', () => {
    it('fuera de un turno activo no lanza y no altera el snapshot', () => {
      const service = new TurnMetricsService();

      expect(() => service.addStageMs('rag', 120)).not.toThrow();
      expect(service.getSnapshot().observedTurns).toBe(0);
    });

    it('descarta NaN, Infinity y valores negativos sin alterar la etapa', async () => {
      const service = new TurnMetricsService();

      await service.runInTurn('session-1', async () => {
        service.addStageMs('embedding', 100);
        service.addStageMs('embedding', NaN);
        service.addStageMs('embedding', Infinity);
        service.addStageMs('embedding', -50);
      });

      expect(service.getSnapshot().recentTurns[0].stageMs.embedding).toBe(100);
    });

    it('acumula varias llamadas a la misma etapa dentro del mismo turno', async () => {
      const service = new TurnMetricsService();

      await service.runInTurn('session-1', async () => {
        service.addStageMs('embedding', 100);
        service.addStageMs('embedding', 50);
      });

      expect(service.getSnapshot().recentTurns[0].stageMs.embedding).toBe(150);
    });

    it('stageLatency reporta p50/p95 por etapa y count:0/null para una etapa nunca ejercida', async () => {
      const service = new TurnMetricsService();

      await service.runInTurn('session-1', async () => {
        service.addStageMs('llm', 100);
        service.markFirstAudio();
      });
      await service.runInTurn('session-1', async () => {
        service.addStageMs('llm', 200);
        service.markFirstAudio();
      });

      const snapshot = service.getSnapshot();
      expect(snapshot.overall.stageLatency.llm.count).toBe(2);
      expect(snapshot.overall.stageLatency.llm.p50Ms).toBe(150);
      expect(snapshot.overall.stageLatency.stt.count).toBe(0);
      expect(snapshot.overall.stageLatency.stt.p50Ms).toBeNull();
    });

    it('un turno que no usó una etapa no empuja un 0 a su ventana', async () => {
      const service = new TurnMetricsService();

      await service.runInTurn('session-1', async () => {
        service.addStageMs('llm', 100);
        service.markFirstAudio();
      });

      expect(service.getSnapshot().overall.stageLatency.stt.count).toBe(0);
    });

    it('las etapas se acumulan también en turnos con spoke=false', async () => {
      const service = new TurnMetricsService();

      await service.runInTurn('session-1', async () => {
        service.addStageMs('rag', 300);
      });

      const snapshot = service.getSnapshot();
      expect(snapshot.recentTurns[0].spoke).toBe(false);
      expect(snapshot.overall.stageLatency.rag.count).toBe(1);
      expect(snapshot.overall.stageLatency.rag.p50Ms).toBe(300);
    });

    it('bySession reporta stageLatency por sesión', async () => {
      const service = new TurnMetricsService();

      await service.runInTurn('session-a', async () => {
        service.addStageMs('rag', 400);
        service.markFirstAudio();
      });

      const session = service.getSnapshot().bySession.find((s) => s.sessionId === 'session-a');
      expect(session?.stageLatency.rag.count).toBe(1);
      expect(session?.stageLatency.rag.p50Ms).toBe(400);
    });
  });
});
