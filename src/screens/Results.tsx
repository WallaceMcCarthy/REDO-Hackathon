import { useCallback, useMemo, useRef, useState } from 'react';
import CategorySliders from '../components/CategorySliders';
import ResultsMap from '../components/results/ResultsMap';
import TownCard from '../components/results/TownCard';
import HomesForYou from '../components/listings/HomesForYou';
import type { Listing } from '../components/listings/types';
import type { Row } from '../components/results/types';
import { useFlip } from '../components/results/useFlip';
import { useCities, useMetrics, useRank } from '../data/hooks';
import { useRecommendedListings } from '../data/listingsHooks';
import { toMetricWeights } from '../prefs';
import type { Prefs } from '../types';

type Props = { prefs: Prefs; setPrefs: (p: Prefs) => void; onOpenTown: (id: string) => void; onRestart: () => void };

const money = (n: number) => (n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : `$${Math.round(n / 1000)}k`);
const minutes = (n: number) => `${n} min`;

type CapKey = 'maxHomeValue' | 'maxCommuteMinutes';
const CAPS: { key: CapKey; metricId: string; label: string; step: number; format: (n: number) => string }[] = [
  { key: 'maxHomeValue', metricId: 'home_value', label: 'Max home value', step: 5000, format: money },
  { key: 'maxCommuteMinutes', metricId: 'commute_minutes', label: 'Max commute', step: 1, format: minutes },
];
const NONE: never[] = [];
const isWide = () => window.matchMedia('(min-width: 1280px)').matches;

export default function Results({ prefs, setPrefs, onOpenTown, onRestart }: Props) {
  const cities = useCities();
  const metrics = useMetrics();
  const ranked = useRank(metrics ? toMetricWeights(prefs.categories, metrics) : {}, prefs.filters);
  const [hovered, setHovered] = useState<string | null>(null);
  const [controlsOpen] = useState(isWide);
  const [activeTab, setActiveTab] = useState<'towns' | 'listings'>('listings');
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const mapWeights = useMemo(() => (metrics ? toMetricWeights(prefs.categories, metrics) : {}), [prefs.categories, metrics]);
  const homeRecs = useRecommendedListings({ weights: mapWeights, filters: prefs.filters, kind: 'home', limit: 60 });
  const mapListings = useMemo<Listing[] | undefined>(() => {
    const homes = (homeRecs ?? []).map((r) => r.listing as unknown as Listing);
    if (selectedListing && !homes.some((h) => h.id === selectedListing.id)) homes.push(selectedListing);
    return homes.length ? homes : undefined;
  }, [homeRecs, selectedListing]);

  const rows = useMemo<Row[] | undefined>(() => {
    if (!cities || !metrics || !ranked) return undefined;
    const byId = new Map(cities.map(c => [c.id, c]));
    // A ranked town missing from the city list is dropped rather than crashing.
    return ranked.flatMap(score => {
      const city = byId.get(score.cityId);
      return city ? [{ city, score, rank: 0 }] : [];
    }).map((r, i) => ({ ...r, rank: i + 1 }));
  }, [cities, metrics, ranked]);

  const flip = useFlip(rows);

  // Each slider spans the real data, so its lowest stop still leaves at least one town.
  const caps = useMemo(() => CAPS.flatMap(cap => {
    const values = Object.values(metrics?.find(m => m.id === cap.metricId)?.values ?? {});
    if (!values.length) return [];
    const stop = (n: number) => Math.ceil(n / cap.step) * cap.step;
    return [{ ...cap, min: stop(Math.min(...values)), max: stop(Math.max(...values)) }];
  }), [metrics]);

  const hoverFromPin = useCallback((id: string | null) => {
    setHovered(id);
    if (id && isWide()) document.getElementById(`town-${id}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, []);
  const openRef = useRef(onOpenTown);
  openRef.current = onOpenTown;
  const openFromPin = useCallback((id: string) => openRef.current(id), []);

  const filtered = CAPS.some(cap => prefs.filters[cap.key] !== undefined);
  const clearFilters = () => setPrefs({ ...prefs, filters: {} });

  return (
    <main className="xl:sticky xl:top-0 xl:grid xl:h-dvh xl:grid-cols-[18rem_minmax(0,28rem)_minmax(0,1fr)]">
      <section aria-label="Map of ranked towns" className="sticky top-0 isolate z-10 order-first h-56 border-b border-rock-100 sm:h-80 xl:static xl:order-last xl:h-full xl:border-b-0">
        <ResultsMap rows={rows ?? []} cities={cities ?? NONE} metrics={metrics ?? NONE} hovered={hovered} onHover={hoverFromPin} onOpen={openFromPin} listings={mapListings} onSelectListing={setSelectedListing} />
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
            {caps.map(cap => {
              const value = prefs.filters[cap.key];
              const shown = value === undefined ? 'Any' : cap.format(value);
              return (
                <label key={cap.key} className="block">
                  <span className="flex justify-between text-sm text-ink">
                    <span>{cap.label}</span>
                    <span className="tabular-nums text-dusk">{shown}</span>
                  </span>
                  <input
                    type="range" min={cap.min} max={cap.max} step={cap.step} value={value ?? cap.max}
                    aria-valuetext={shown}
                    onChange={e => {
                      const v = Number(e.target.value);
                      setPrefs({ ...prefs, filters: { ...prefs.filters, [cap.key]: v >= cap.max ? undefined : v } });
                    }}
                    className="w-full accent-rock-500"
                  />
                </label>
              );
            })}
          </div>
        </details>
      </aside>

      <section aria-label="Ranked towns and listings" className="p-5 xl:overflow-y-auto">
        <div className="mb-4 flex items-center justify-between border-b border-rock-200 pb-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('towns')}
              className={`cursor-pointer rounded-full px-4 py-1.5 text-sm font-semibold transition-all ${
                activeTab === 'towns'
                  ? 'bg-rock-800 text-white shadow-sm'
                  : 'bg-rock-100 text-rock-600 hover:text-ink'
              }`}
            >
              Towns {rows ? `(${rows.length})` : ''}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('listings')}
              className={`cursor-pointer rounded-full px-4 py-1.5 text-sm font-semibold transition-all ${
                activeTab === 'listings'
                  ? 'bg-rock-800 text-white shadow-sm'
                  : 'bg-rock-100 text-rock-600 hover:text-ink'
              }`}
            >
              Homes for you
            </button>
          </div>
        </div>

        {activeTab === 'listings' ? (
          <HomesForYou
            prefs={prefs}
            metrics={metrics}
            cities={cities}
            selectedListingId={selectedListing?.id}
            onSelectListing={(l) => {
              setSelectedListing(l);
              if (l.cityId) {
                setHovered(l.cityId);
              }
            }}
          />
        ) : !rows ? (
          <div role="status" aria-live="polite" className="space-y-3">
            <p className="text-sm text-dusk">Ranking towns</p>
            {[0, 1, 2, 3, 4].map(i => <div key={i} className="h-24 animate-pulse rounded-2xl bg-rock-100/70" />)}
          </div>
        ) : rows.length === 0 ? (
          <div role="status" className="rounded-2xl border border-dashed border-rock-300 p-6">
            <h2 className="font-display text-2xl text-ink">No towns match</h2>
            <p className="mt-2 text-sm text-dusk">
              {filtered ? 'Nothing fits every limit at once. Loosen one to see towns again.' : 'No towns came back for these settings.'}
            </p>
            {filtered && (
              <button type="button" onClick={clearFilters} className="mt-4 rounded-full bg-rock-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rock-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-alpine-500">
                Remove limits
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
