import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { Metric } from '../../types';
import { rampCss } from './heatmap';

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: Math.abs(n) >= 100 ? 0 : 2 });

type Props = { metrics: Metric[]; selected: Metric | undefined; onSelect: (id: string) => void };

export const stepLayer = (ids: string[], current: string, delta: -1 | 1) => {
  const index = Math.max(0, ids.indexOf(current));
  return ids[Math.max(0, Math.min(ids.length - 1, index + delta))] ?? '';
};

export default function LayerPicker({ metrics, selected, onSelect }: Props) {
  // Phone maps are short, so the long note starts folded there. The same pattern as the controls on the Results screen.
  const [aboutOpen] = useState(() => window.matchMedia('(min-width: 640px)').matches);
  // The dial covers about half a phone map, so it starts as one small button there.
  const [dialOpen, setDialOpen] = useState(aboutOpen);
  const nums = selected ? Object.values(selected.values) : [];
  const dialRef = useRef<HTMLDivElement>(null);
  const groups = useMemo(() => {
    const byCategory = new Map<string, { id: string; label: string }[]>();
    for (const metric of metrics) byCategory.set(metric.category, [...(byCategory.get(metric.category) ?? []), { id: metric.id, label: metric.label }]);
    return [{ category: '', items: [{ id: '', label: 'No heatmap' }] }, ...[...byCategory].map(([category, items]) => ({ category, items }))];
  }, [metrics]);
  // Keyboard order follows the grouped, on-screen order.
  const ids = groups.flatMap(group => group.items.map(item => item.id));
  const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();

  useEffect(() => {
    dialRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: 'center' });
  }, [selected?.id]);

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    onSelect(stepLayer(ids, selected?.id ?? '', event.key === 'ArrowDown' ? 1 : -1));
  };
  return (
    <div className={`absolute right-2 top-14 z-[1000] space-y-1.5 text-ink ${dialOpen ? 'w-44 sm:w-60' : 'w-36'}`}>
      <div className="rounded-xl border border-rock-100 bg-sand/95 p-1.5 shadow-sm">
        <button
          type="button" aria-expanded={dialOpen} onClick={() => setDialOpen(open => !open)}
          className="flex min-h-11 w-full cursor-pointer items-center justify-between gap-2 px-1 text-left sm:hidden"
        >
          <span className="truncate text-xs font-semibold text-ink">{selected?.label ?? 'Map layer'}</span>
          <span aria-hidden="true" className="text-[10px] text-dusk">{dialOpen ? '▲' : '▼'}</span>
        </button>
        <div className="hidden items-center justify-between px-1 pb-1 sm:flex">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-dusk">Map layer</span>
          <span className="text-[10px] text-dusk">Scroll to choose</span>
        </div>
        <div
          hidden={!dialOpen}
          ref={dialRef}
          role="listbox"
          aria-label="Map heatmap layer"
          tabIndex={0}
          onKeyDown={onKeyDown}
          className="max-h-28 snap-y snap-mandatory overflow-y-auto overscroll-contain rounded-lg bg-white/70 px-1 py-8 [scrollbar-width:thin] sm:max-h-40"
        >
          {groups.map(group => (
            <div key={group.category || 'none'} role="group" aria-label={group.category ? sentence(group.category) : undefined}>
              {group.category && <p aria-hidden="true" className="px-2 pt-1 text-[10px] font-normal text-dusk">{sentence(group.category)}</p>}
              {group.items.map(option => {
                const active = option.id === (selected?.id ?? '');
                return (
                  <button
                    key={option.id || 'none'}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => onSelect(option.id)}
                    className={`my-1 flex min-h-9 w-full snap-center items-center rounded-lg px-2 py-1 text-left text-xs leading-tight transition ${active ? 'bg-alpine-700 font-semibold text-white shadow' : 'text-ink hover:bg-rock-100'}`}
                  >
                    <span className="line-clamp-2 break-words">{option.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
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
              Colour shows each town's rank among the {nums.length} measured towns, not an even scale. Colours between towns are estimated, and fade out far from any town.
            </p>
          </details>
        </div>
      )}
    </div>
  );
}
