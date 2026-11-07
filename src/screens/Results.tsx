import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import SafeSectionBoundary from '../components/SafeSectionBoundary';
import { useConvex, useConvexAuth } from 'convex/react';
import { api } from '../../convex/_generated/api';
import ResultsFeatured from '../components/ads/ResultsFeatured';
import ResultsMap from '../components/results/ResultsMap';
import TownCard from '../components/results/TownCard';
import HomesForYou from '../components/listings/HomesForYou';
import ListingDetailPanel from '../components/listings/ListingDetailPanel';
import type { Listing, Recommendation } from '../components/listings/types';
import type { Row } from '../components/results/types';
import { useFlip } from '../components/results/useFlip';
import FilterBar, { type Sort } from '../components/homes/FilterBar';
import ListErrorBoundary from '../components/homes/ListErrorBoundary';
import PrioritiesPopover from '../components/homes/PrioritiesPopover';
import Segmented, { type View } from '../components/homes/Segmented';
import { BTN_PRIMARY, FOCUS } from '../components/homes/ui';
import { useCities, useMetrics, useRank } from '../data/hooks';
import { mapPins, useMapPoints, type MapPin } from '../data/mapPoints';
import { isRenting, toMetricWeights } from '../prefs';
import type { Prefs } from '../types';
import { openSignIn } from '../components/auth/AccountMenu';
import { useMessagesActions } from '../data/messagesHooks';
import ConversationView from '../components/messages/ConversationView';
import { Button, EmptyState } from '../components/ui';

type Props = { prefs: Prefs; setPrefs: (p: Prefs) => void; onOpenTown: (id: string) => void; onRestart: () => void; view: View; townFilter: string | null; openListing: string | null };

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

