import { useMetrics } from '../data/hooks';
import { CATEGORY_LABELS } from '../prefs';
import { CATEGORIES, type CategoryWeights } from '../types';
import { Skeleton } from './ui';

const MAX = 5;
const SNAPS = Array.from({ length: MAX + 1 }, (_, i) => i);
const ENDS: Record<number, string> = { 0: 'Not important', [MAX]: 'Essential' };

/** Where snap `i` sits. The thumb centre travels inset by half its width, so ticks and fill share this. `--thumb` is set by .fit-range in index.css. */
const snapAt = (i: number) => `calc(var(--thumb) / 2 + (100% - var(--thumb)) * ${i / MAX})`;

export default function CategorySliders({ value, onChange, className = 'space-y-5' }: { value: CategoryWeights; onChange: (next: CategoryWeights) => void; className?: string }) {
  const metrics = useMetrics();
  if (!metrics) return <div aria-busy="true" className="space-y-4"><Skeleton className="h-16" /><Skeleton className="h-16" /><Skeleton className="h-16" /></div>;
  // A category with no metrics would be a slider that changes nothing.
  const shown = CATEGORIES.filter(category => metrics.some(m => m.category === category));
  return (
    <div className={className}>
      {shown.map(category => {
        const current = value[category];
        return (
          <div key={category}>
            <label className="block cursor-pointer">
              <span className="flex items-baseline justify-between text-small text-text">
                <span className="font-semibold">{CATEGORY_LABELS[category]}</span>
                <span aria-hidden="true" className="tabular-nums text-text-muted"><b className="text-body font-semibold text-primary-hover">{current}</b> of {MAX}</span>
              </span>
              <span className="fit-range-wrap relative block">
                {SNAPS.map(i => (
                  <span key={i} data-tick={i} aria-hidden="true" style={{ left: snapAt(i) }} className={`absolute top-1/2 h-4 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-pill ${i <= current ? 'bg-primary' : 'bg-track'}`} />
                ))}
                <input
                  type="range"
                  min={0}
                  max={MAX}
                  step={1}
                  value={current}
                  aria-valuetext={ENDS[current] ? `${current}, ${ENDS[current]}` : `${current} of ${MAX}`}
                  onChange={e => onChange({ ...value, [category]: Number(e.target.value) })}
                  style={{ '--fill': snapAt(current) } as React.CSSProperties}
                  className="fit-range relative block w-full"
                />
              </span>
            </label>
            <div aria-hidden="true" className="flex justify-between text-caption text-text-muted">
              <span>{ENDS[0]}</span>
              <span>{ENDS[MAX]}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
