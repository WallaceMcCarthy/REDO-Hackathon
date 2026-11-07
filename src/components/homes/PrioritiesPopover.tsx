import { useEffect, useRef, useState } from 'react';
import CategorySliders from '../CategorySliders';
import type { Metric, Prefs } from '../../types';
import { BTN_QUIET, FOCUS } from './ui';

export default function PrioritiesPopover({ prefs, setPrefs, metrics }: { prefs: Prefs; setPrefs: (p: Prefs) => void; metrics?: Metric[] }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open]);

  const values = Object.values(metrics?.find(m => m.id === 'commute_minutes')?.values ?? {});
  const cMin = values.length ? Math.ceil(Math.min(...values)) : 0;
  const cMax = values.length ? Math.ceil(Math.max(...values)) : 0;
  const commute = prefs.filters.maxCommuteMinutes;
  const shown = commute === undefined ? 'Any' : `${commute} min`;

  return (
    <div ref={root} className="relative">
      <button type="button" aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen(o => !o)} className={BTN_QUIET}>
        Priorities
      </button>
      {open && (
        <div
          role="dialog" aria-label="Priorities"
          className="fixed inset-x-0 bottom-0 z-50 max-h-[80dvh] overflow-y-auto rounded-t-2xl border border-rock-100 bg-white p-5 shadow-xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:left-0 sm:top-full sm:mt-2 sm:w-80 sm:rounded-xl"
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">What matters to you</h2>
            <button type="button" onClick={() => setOpen(false)} className={`rounded text-sm font-semibold text-alpine-700 ${FOCUS}`}>Done</button>
          </div>
          <CategorySliders value={prefs.categories} onChange={categories => setPrefs({ ...prefs, categories })} />
          {cMax > cMin && (
            <label className="mt-4 block">
              <span className="flex justify-between text-sm text-ink"><span>Max commute</span><span className="tabular-nums text-dusk">{shown}</span></span>
              <input
                type="range" min={cMin} max={cMax} step={1} value={commute ?? cMax} aria-valuetext={shown}
                onChange={e => {
                  const v = Number(e.target.value);
                  setPrefs({ ...prefs, filters: { ...prefs.filters, maxCommuteMinutes: v >= cMax ? undefined : v } });
                }}
                className="w-full accent-rock-500"
              />
            </label>
          )}
        </div>
      )}
    </div>
  );
}
