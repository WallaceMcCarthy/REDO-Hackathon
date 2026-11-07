import React, { useMemo, useState } from 'react';
import type { City, Filters, Metric, Prefs, Weights } from '../../types';
import { toMetricWeights } from '../../prefs';
import type { Listing, ListingKind, Recommendation } from '../../../convex/lib/listings';
import { useRecommendedListings } from '../../data/listingsHooks';
import ListingCard from './ListingCard';

interface HomesForYouProps {
  prefs: Prefs;
  metrics?: Metric[];
  cities?: City[];
  selectedListingId?: string | null;
  onSelectListing?: (listing: Listing) => void;
  className?: string;
}

export default function HomesForYou({
  prefs,
  metrics,
  cities,
  selectedListingId,
  onSelectListing,
  className = '',
}: HomesForYouProps) {
  const [kind, setKind] = useState<ListingKind>('apartment');

  const weights: Weights = useMemo(() => {
    return metrics ? toMetricWeights(prefs.categories, metrics) : {};
  }, [prefs.categories, metrics]);

  const cityMap = useMemo(() => {
    return new Map((cities || []).map((c) => [c.id, c.name]));
  }, [cities]);

  // Query top recommendations from Convex backend
  const recommendations = useRecommendedListings({
    weights,
    filters: prefs.filters,
    kind,
    limit: 12,
  });

  const isLoading = recommendations === undefined;

  return (
    <section aria-label="Recommended homes and apartments" className={`space-y-4 ${className}`}>
      {/* Header and Toggle */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold text-ink">Places to live</h2>
          <p className="text-xs text-dusk">
            Real public-record properties inside the towns that fit you best.
          </p>
        </div>

        {/* Kind Toggle */}
        <div className="inline-flex self-start rounded-full bg-rock-100 p-1 text-xs font-semibold sm:self-auto">
          <button
            type="button"
            onClick={() => setKind('apartment')}
            className={`cursor-pointer rounded-full px-4 py-1.5 transition-all ${
              kind === 'apartment'
                ? 'bg-white text-ink shadow-sm'
                : 'text-rock-600 hover:text-ink'
            }`}
          >
            Apartments
          </button>
          <button
            type="button"
            onClick={() => setKind('home')}
            className={`cursor-pointer rounded-full px-4 py-1.5 transition-all ${
              kind === 'home'
                ? 'bg-white text-ink shadow-sm'
                : 'text-rock-600 hover:text-ink'
            }`}
          >
            Homes
          </button>
        </div>
      </div>

      {/* Recommendations List */}
      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-48 animate-pulse rounded-2xl border border-rock-100 bg-rock-100/60"
            />
          ))}
        </div>
      ) : recommendations.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-rock-300 p-6 text-center">
          <h3 className="font-display text-lg font-semibold text-ink">
            No {kind === 'home' ? 'homes' : 'apartments'} found
          </h3>
          <p className="mt-1 text-xs text-dusk">
            {kind === 'home' && prefs.filters.maxHomeValue !== undefined
              ? 'Try relaxing your max home value filter to see more properties.'
              : 'No properties are currently available for this search criteria.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {recommendations.map((rec) => (
            <ListingCard
              key={rec.listing.id}
              item={rec}
              cityName={cityMap.get(rec.cityId)}
              isSelected={selectedListingId === rec.listing.id}
              onSelect={onSelectListing}
            />
          ))}
        </div>
      )}

      {/* Honest Data Attribution Note */}
      <div className="rounded-xl bg-rock-50 p-3 text-[11px] text-dusk">
        <p>
          <strong className="text-rock-700">Public record benchmarks: </strong>
          Values reflect official county assessor market values; rents reflect HUD FY2025 Fair
          Market Rents for 2-bedroom units. Not asking prices or active MLS sales.
        </p>
      </div>
    </section>
  );
}
