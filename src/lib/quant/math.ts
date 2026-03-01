export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  const sum = values.reduce((acc, value) => acc + value, 0);
  return sum / values.length;
}

export function stddev(values: number[]): number {
  if (values.length <= 1) return 0;
  const avg = mean(values);
  const variance =
    values.reduce((acc, value) => acc + (value - avg) ** 2, 0) / (values.length - 1);
  return Math.sqrt(Math.max(0, variance));
}

export function zscores(values: number[]): number[] {
  if (values.length === 0) return [];
  const avg = mean(values);
  const sd = stddev(values);
  if (sd === 0) return values.map(() => 0);
  return values.map((value) => (value - avg) / sd);
}

export function dailyReturns(series: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < series.length; i += 1) {
    const prev = series[i - 1];
    const curr = series[i];
    if (!Number.isFinite(prev) || !Number.isFinite(curr) || prev <= 0) {
      out.push(0);
      continue;
    }
    out.push(curr / prev - 1);
  }
  return out;
}

export function trailingReturn(
  series: number[],
  index: number,
  lookback: number,
  skipRecent = 0
): number {
  const endIndex = index - skipRecent;
  const startIndex = endIndex - lookback;
  if (startIndex < 0 || endIndex <= 0) return Number.NaN;
  const start = series[startIndex];
  const end = series[endIndex];
  if (!Number.isFinite(start) || !Number.isFinite(end) || start <= 0) return Number.NaN;
  return end / start - 1;
}

export function simpleMovingAverage(
  series: number[],
  index: number,
  window: number
): number {
  const start = index - window + 1;
  if (start < 0) return Number.NaN;
  const slice = series.slice(start, index + 1);
  if (slice.some((x) => !Number.isFinite(x))) return Number.NaN;
  return mean(slice);
}

export function annualizedVol(returns: number[]): number {
  const sd = stddev(returns);
  return sd * Math.sqrt(252);
}

export function covariance(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;
  const avgA = mean(a);
  const avgB = mean(b);
  const cov =
    a.reduce((acc, value, idx) => acc + (value - avgA) * (b[idx] - avgB), 0) /
    Math.max(1, a.length - 1);
  return cov;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function percentile(values: number[], p: number): number {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = clamp(p, 0, 1) * (sorted.length - 1);
  const low = Math.floor(rank);
  const high = Math.ceil(rank);
  if (low === high) return sorted[low];
  const w = rank - low;
  return sorted[low] * (1 - w) + sorted[high] * w;
}
