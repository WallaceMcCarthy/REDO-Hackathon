import type { Metric } from '../../types';
import { compare, type Verdict } from './compare';

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 2 });

const WORDS: Record<Verdict, string> = {
  better: 'Better than the Utah median',
  worse: 'Worse than the Utah median',
  typical: 'Right at the Utah median',
  none: 'No data',
};
const TONE: Record<Verdict, string> = {
  better: 'text-alpine-700',
  worse: 'text-rock-600',
  typical: 'text-dusk',
  none: 'text-dusk',
};
const DOT: Record<Verdict, string> = {
  better: 'bg-alpine-500',
  worse: 'bg-rock-500',
  typical: 'bg-dusk',
  none: 'bg-dusk',
};
const ICON: Record<Verdict, string> = { better: '▲', worse: '▼', typical: '●', none: '' };

export default function MetricRow({ metric, townId }: { metric: Metric; townId: string }) {
  const c = compare(metric, townId);
  const range = c.max - c.min;
  const at = (n: number) => (range > 0 ? ((n - c.min) / range) * 100 : 50);
  const sentence = c.verdict === 'none' || c.pct === undefined || c.verdict === 'typical'
    ? WORDS[c.verdict]
    : `${WORDS[c.verdict]}, ${Math.abs(c.pct) < 1 ? 'under 1%' : `${Math.round(Math.abs(c.pct))}%`} ${c.pct > 0 ? 'higher' : 'lower'}`;

  return (
    <li className="grid gap-x-8 gap-y-3 py-5 sm:grid-cols-[1fr_minmax(0,22rem)]">
      <div className="min-w-0">
        <h4 className="font-semibold text-ink break-words">{metric.label}</h4>
        <details className="group mt-1 max-w-prose text-sm leading-relaxed text-dusk">
          <summary className="line-clamp-2 cursor-pointer list-none rounded hover:text-ink focus-visible:outline-2 focus-visible:outline-alpine-500 group-open:line-clamp-none break-words [overflow-wrap:anywhere]">
            {metric.description}
          </summary>
        </details>
        <p className="mt-2 text-xs text-dusk break-words [overflow-wrap:anywhere]">
          {metric.year}
        </p>
      </div>

      <div className="min-w-0">
        {c.value === undefined ? (
          <p className="font-display text-xl text-dusk">No data</p>
        ) : (
          <p className="font-display text-2xl tabular-nums text-ink">
            {fmt(c.value)} <span className="font-sans text-xs text-dusk">{metric.unit}</span>
          </p>
        )}
        {c.median !== undefined && (
          <>
            <div
              role="img"
              aria-label={`${sentence}. Utah median ${fmt(c.median)}.`}
              className="relative mt-3 h-6"
            >
              <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-rock-100" />
              <div className="absolute top-1 bottom-1 w-0.5 bg-ink" style={{ left: `${at(c.median)}%` }} />
              {c.value !== undefined && (
                <div
                  className={`absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-sand ${DOT[c.verdict]}`}
                  style={{ left: `${at(c.value)}%` }}
                />
              )}
            </div>
            <p className="mt-1 flex justify-between gap-3 text-xs text-dusk">
              <span>Utah median {fmt(c.median)}</span>
              <span>{metric.higherIsBetter ? 'Higher is better' : 'Lower is better'}</span>
            </p>
            {c.value !== undefined && (
              <p className={`mt-2 text-sm font-semibold ${TONE[c.verdict]}`}>
                <span aria-hidden="true" className="mr-1.5 text-[0.7em]">{ICON[c.verdict]}</span>{sentence}
              </p>
            )}
          </>
        )}
      </div>
    </li>
  );
}
