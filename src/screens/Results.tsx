import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ResultsMap from '../components/results/ResultsMap';
import TownCard from '../components/results/TownCard';
import HomesForYou from '../components/listings/HomesForYou';
import type { Listing } from '../components/listings/types';
import type { Row } from '../components/results/types';
import { useFlip } from '../components/results/useFlip';
import FilterBar, { type Sort } from '../components/homes/FilterBar';
import ListErrorBoundary from '../components/homes/ListErrorBoundary';
import PrioritiesPopover from '../components/homes/PrioritiesPopover';
import Segmented, { type View } from '../components/homes/Segmented';
import AdvertiserDashboard from '../components/ads/AdvertiserDashboard';
import SavedPlaces from './SavedPlaces';
import { BTN_PRIMARY, FOCUS } from '../components/homes/ui';
import { useCities, useMetrics, useRank } from '../data/hooks';
import { toMetricWeights } from '../prefs';
import type { Prefs } from '../types';

type Props = { prefs: Prefs; setPrefs: (p: Prefs) => void; onOpenTown: (id: string) => void; onRestart: () => void };

const NONE: never[] = [];
const WIDE = '(min-width: 1024px)';
const isWide = () => window.matchMedia(WIDE).matches;

function useWide() {
  const [wide, setWide] = useState(isWide);
  useEffect(() => {
    const mq = window.matchMedia(WIDE);
    const on = () => setWide(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return wide;
}

export default function Results({ prefs, setPrefs, onOpenTown, onRestart }: Props) {
  const cities = useCities();
  const metrics = useMetrics();
  const weights = useMemo(() => (metrics ? toMetricWeights(prefs.categories, metrics) : {}), [prefs.categories, metrics]);
  const ranked = useRank(weights, prefs.filters);
  const wide = useWide();

  const [view, setView] = useState<View>('homes');
  const [viewMode, setViewMode] = useState<'main' | 'saved' | 'ads'>('main');
  const [sort, setSort] = useState<Sort>('fit');
  const [rentMax, setRentMax] = useState<number | undefined>();
  const [townFilter, setTownFilter] = useState<string | null>(null);
  const [pane, setPane] = useState<'list' | 'map'>('list');
  const [hovered, setHovered] = useState<string | null>(null);
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [listings, setListings] = useState<Listing[] | undefined>();

  const kind = view === 'apartments' ? 'apartment' : 'home';
  const budget = view === 'apartments' ? rentMax : prefs.filters.maxHomeValue;
  const setBudget = (n?: number) => {
    if (view === 'apartments') setRentMax(n);
    else setPrefs({ ...prefs, filters: { ...prefs.filters, maxHomeValue: n } });
  };

  const rows = useMemo<Row[] | undefined>(() => {
    if (!cities || !metrics || !ranked) return undefined;
    const byId = new Map(cities.map(c => [c.id, c]));
    return ranked.flatMap(score => {
      const city = byId.get(score.cityId);
      return city ? [{ city, score, rank: 0 }] : [];
    }).map((r, i) => ({ ...r, rank: i + 1 }));
  }, [cities, metrics, ranked]);

  const towns = useMemo(() => new Map((rows ?? []).map(r => [r.city.id, { name: r.city.name, score: r.score.score, rank: r.rank }])), [rows]);
  const median = (id: string, cityId: string) => metrics?.find(m => m.id === id)?.values[cityId];

  const mapListings = useMemo<Listing[] | undefined>(() => {
    if (view === 'areas') return undefined;
    const l = [...(listings ?? [])];
    if (selectedListing && l.length && !l.some(h => h.id === selectedListing.id)) l.push(selectedListing);
    return l.length ? l : undefined;
  }, [listings, selectedListing, view]);

  const flip = useFlip(rows);

  const hoverFromPin = useCallback((id: string | null) => {
    setHovered(id);
    if (id && isWide()) document.getElementById(`town-${id}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, []);
  const openRef = useRef(onOpenTown);
  openRef.current = onOpenTown;
  const openFromPin = useCallback((id: string) => openRef.current(id), []);
  const selectListing = useCallback((l: Listing) => {
    setSelectedListing(l);
    if (l.cityId) setHovered(l.cityId);
  }, []);

  const changeView = (v: View) => {
    setView(v);
    setSelectedListing(null);
    if (v !== 'areas') setTownFilter(null);
  };
  const seeHomes = (id: string) => { setTownFilter(id); setView('homes'); setSelectedListing(null); setPane('list'); };

  const showMap = wide || pane === 'map';
  const filtered = prefs.filters.maxHomeValue !== undefined || prefs.filters.maxCommuteMinutes !== undefined;

  const areas = !rows ? (
    <div role="status" aria-live="polite" className="space-y-3">
      <p className="text-sm text-dusk">Ranking areas</p>
      {[0, 1, 2, 3].map(i => <div key={i} className="h-44 animate-pulse rounded-xl bg-rock-100/70" />)}
    </div>
  ) : rows.length === 0 ? (
    <div role="status" className="rounded-xl border border-dashed border-rock-300 p-6 text-center">
      <h2 className="font-display text-xl text-ink">No areas match</h2>
      <p className="mt-1 text-sm text-dusk">{filtered ? 'Nothing fits every limit at once. Loosen one to see areas again.' : 'No areas came back for these settings.'}</p>
      {filtered && <button type="button" onClick={() => setPrefs({ ...prefs, filters: {} })} className={`${BTN_PRIMARY} mt-4`}>Remove limits</button>}
    </div>
  ) : (
    <>
      <p aria-live="polite" className="mb-3 text-sm text-dusk">
        {rows.length === cities?.length ? `All ${rows.length} areas ranked` : `${rows.length} of ${cities?.length} areas match`}
      </p>
      <ol className="relative space-y-3">
        {rows.map(row => (
          <li key={row.city.id} id={`town-${row.city.id}`} ref={flip(row.city.id)}>
            <TownCard
              row={row} active={hovered === row.city.id}
              medianValue={median('home_value', row.city.id)} medianRent={median('median_rent', row.city.id)}
              onOpen={() => onOpenTown(row.city.id)} onSeeHomes={() => seeHomes(row.city.id)}
              onHover={on => setHovered(on ? row.city.id : null)}
            />
          </li>
        ))}
      </ol>
    </>
  );

  if (viewMode === 'ads') return <AdvertiserDashboard cities={cities ?? []} onBack={() => setViewMode('main')} />;
  if (viewMode === 'saved') return <SavedPlaces onBack={() => setViewMode('main')} onOpenTown={openFromPin} />;

  return (
    <main className="flex h-dvh flex-col">
      <header className="z-30 shrink-0 border-b border-rock-100 bg-sand py-2.5 pl-4 pr-28">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="sr-only">Where you would fit in Utah</h1>
          <Segmented value={view} onChange={changeView} />
          <FilterBar view={view} budget={budget} onBudget={setBudget} sort={sort} onSort={setSort} />
          <PrioritiesPopover prefs={prefs} setPrefs={setPrefs} metrics={metrics} />
          <button type="button" onClick={onRestart} className={`ml-auto hidden rounded text-sm font-semibold text-alpine-700 underline underline-offset-2 lg:inline ${FOCUS}`}>
            Change my answers
          </button>
          <button type="button" onClick={() => setViewMode('saved')} className={`hidden rounded text-sm font-semibold text-alpine-700 underline underline-offset-2 lg:inline ${FOCUS}`}>
            Saved
          </button>
          <button type="button" onClick={() => setViewMode('ads')} className={`hidden rounded text-sm font-semibold text-alpine-700 underline underline-offset-2 lg:inline ${FOCUS}`}>
            Advertise
          </button>
          <div role="group" aria-label="List or map" className="ml-auto inline-flex rounded-lg bg-rock-100 p-1 lg:hidden">
            {(['list', 'map'] as const).map(p => (
              <button
                key={p} type="button" aria-pressed={pane === p} onClick={() => setPane(p)}
                className={`cursor-pointer rounded-md px-3 py-1.5 text-sm font-semibold capitalize ${FOCUS} ${pane === p ? 'bg-white text-ink shadow-sm' : 'text-dusk'}`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)] lg:grid-cols-[30rem_minmax(0,1fr)]">
        <section
          aria-label={view === 'areas' ? 'Ranked towns' : 'Homes and apartments'}
          className={`min-h-0 overflow-y-auto p-4 lg:border-r lg:border-rock-100 ${pane === 'map' ? 'hidden lg:block' : ''}`}
        >
          {view === 'areas' ? areas : (
            <ListErrorBoundary key={view}>
              <HomesForYou
                kind={kind} weights={weights} filters={prefs.filters} maxPrice={budget} sort={sort}
                towns={towns} townFilter={townFilter} onClearTown={() => setTownFilter(null)}
                onBrowseAreas={() => changeView('areas')} onRaiseBudget={() => setBudget(undefined)}
                selectedId={selectedListing?.id} onSelect={selectListing} onHoverCity={setHovered}
                onOpenTown={onOpenTown} onListings={setListings}
              />
            </ListErrorBoundary>
          )}
        </section>

        <section aria-label="Map" className={`isolate h-full ${pane === 'list' ? 'hidden lg:block' : ''}`}>
          {showMap && (
            <ResultsMap
              rows={rows ?? []} cities={cities ?? NONE} metrics={metrics ?? NONE} hovered={hovered}
              onHover={hoverFromPin} onOpen={openFromPin} listings={mapListings} onSelectListing={selectListing}
              focus={view === 'areas' ? 'towns' : 'listings'} selectedListingId={selectedListing?.id}
            />
          )}
        </section>
      </div>
    </main>
  );
}
