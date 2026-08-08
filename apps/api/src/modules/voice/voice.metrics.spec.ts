import { VoiceMetricsService } from './voice.metrics';

describe('VoiceMetricsService', () => {
  it('empieza en ceros', () => {
    const metrics = new VoiceMetricsService();
    expect(metrics.getSnapshot()).toEqual({
      totalCalls: 0,
      totalSttCalls: 0,
      totalTtsCalls: 0,
      recent: [],
    });
  });

  it('acumula llamadas de stt y tts por separado en los totales', () => {
    const metrics = new VoiceMetricsService();

    metrics.recordStt({ model: 'nova-3', durationMs: 120, audioMs: 900, ok: true });
    metrics.recordTts({ model: 'aura-2-celeste-es', durationMs: 80, characters: 42, ok: true });

    const snapshot = metrics.getSnapshot();
    expect(snapshot.totalCalls).toBe(2);
    expect(snapshot.totalSttCalls).toBe(1);
    expect(snapshot.totalTtsCalls).toBe(1);
    expect(snapshot.recent).toHaveLength(2);
    expect(snapshot.recent[0]).toMatchObject({ kind: 'stt', audioMs: 900, characters: null });
    expect(snapshot.recent[1]).toMatchObject({ kind: 'tts', characters: 42, audioMs: null });
  });

  it('mantiene el buffer circular en 50 elementos', () => {
    const metrics = new VoiceMetricsService();
    for (let i = 0; i < 55; i += 1) {
      metrics.recordStt({ model: 'nova-3', durationMs: i, ok: true });
    }
    const snapshot = metrics.getSnapshot();
    expect(snapshot.totalSttCalls).toBe(55);
    expect(snapshot.recent).toHaveLength(50);
    expect(snapshot.recent[0].durationMs).toBe(5);
    expect(snapshot.recent[49].durationMs).toBe(54);
  });
});
