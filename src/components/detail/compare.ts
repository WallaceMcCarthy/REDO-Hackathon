import type { Metric } from '../../types';

export function median(values: number[]): number | undefined {
  const v = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!v.length) return undefined;
  const mid = v.length >> 1;
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

export type Verdict = 'better' | 'worse' | 'typical' | 'none';

export type Comparison = {
  value?: number;
  median?: number;
  min: number;
  max: number;
  verdict: Verdict;
  /** Signed percent from the median, undefined when the median is 0. */
  pct?: number;
};

export function compare(metric: Metric, townId: string): Comparison {
  const all = Object.values(metric.values).filter(Number.isFinite);
  const m = median(all);
  const value = metric.values[townId];
  const base = { min: Math.min(...all), max: Math.max(...all), median: m };
  if (value === undefined || !Number.isFinite(value) || m === undefined) return { ...base, verdict: 'none' };
  const diff = value - m;
  const good = metric.higherIsBetter ? diff > 0 : diff < 0;
  return { ...base, value, verdict: diff === 0 ? 'typical' : good ? 'better' : 'worse', pct: m === 0 ? undefined : (diff / Math.abs(m)) * 100 };
}
