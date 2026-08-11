import { latencyStats, percentile } from './percentiles';

describe('percentile', () => {
  it('calcula P50 y P95 con interpolación lineal sobre 1..100', () => {
    const values = Array.from({ length: 100 }, (_, i) => i + 1);

    expect(percentile(values, 50)).toBeCloseTo(50.5, 5);
    expect(percentile(values, 95)).toBeCloseTo(95.05, 5);
  });

  it('con un solo valor, P50 y P95 son ese valor', () => {
    expect(percentile([42], 50)).toBe(42);
    expect(percentile([42], 95)).toBe(42);
  });

  it('no depende del orden de entrada', () => {
    expect(percentile([30, 10, 20], 50)).toBe(percentile([10, 20, 30], 50));
  });
});

describe('latencyStats', () => {
  it('devuelve todo null con lista vacía', () => {
    const stats = latencyStats([]);
    expect(stats).toEqual({ count: 0, p50Ms: null, p95Ms: null, minMs: null, maxMs: null });
  });

  it('reporta count, min y max junto a los percentiles', () => {
    const stats = latencyStats([10, 20, 30]);
    expect(stats.count).toBe(3);
    expect(stats.minMs).toBe(10);
    expect(stats.maxMs).toBe(30);
    expect(stats.p50Ms).toBe(20);
  });
});
