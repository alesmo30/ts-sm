export interface LatencyStats {
  count: number;
  p50Ms: number | null;
  p95Ms: number | null;
  minMs: number | null;
  maxMs: number | null;
}

/** Interpolación lineal, mismo método que numpy.percentile default. `values` no necesita venir ordenado. */
export function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0];

  const rank = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(rank);
  const upper = Math.ceil(rank);
  if (lower === upper) return sorted[lower];

  const weight = rank - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

export function latencyStats(values: number[]): LatencyStats {
  if (values.length === 0) {
    return { count: 0, p50Ms: null, p95Ms: null, minMs: null, maxMs: null };
  }

  return {
    count: values.length,
    p50Ms: percentile(values, 50),
    p95Ms: percentile(values, 95),
    minMs: Math.min(...values),
    maxMs: Math.max(...values),
  };
}
