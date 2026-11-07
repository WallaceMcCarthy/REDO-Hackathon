import { useEffect, useMemo } from 'react';
import type { Filters, Weights } from '../../types';
import type { Listing, ListingKind, Recommendation } from '../../../convex/lib/listings';
import { useRecommendedListings, useTownListings } from '../../data/listingsHooks';
import type { Sort } from '../homes/FilterBar';
import { BTN_PRIMARY, FOCUS, money } from '../homes/ui';
import ListingCard from './ListingCard';

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
}

const priceOf = (l: Listing) => (l.kind === 'home' ? l.value : l.rent);

export default function HomesForYou(p: Props) {
  const { kind, maxPrice, sort, towns, townFilter } = p;
  const recs = useRecommendedListings({ weights: p.weights, filters: p.filters, kind, limit: 60 });
  const inTown = useTownListings({
    cityId: townFilter ?? '__none__', kind,
    maxValue: kind === 'home' ? maxPrice : undefined, maxRent: kind === 'apartment' ? maxPrice : undefined,
  });

  const loading = townFilter ? inTown === undefined : recs === undefined;
  const items = useMemo<Recommendation[]>(() => {
    let list: Recommendation[];
    if (townFilter) {
      const t = towns.get(townFilter);
      list = (inTown ?? []).map(listing => ({
        listing, cityId: listing.cityId, townScore: t?.score ?? 0, townRank: t?.rank ?? 0,
        reason: t ? `${t.name} is your #${t.rank} area match.` : '',
      }));
    } else list = recs ?? [];
    list = list.filter(r => {
      const v = priceOf(r.listing);
      return maxPrice === undefined || (v != null && v <= maxPrice);
    });
    const byPrice = (a: Recommendation, b: Recommendation) => (priceOf(a.listing) ?? Infinity) - (priceOf(b.listing) ?? Infinity);
    if (sort === 'price') return [...list].sort(byPrice);
    if (sort === 'newest') return [...list].sort((a, b) => (b.listing.yearBuilt ?? 0) - (a.listing.yearBuilt ?? 0));
    return townFilter ? [...list].sort(byPrice) : list;
  }, [recs, inTown, townFilter, towns, maxPrice, sort]);

  const { onListings } = p;
  useEffect(() => {
    onListings(loading ? undefined : items.map(r => r.listing));
  }, [items, loading, onListings]);
  useEffect(() => () => onListings(undefined), [onListings]);

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
        item={r} cityName={towns.get(r.cityId)?.name} isSelected={p.selectedId === r.listing.id}
        onSelect={p.onSelect} onHover={on => p.onHoverCity(on ? r.cityId : null)} onOpenTown={p.onOpenTown}
      />
    </li>
  );

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-dusk" aria-live="polite">
        <span>
          Showing {items.length} {noun} in {cityIds.length} {cityIds.length === 1 ? 'area' : 'areas'}
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
      <p className="mt-6 text-xs text-dusk">
        Public records: values are county assessor estimates; rents are HUD fair market rents for 2-bedroom units. Not asking prices or active sales.
      </p>
    </div>
  );
}
