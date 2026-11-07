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

/** Past double the median a percent stops meaning much, so say how many times as high it is. */
export function gapWords(pct: number): string {
  const size = Math.abs(pct);
  if (size < 1) return `under 1% ${pct > 0 ? 'higher' : 'lower'}`;
  if (pct < 100) return `${Math.round(size)}% ${pct > 0 ? 'higher' : 'lower'}`;
  const times = 1 + pct / 100;
  return `about ${times < 10 ? times.toFixed(1) : Math.round(times)} times as high`;
}

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
