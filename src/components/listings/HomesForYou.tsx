import { useEffect } from 'react';
import type { Filters, Weights } from '../../types';
import type { Listing, ListingKind, Recommendation } from '../../../convex/lib/listings';
import { useListingSearch } from '../../data/listingsHooks';
import type { Sort } from '../homes/FilterBar';
import { BTN_PRIMARY, FOCUS, money } from '../homes/ui';
import ListingCard from './ListingCard';
import { useListingCommentCounts } from '../../data/socialHooks';

type TownInfo = { name: string; score: number; rank: number };

interface Props {
  kind: ListingKind;
  weights: Weights;
  filters: Filters;
  maxPrice?: number;
  sort: Sort;
  towns: Map<string, TownInfo>;
  townFilter: string | null;
  onClearTown: () => void;
  onBrowseAreas: () => void;
  onRaiseBudget: () => void;
  selectedId?: string | null;
  onSelect: (l: Listing) => void;
  onHoverCity: (cityId: string | null) => void;
  onOpenTown: (cityId: string) => void;
  onListings: (l: Listing[] | undefined) => void;
  onRecs?: (r: Recommendation[] | undefined) => void;
}

export default function HomesForYou(p: Props) {
  const { kind, maxPrice, sort, towns, townFilter } = p;
  const { items, total, loading, fetching, hasMore, loadMore } = useListingSearch({
    weights: p.weights, filters: { maxCommuteMinutes: p.filters.maxCommuteMinutes }, kind, sort,
    maxValue: kind === 'home' ? maxPrice : undefined, maxRent: kind === 'apartment' ? maxPrice : undefined,
    cityIds: townFilter ? [townFilter] : undefined,
  });

  const { onListings } = p;
  useEffect(() => {
    onListings(loading ? undefined : items.map(r => r.listing));
  }, [items, loading, onListings]);
  useEffect(() => () => onListings(undefined), [onListings]);
  const { onRecs } = p;
  useEffect(() => { onRecs?.(loading ? undefined : items); }, [items, loading, onRecs]);
  const counts = useListingCommentCounts(items.map(r => r.listing.id));
  useEffect(() => () => onRecs?.(undefined), [onRecs]);

  const noun = kind === 'home' ? 'homes' : 'apartments';
  if (loading) {
    return (
      <div role="status" aria-live="polite" className="space-y-3">
        <p className="text-sm text-dusk">Finding {noun}</p>
        {[0, 1, 2, 3].map(i => <div key={i} className="h-48 animate-pulse rounded-xl bg-rock-100/70" />)}
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div role="status" className="rounded-xl border border-dashed border-rock-300 p-6 text-center">
        <h2 className="font-display text-xl text-ink">
          {maxPrice !== undefined
            ? `No ${noun} under ${kind === 'home' ? money(maxPrice) : `$${maxPrice.toLocaleString()}/mo`}`
            : `No ${noun} found${townFilter ? ` in ${towns.get(townFilter)?.name ?? 'this area'}` : ''}`}
        </h2>
        <p className="mt-1 text-sm text-dusk">
          {maxPrice !== undefined ? `Raise your ${kind === 'home' ? 'budget' : 'max rent'} to see more.` : 'Try another area or loosen your priorities.'}
        </p>
        <div className="mt-4 flex justify-center gap-2">
          {maxPrice !== undefined && <button type="button" onClick={p.onRaiseBudget} className={BTN_PRIMARY}>Raise budget</button>}
          {townFilter && <button type="button" onClick={p.onClearTown} className={BTN_PRIMARY}>All areas</button>}
        </div>
      </div>
    );
  }

  const cityIds = [...new Set(items.map(r => r.cityId))];
  const grouped = sort === 'fit' && !townFilter && cityIds.length > 1;
  const card = (r: Recommendation) => (
    <li key={r.listing.id}>
      <ListingCard
        item={r} cityName={towns.get(r.cityId)?.name} commentCount={counts[r.listing.id]} isSelected={p.selectedId === r.listing.id}
        onSelect={p.onSelect} onHover={on => p.onHoverCity(on ? r.cityId : null)} onOpenTown={p.onOpenTown}
      />
    </li>
  );

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-dusk" aria-live="polite">
        <span>
          Showing {items.length} {noun} in {cityIds.length} {cityIds.length === 1 ? 'area' : 'areas'} · {total} matches
        </span>
        {townFilter && (
          <button type="button" onClick={p.onClearTown} className={`rounded-full bg-alpine-50 px-3 py-1 text-xs font-semibold text-alpine-700 hover:bg-alpine-100 ${FOCUS}`}>
            {towns.get(townFilter)?.name ?? 'Area'} (clear)
          </button>
        )}
      </div>
      {grouped ? (
        <div className="space-y-6">
          {cityIds.map(id => {
            const group = items.filter(r => r.cityId === id);
            const t = towns.get(id);
            return (
              <section key={id} aria-label={`${noun} in ${t?.name ?? id}`}>
                <div className="mb-2 flex items-baseline justify-between">
                  <h2 className="text-sm font-semibold text-ink">{t?.name ?? id} <span className="font-normal text-dusk">({group.length})</span></h2>
                  <button type="button" onClick={() => p.onOpenTown(id)} className="text-xs font-semibold text-alpine-700 underline underline-offset-2">About {t?.name}</button>
                </div>
                <ul className="space-y-3">{group.map(card)}</ul>
              </section>
            );
          })}
        </div>
      ) : (
        <ul className="space-y-3">{items.map(card)}</ul>
      )}
      {hasMore && <button type="button" onClick={loadMore} disabled={fetching} className={`${BTN_PRIMARY} mt-5 w-full disabled:opacity-50`}>
        {fetching ? 'Loading more…' : 'Load more'}
      </button>}
      <p className="mt-6 text-xs text-dusk">
        {items.some(item => item.listing.market)
          ? 'Active listing prices are asking amounts from the latest snapshot. Availability can change. Estimated records fill gaps where fewer live listings match.'
          : 'Estimated records: home values are assessor estimates and apartment amounts are area rent benchmarks. These records do not indicate availability.'}
      </p>
    </div>
  );
}
