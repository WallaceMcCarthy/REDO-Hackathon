import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { Metric } from '../../types';
import { rampCss } from './heatmap';

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: Math.abs(n) >= 100 ? 0 : 2 });

const ITEM = 36;

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
  const items = useMemo(() => [
    { id: '', label: 'No heatmap', category: '' },
    ...metrics.map(metric => ({ id: metric.id, label: metric.label, category: metric.category })),
  ], [metrics]);
  const ids = items.map(item => item.id);
  const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
  const selectedIndex = Math.max(0, ids.indexOf(selected?.id ?? ''));
  // Pure CSS scroll snap does the snapping; scrollTop / ITEM is the centred row.
  const raf = useRef(0);
  const onScroll = () => {
    if (raf.current) return;
    raf.current = requestAnimationFrame(() => {
      raf.current = 0;
      const dial = dialRef.current;
      if (!dial) return;
      const index = Math.max(0, Math.min(ids.length - 1, Math.round(dial.scrollTop / ITEM)));
      if (index !== selectedIndex) onSelect(ids[index]);
    });
  };
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  // On mount (and when the dial opens) the selected row sits centred, without animation.
  useEffect(() => {
    const dial = dialRef.current;
    if (dial && dialOpen) dial.scrollTop = selectedIndex * ITEM;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialOpen]);

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    dialRef.current?.scrollBy({ top: event.key === 'ArrowDown' ? ITEM : -ITEM, behavior: 'smooth' });
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
        <div className="relative">
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-1/2 z-10 -translate-y-1/2 rounded-lg border border-alpine-500 bg-alpine-500/15" style={{ height: ITEM }} hidden={!dialOpen} />
          <div
            hidden={!dialOpen}
            ref={dialRef}
            role="listbox"
            aria-label="Map heatmap layer"
            aria-activedescendant={`layer-opt-${selectedIndex}`}
            tabIndex={0}
            onKeyDown={onKeyDown}
            onScroll={onScroll}
            style={{ height: ITEM * 5, paddingTop: ITEM * 2, paddingBottom: ITEM * 2, scrollSnapType: 'y mandatory', overscrollBehavior: 'contain' }}
            className="overflow-y-auto rounded-lg bg-white/70 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {items.map((option, index) => {
              const distance = Math.abs(index - selectedIndex);
              return (
                <div
                  key={option.id || 'none'}
                  id={`layer-opt-${index}`}
                  role="option"
                  aria-selected={index === selectedIndex}
                  onClick={event => event.currentTarget.scrollIntoView({ block: 'center', behavior: 'smooth' })}
                  style={{ height: ITEM, scrollSnapAlign: 'center', scrollSnapStop: 'always', opacity: distance === 0 ? 1 : Math.max(0.3, 1 - distance * 0.3), transform: `scale(${distance === 0 ? 1 : 0.92})` }}
                  className={`flex w-full cursor-pointer flex-col justify-center rounded-lg px-2 text-left text-xs leading-tight transition-[opacity,transform] ${index === selectedIndex ? 'font-semibold text-ink' : 'text-ink'}`}
                >
                  {option.category && <span className="truncate text-[9px] font-normal text-dusk">{sentence(option.category)}</span>}
                  <span className="line-clamp-1 break-words">{option.label}</span>
                </div>
              );
            })}
          </div>
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
