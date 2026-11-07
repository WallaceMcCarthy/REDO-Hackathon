import { useMemo, useState } from 'react';
import CategorySliders from '../components/CategorySliders';
import ResultsMap from '../components/results/ResultsMap';
import TownCard from '../components/results/TownCard';
import type { Row } from '../components/results/types';
import { useFlip } from '../components/results/useFlip';
import { useCities, useMetrics, useRank } from '../data/hooks';
import { toMetricWeights } from '../prefs';
import type { Prefs } from '../types';

type Props = { prefs: Prefs; setPrefs: (p: Prefs) => void; onOpenTown: (id: string) => void; onRestart: () => void };

const HOME_VALUE_METRIC = 'home_value';
const money = (n: number) => (n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${Math.round(n)}`);
const isWide = () => window.matchMedia('(min-width: 1280px)').matches;

export default function Results({ prefs, setPrefs, onOpenTown, onRestart }: Props) {
  const cities = useCities();
  const metrics = useMetrics();
  const ranked = useRank(metrics ? toMetricWeights(prefs.categories, metrics) : {}, prefs.filters);
  const [hovered, setHovered] = useState<string | null>(null);
  const flip = useFlip();
  const [controlsOpen] = useState(isWide);

  const rows = useMemo<Row[] | undefined>(() => {
    if (!cities || !metrics || !ranked) return undefined;
    const byId = new Map(cities.map(c => [c.id, c]));
    // A ranked town missing from the city list is dropped rather than crashing.
    return ranked.flatMap(score => {
      const city = byId.get(score.cityId);
      return city ? [{ city, score, rank: 0 }] : [];
    }).map((r, i) => ({ ...r, rank: i + 1 }));
  }, [cities, metrics, ranked]);

  const home = useMemo(() => {
    const values = Object.values(metrics?.find(m => m.id === HOME_VALUE_METRIC)?.values ?? {});
    if (!values.length) return undefined;
    const step = Math.max(...values) > 1000 ? 5000 : 1;
    return { step, min: 0, max: Math.ceil(Math.max(...values) / step) * step };
  }, [metrics]);

  const hoverFromPin = (id: string | null) => {
    setHovered(id);
    if (id && isWide()) document.getElementById(`town-${id}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };

  const maxHome = prefs.filters.maxHomeValue;
  const clearFilter = () => setPrefs({ ...prefs, filters: { ...prefs.filters, maxHomeValue: undefined } });

  return (
    <main className="xl:sticky xl:top-0 xl:grid xl:h-dvh xl:grid-cols-[18rem_minmax(0,28rem)_minmax(0,1fr)]">
      <section aria-label="Map of ranked towns" className="sticky top-0 isolate z-10 order-first h-56 border-b border-rock-100 sm:h-80 xl:static xl:order-last xl:h-full xl:border-b-0">
        <ResultsMap rows={rows ?? []} hovered={hovered} onHover={hoverFromPin} onOpen={onOpenTown} />
      </section>

      <aside className="border-b border-rock-100 p-5 xl:overflow-y-auto xl:border-b-0 xl:border-r">
        <h1 className="font-display text-3xl leading-tight text-ink">Where you would fit in Utah</h1>
        <p className="mt-2 text-sm text-dusk">Move a slider and the ranking follows.</p>
        <button type="button" onClick={onRestart} className="mt-2 text-sm font-semibold text-alpine-700 underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-alpine-500">
          Change my answers
        </button>
        <details open={controlsOpen} className="mt-5 [&>summary]:xl:hidden">
          <summary className="cursor-pointer rounded text-sm font-semibold text-ink focus-visible:outline-2 focus-visible:outline-alpine-500">Adjust what matters</summary>
          <div className="mt-4 space-y-6">
            <CategorySliders value={prefs.categories} onChange={categories => setPrefs({ ...prefs, categories })} />
            {home && (
              <label className="block">
                <span className="flex justify-between text-sm text-ink">
                  <span>Max home value</span>
                  <span className="tabular-nums text-dusk">{maxHome === undefined ? 'Any' : money(maxHome)}</span>
                </span>
                <input
                  type="range" min={home.min} max={home.max} step={home.step} value={maxHome ?? home.max}
                  aria-valuetext={maxHome === undefined ? 'Any' : money(maxHome)}
                  onChange={e => {
                    const v = Number(e.target.value);
                    setPrefs({ ...prefs, filters: { ...prefs.filters, maxHomeValue: v >= home.max ? undefined : v } });
                  }}
                  className="w-full accent-rock-500"
                />
              </label>
            )}
          </div>
        </details>
      </aside>

      <section aria-label="Ranked towns" className="p-5 xl:overflow-y-auto">
        {!rows ? (
          <div role="status" aria-live="polite" className="space-y-3">
            <p className="text-sm text-dusk">Ranking towns</p>
            {[0, 1, 2, 3, 4].map(i => <div key={i} className="h-24 animate-pulse rounded-2xl bg-rock-100/70" />)}
          </div>
        ) : rows.length === 0 ? (
          <div role="status" className="rounded-2xl border border-dashed border-rock-300 p-6">
            <h2 className="font-display text-2xl text-ink">No towns match</h2>
            <p className="mt-2 text-sm text-dusk">
              {maxHome !== undefined ? `Nothing sits under a ${money(maxHome)} home value. Raise the limit to see towns again.` : 'No towns came back for these settings.'}
            </p>
            {maxHome !== undefined && (
              <button type="button" onClick={clearFilter} className="mt-4 rounded-full bg-rock-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rock-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-alpine-500">
                Remove home value limit
              </button>
            )}
          </div>
        ) : (
          <>
            <p aria-live="polite" className="mb-3 text-sm text-dusk">
              {rows.length === cities?.length ? `All ${rows.length} towns ranked` : `${rows.length} of ${cities?.length} towns match`}
            </p>
            <ol className="relative grid gap-3 md:grid-cols-2 xl:grid-cols-1">
              {rows.map(row => (
                <li key={row.city.id} id={`town-${row.city.id}`} ref={flip(row.city.id)}>
                  <TownCard
                    row={row}
                    active={hovered === row.city.id}
                    onOpen={() => onOpenTown(row.city.id)}
                    onHover={on => setHovered(on ? row.city.id : null)}
                  />
                </li>
              ))}
            </ol>
          </>
        )}
      </section>
    </main>
  );
}
