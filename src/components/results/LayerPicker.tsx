import { useState } from 'react';
import { CATEGORIES } from '../../types';
import type { Metric } from '../../types';
import { rampCss } from './heatmap';

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: Math.abs(n) >= 100 ? 0 : 2 });

type Props = { metrics: Metric[]; selected: Metric | undefined; onSelect: (id: string) => void };

export default function LayerPicker({ metrics, selected, onSelect }: Props) {
  // Phone maps are short, so the long note starts folded there. The same pattern as the controls on the Results screen.
  const [aboutOpen] = useState(() => window.matchMedia('(min-width: 640px)').matches);
  const nums = selected ? Object.values(selected.values) : [];
  return (
    <div className="absolute right-2 top-2 z-[1000] w-44 sm:w-60 space-y-1.5 text-ink">
      <label className="block rounded-lg border border-rock-100 bg-sand/95 px-2 py-1 shadow-sm">
        <span className="block text-[10px] font-semibold uppercase tracking-wide text-dusk">Map layer</span>
        <select
          value={selected?.id ?? ''} onChange={e => onSelect(e.target.value)}
          className="w-full bg-transparent text-sm font-semibold focus-visible:outline-2 focus-visible:outline-alpine-500"
        >
          <option value="">None</option>
          {CATEGORIES.map(cat => {
            const group = metrics.filter(m => m.category === cat);
            return group.length ? (
              <optgroup key={cat} label={cat[0].toUpperCase() + cat.slice(1)}>
                {group.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
              </optgroup>
            ) : null;
          })}
        </select>
      </label>
      {selected && nums.length > 0 && (
        <div className="rounded-lg border border-rock-100 bg-sand/95 px-2 py-1.5 text-[11px] leading-snug shadow-sm">
          <p className="hidden font-semibold sm:block">{selected.label}</p>
          <div className="h-2.5 rounded-full sm:mt-1" style={{ background: rampCss(selected.higherIsBetter) }} />
          <div className="mt-0.5 flex justify-between tabular-nums">
            <span>{fmt(Math.min(...nums))}</span>
            <span>{fmt(Math.max(...nums))}</span>
          </div>
          <p className="truncate text-dusk sm:whitespace-normal" title={selected.unit}>{selected.unit}</p>
          <p className="mt-0.5 font-semibold">Better: {selected.higherIsBetter ? 'higher values' : 'lower values'}</p>
          <details open={aboutOpen} className="mt-0.5 text-dusk">
            <summary className="cursor-pointer font-semibold text-ink focus-visible:outline-2 focus-visible:outline-alpine-500">About this layer</summary>
            <p className="mt-0.5">
              Colour shows each town's rank among the {nums.length} measured towns, not an even scale. Colours between towns are estimated.
            </p>
          </details>
        </div>
      )}
    </div>
  );
}