export default function Results({ prefs, setPrefs, onOpenTown, onRestart, view, townFilter, openListing }: Props) {
  const cities = useCities();
  const metrics = useMetrics();
  const weights = useMemo(() => (metrics ? toMetricWeights(prefs.categories, metrics) : {}), [prefs.categories, metrics]);
  const ranked = useRank(weights, prefs.filters);
  const wide = useWide();
  const { isAuthenticated } = useConvexAuth();
  const convex = useConvex();
  const { startConversation } = useMessagesActions();

  const [sort, setSort] = useState<Sort>('fit');
  const [pane, setPane] = useState<'list' | 'map'>('list');
  const [hovered, setHovered] = useState<string | null>(null);
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [listings, setListings] = useState<Listing[] | undefined>();
  const [recs, setRecs] = useState<Recommendation[] | undefined>();
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [pinNote, setPinNote] = useState('');
  const pinRequest = useRef(0);

  useEffect(() => {
    if (!pinNote) return;
    const timer = setTimeout(() => setPinNote(''), 5000);
    return () => clearTimeout(timer);
  }, [pinNote]);

  useEffect(() => {
    if (!activeConversationId) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveConversationId(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeConversationId]);

  const handleMessageUser = useCallback(
    async (userId: string, listingId: string) => {
      if (!isAuthenticated) {
        openSignIn();
        return;
      }
      try {
        const convoId = await startConversation(userId, listingId);
        if (convoId) {
          setActiveConversationId(convoId);
        }
      } catch (err) {
        console.error('Failed to start conversation:', err);
      }
    },
    [isAuthenticated, startConversation],
  );

  const kind = view === 'apartments' ? 'apartment' : 'home';
  const budget = view === 'apartments' ? prefs.budget.maxRent : prefs.budget.maxValue;
  const setBudget = (n?: number) => {
    if (view === 'apartments') {
      setPrefs({ ...prefs, budget: { ...prefs.budget, maxRent: n } });
    } else {
      setPrefs({ ...prefs, budget: { ...prefs.budget, maxValue: n } });
    }
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

  const showMap = wide || pane === 'map';
  const points = useMapPoints(showMap && view !== 'areas' ? kind : null);
  const maxCommute = prefs.filters.maxCommuteMinutes;
  // The same towns the list searches. Undefined means no limit.
  const townIds = useMemo(() => {
    if (!townFilter && maxCommute === undefined) return undefined;
    return new Set((rows ?? []).map(r => r.city.id).filter(id => !townFilter || id === townFilter));
  }, [rows, townFilter, maxCommute]);
  const allPins = useMemo(
    () => (view === 'areas' ? NONE : mapPins(points ?? NONE, listings ?? NONE, budget, townIds)),
    [view, points, listings, budget, townIds],
  );
  // Selecting must keep the same array when it can: a new one re-clusters every point.
  const mapListings = useMemo<MapPin[] | undefined>(() => {
    if (!allPins.length) return undefined;
    return selectedListing && !allPins.some(p => p.id === selectedListing.id) ? [...allPins, selectedListing] : allPins;
  }, [allPins, selectedListing]);

  const featuredTowns = useMemo(() => {
    if (view === 'areas') return (rows ?? []).map(r => r.city.id);
    return townFilter ? [townFilter] : [...new Set((listings ?? []).map(l => l.cityId))];
  }, [view, rows, townFilter, listings]);

  const flip = useFlip(rows);

  const hoverFromPin = useCallback((id: string | null) => {
    setHovered(id);
    if (id && isWide()) document.getElementById(`town-${id}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, []);
  const openRef = useRef(onOpenTown);
  openRef.current = onOpenTown;
  const openFromPin = useCallback((id: string) => openRef.current(id), []);
  const selectListing = useCallback((l: Listing) => {
    pinRequest.current++;
    setPinNote('');
    setSelectedListing(l);
    if (l.cityId) setHovered(l.cityId);
  }, []);
  /** A pin from the points file has no details yet, so fetch that one listing. */
  const selectPin = useCallback(async (pin: MapPin) => {
    if (pin.source !== undefined) { selectListing(pin as Listing); return; }
    const request = ++pinRequest.current;
    setPinNote('Opening listing');
    const listing = await convex.query(api.listings.get, { id: pin.id }).catch(() => undefined);
    if (request !== pinRequest.current) return;
    if (listing) selectListing(listing);
    else setPinNote(listing === null ? 'That listing is no longer available.' : 'Could not open that listing. Try again.');
  }, [convex, selectListing]);
  useEffect(() => { pinRequest.current++; setPinNote(''); }, [view]);
  // A sponsored listing links here. Dropping the param lets the same ad open the listing again once the panel closes.
  useEffect(() => {
    if (!openListing) return;
    void selectPin({ id: openListing } as MapPin);
    window.location.replace(townFilter ? `#/results?town=${encodeURIComponent(townFilter)}` : view === 'homes' ? '#/results' : `#/results?view=${view}`);
  }, [openListing, townFilter, view, selectPin]);

  const closePanel = useCallback(() => setSelectedListing(null), []);
  // An open listing gets its own history entry, so Back closes it instead of leaving Results.
  const panelOpen = selectedListing !== null;
  useEffect(() => {
    if (!panelOpen) return;
    window.history.pushState({ listingPanel: true }, '');
    const onPop = () => setSelectedListing(null);
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      if (window.history.state?.listingPanel) window.history.back();
    };
  }, [panelOpen]);
  const selIndex = selectedListing && recs ? recs.findIndex(r => r.listing.id === selectedListing.id) : -1;
  const step = (d: number) => {
    if (!recs?.length) return;
    const i = selIndex < 0 ? (d > 0 ? 0 : recs.length - 1) : selIndex + d;
    if (i >= 0 && i < recs.length) selectListing(recs[i].listing);
  };
  const selectedId = selectedListing?.id;
  useEffect(() => {
    if (!selectedId) return;
    document.querySelector(`[data-listing-id="${CSS.escape(selectedId)}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedId]);
  const panel = selectedListing && view !== 'areas' ? (
    <ListingDetailPanel
      key={selectedListing.id}
      listing={selectedListing} rec={recs?.find(r => r.listing.id === selectedListing.id)}
      cityName={towns.get(selectedListing.cityId)?.name} variant={wide ? 'floating' : 'sheet'}
      index={selIndex} total={recs?.length}
      onPrev={recs && selIndex > 0 ? () => step(-1) : undefined}
      onNext={recs && selIndex >= 0 && selIndex < recs.length - 1 ? () => step(1) : undefined}
      onClose={closePanel} onOpenTown={onOpenTown}
      onMessageUser={handleMessageUser}
    />
  ) : null;

  const changeView = (v: View) => {
    setSelectedListing(null);
    window.location.hash = v === 'homes' ? '/results' : `/results?view=${v}`;
  };
  const seeHomes = (id: string) => {
    setSelectedListing(null);
    setPane('list');
    window.location.hash = `/results?town=${encodeURIComponent(id)}${isRenting(prefs) ? '&view=apartments' : ''}`;
  };

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

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <header className="z-30 shrink-0 border-b border-rock-100 bg-sand px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="sr-only">Where you would fit in Utah</h1>
          <Segmented value={view} onChange={changeView} />
          <FilterBar view={view} budget={budget} onBudget={setBudget} sort={sort} onSort={setSort} />
          <PrioritiesPopover prefs={prefs} setPrefs={setPrefs} metrics={metrics} />
          <button type="button" onClick={onRestart} className={`ml-auto hidden rounded text-sm font-semibold text-alpine-700 underline underline-offset-2 lg:inline ${FOCUS}`}>
            Change my answers
          </button>
          <a href="#/advertise" className={`hidden rounded text-sm font-semibold text-alpine-700 underline underline-offset-2 lg:inline ${FOCUS}`}>
            Advertise
          </a>
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
          <SafeSectionBoundary><ResultsFeatured townIds={featuredTowns} max={wide ? 2 : 1} /></SafeSectionBoundary>
          {view === 'areas' ? areas : (
            <ListErrorBoundary key={view}>
              <HomesForYou
                kind={kind} weights={weights} filters={prefs.filters} maxPrice={budget} sort={sort}
                towns={towns} townFilter={townFilter} onClearTown={() => changeView(view)}
                onBrowseAreas={() => changeView('areas')} onRaiseBudget={() => setBudget(undefined)}
                selectedId={selectedListing?.id} onSelect={selectListing} onHoverCity={setHovered}
                onOpenTown={onOpenTown} onListings={setListings} onRecs={setRecs}
              />
            </ListErrorBoundary>
          )}
        </section>

        <section aria-label="Map" className={`relative isolate h-full ${pane === 'list' ? 'hidden lg:block' : ''}`}>
          {showMap && (
            <SafeSectionBoundary fallback={<p className="p-6 text-sm text-dusk">The map needs WebGL, which this browser has turned off. The list still works.</p>}>
            <ResultsMap
              rows={rows ?? []} cities={cities ?? NONE} metrics={metrics ?? NONE} hovered={hovered}
              onHover={hoverFromPin} onOpen={openFromPin} listings={mapListings} onSelectListing={selectPin}
              focus={view === 'areas' ? 'towns' : 'listings'} selectedListingId={selectedListing?.id}
              selectedTown={view === 'areas' ? null : townFilter}
            />
            </SafeSectionBoundary>
          )}
          <p role="status" className={pinNote ? 'absolute bottom-8 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-white shadow-md' : 'sr-only'}>{pinNote}</p>
          {wide && panel}
        </section>
      </div>
      {!wide && panel}

      {/* Floating conversation modal when messaging a commenter/user */}
      {activeConversationId && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Direct message conversation"
          className="fixed inset-0 z-[1200] flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveConversationId(null);
          }}
        >
          <div className="relative flex h-[85vh] max-h-[680px] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-rock-100 bg-white shadow-2xl">
            {/* Keyed so a conversation that vanishes (the other person deleted their account) resets when another opens. */}
            <SafeSectionBoundary
              key={activeConversationId}
              fallback={<EmptyState className="m-gutter" title="That conversation is not available" action={<Button onClick={() => setActiveConversationId(null)}>Close</Button>} />}
            >
              <ConversationView
                conversationId={activeConversationId}
                onBack={() => setActiveConversationId(null)}
              />
            </SafeSectionBoundary>
          </div>
        </div>
      )}
    </main>
  );
}
