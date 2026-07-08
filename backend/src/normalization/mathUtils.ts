// ============================================================================
// Small, pure statistical helpers shared by the normalization layer.
// Deliberately dependency-free and deterministic.
// ============================================================================

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function stdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const m = mean(values);
  const variance = mean(values.map((v) => (v - m) ** 2));
  return Math.sqrt(variance);
}

/** Coefficient of variation, expressed as a percentage of the mean. */
export function coefficientOfVariationPct(values: number[]): number {
  const m = mean(values);
  if (m === 0) return 0;
  return (stdDev(values) / m) * 100;
}

/**
 * Splits a time-ordered series into an earlier half and a later half, then
 * returns the percentage change from the earlier average to the later
 * average. Used for detecting revenue/payroll trends (e.g. "declining
 * ~30% over the past 6 months").
 */
export function trendPct(valuesOldestFirst: number[]): number {
  const n = valuesOldestFirst.length;
  if (n < 2) return 0;
  const half = Math.floor(n / 2);
  const earlier = valuesOldestFirst.slice(0, half);
  const later = valuesOldestFirst.slice(n - half);
  const earlierAvg = mean(earlier);
  const laterAvg = mean(later);
  if (earlierAvg === 0) return 0;
  return ((laterAvg - earlierAvg) / earlierAvg) * 100;
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
