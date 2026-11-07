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
  const centreOn = (index: number, behavior: ScrollBehavior) => {
    const dial = dialRef.current;
    if (dial) dial.scrollTo({ top: index * ITEM, behavior });
  };

  // External changes (keyboard, restore) move the dial; scrolling that already sits on the item is left alone.
  useEffect(() => {
    const dial = dialRef.current;
    if (dial && dialOpen && Math.round(dial.scrollTop / ITEM) !== selectedIndex) centreOn(selectedIndex, 'auto');
  }, [selectedIndex, dialOpen]);

  // The row under the selection band is the layer, switched the instant it changes.
  const onScroll = () => {
    const dial = dialRef.current;
    if (!dial) return;
    const index = Math.max(0, Math.min(ids.length - 1, Math.round(dial.scrollTop / ITEM)));
    if (index !== selectedIndex) onSelect(ids[index]);
  };

  // One wheel tick, or about 50px of trackpad travel, moves exactly one row.
  const wheelAcc = useRef(0);
  const latest = useRef({ selectedIndex, count: ids.length });
  latest.current = { selectedIndex, count: ids.length };
  const target = useRef<number | null>(null);
  useEffect(() => { target.current = null; }, [selectedIndex]);
  useEffect(() => {
    const dial = dialRef.current;
    if (!dial) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      wheelAcc.current += event.deltaMode === 1 ? event.deltaY * 50 : event.deltaY;
      const steps = Math.trunc(wheelAcc.current / 50);
      if (!steps) return;
      wheelAcc.current -= steps * 50;
      const { selectedIndex: current, count } = latest.current;
      const next = Math.max(0, Math.min(count - 1, (target.current ?? current) + Math.sign(steps)));
      target.current = next;
      dial.scrollTo({ top: next * ITEM, behavior: 'smooth' });
    };
    dial.addEventListener('wheel', onWheel, { passive: false });
    return () => dial.removeEventListener('wheel', onWheel);
  }, [dialOpen]);

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const next = Math.max(0, Math.min(ids.length - 1, selectedIndex + (event.key === 'ArrowDown' ? 1 : -1)));
    centreOn(next, 'smooth');
    onSelect(ids[next]);
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
            style={{ scrollSnapType: 'y mandatory', paddingBlock: `calc(50% - ${ITEM / 2}px)` }}
            className="h-28 overflow-y-auto overscroll-contain rounded-lg bg-white/70 px-1 [scrollbar-width:none] sm:h-40 [&::-webkit-scrollbar]:hidden"
          >
            {items.map((option, index) => {
              const distance = Math.abs(index - selectedIndex);
              return (
                <div
                  key={option.id || 'none'}
                  id={`layer-opt-${index}`}
                  role="option"
                  aria-selected={index === selectedIndex}
                  onClick={() => { centreOn(index, 'smooth'); onSelect(option.id); }}
                  style={{ height: ITEM, scrollSnapAlign: 'center', opacity: distance === 0 ? 1 : Math.max(0.3, 1 - distance * 0.3), transform: `scale(${distance === 0 ? 1 : 0.92})` }}
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
