import type { Metric } from '../../types';
import { compare, gapWords, type Verdict } from './compare';

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 2 });

const WORDS: Record<Verdict, string> = {
  better: 'Better than the Utah median',
  worse: 'Worse than the Utah median',
  typical: 'Right at the Utah median',
  none: 'No data',
};
const TONE: Record<Verdict, string> = {
  better: 'text-success',
  worse: 'text-text',
  typical: 'text-text-muted',
  none: 'text-text-muted',
};
const DOT: Record<Verdict, string> = {
  better: 'bg-success',
  worse: 'bg-text',
  typical: 'bg-text-muted',
  none: 'bg-text-muted',
};
const ICON: Record<Verdict, string> = { better: '▲', worse: '▼', typical: '●', none: '' };

export default function MetricRow({ metric, townId }: { metric: Metric; townId: string }) {
  const c = compare(metric, townId);
  const range = c.max - c.min;
  const at = (n: number) => (range > 0 ? ((n - c.min) / range) * 100 : 50);
  const sentence = c.verdict === 'none' || c.pct === undefined || c.verdict === 'typical'
    ? WORDS[c.verdict]
    : `${WORDS[c.verdict]}, ${gapWords(c.pct)}`;

  return (
    <li className="min-w-0 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h4 className="min-w-0 break-words text-body font-semibold text-text">{metric.label}</h4>
        {c.value === undefined ? (
          <p className="font-display text-title text-text-muted">No data</p>
        ) : (
          <p className="font-display text-title tabular-nums text-text">
            {fmt(c.value)} <span className="font-sans text-caption text-text-muted">{metric.unit}</span>
          </p>
        )}
      </div>

      {c.median !== undefined && (
        <div className="mt-2 max-w-md">
          <div role="img" aria-label={`${sentence}. Utah median ${fmt(c.median)}.`} className="relative h-6">
            <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-pill bg-border" />
            <div className="absolute top-1 bottom-1 w-0.5 bg-text" style={{ left: `${at(c.median)}%` }} />
            {c.value !== undefined && (
              <div
                className={`absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-pill ring-2 ring-surface-raised ${DOT[c.verdict]}`}
                style={{ left: `${at(c.value)}%` }}
              />
            )}
          </div>
          <p className="flex justify-between gap-3 text-caption text-text-muted">
            <span>Utah median {fmt(c.median)}</span>
            <span>{metric.higherIsBetter ? 'Higher is better' : 'Lower is better'}</span>
          </p>
          {c.value !== undefined && (
            <p className={`mt-1 text-small font-semibold ${TONE[c.verdict]}`}>
              <span aria-hidden="true" className="mr-1.5 text-caption">{ICON[c.verdict]}</span>{sentence}
            </p>
          )}
        </div>
      )}

      <details className="group mt-2 max-w-prose text-small text-text-muted">
        <summary className="line-clamp-2 min-h-11 cursor-pointer list-none rounded-control break-words [overflow-wrap:anywhere] hover:text-text group-open:line-clamp-none">{metric.description}</summary>
      </details>
      <p className="text-caption text-text-muted">{metric.lastUpdated ? `Updated ${metric.lastUpdated}` : `Data year ${metric.year}`}</p>
    </li>
  );
}
