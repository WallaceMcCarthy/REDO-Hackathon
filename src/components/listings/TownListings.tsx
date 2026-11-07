import React, { useState } from 'react';
import type { Listing, ListingKind } from '../../../convex/lib/listings';
import { useTownListings } from '../../data/listingsHooks';
import ListingCard from './ListingCard';
import { useListingCommentCounts } from '../../data/socialHooks';

interface TownListingsProps {
  cityId: string;
  cityName: string;
}

export default function TownListings({ cityId, cityName }: TownListingsProps) {
  const [filter, setFilter] = useState<'all' | ListingKind>('all');
  const [limit, setLimit] = useState(6);

  const kind = filter === 'all' ? undefined : filter;
  const listings = useTownListings({ cityId, kind });

  const isLoading = listings === undefined;
  const visibleListings = listings?.slice(0, limit) ?? [];
  const counts = useListingCommentCounts(visibleListings.map((l) => l.id));
  const hasMore = (listings?.length ?? 0) > limit;

  return (
    <section aria-labelledby="town-listings-heading" className="mt-12 border-t border-rock-200 pt-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="town-listings-heading" className="font-display text-2xl font-bold text-ink">
            Places to live in {cityName}
          </h2>
          <p className="mt-0.5 text-xs text-dusk">
            Real public-record homes and apartment complexes with official benchmarks.
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="inline-flex self-start rounded-full bg-rock-100 p-1 text-xs font-semibold sm:self-auto">
          {(['all', 'apartment', 'home'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => {
                setFilter(tab);
                setLimit(6);
              }}
              className={`cursor-pointer rounded-full px-3.5 py-1.5 capitalize transition-all ${
                filter === tab
                  ? 'bg-white text-ink shadow-sm'
                  : 'text-rock-600 hover:text-ink'
              }`}
            >
              {tab === 'all' ? 'All' : tab === 'apartment' ? 'Apartments' : 'Homes'}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-44 animate-pulse rounded-2xl bg-rock-100/70" />
          ))}
        </div>
      ) : visibleListings.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-rock-300 p-8 text-center">
          <p className="text-sm font-medium text-ink">No {filter === 'all' ? 'listings' : filter + 's'} found for {cityName}</p>
          <p className="mt-1 text-xs text-dusk">
            {filter === 'home'
              ? 'No public assessor values available for this town: the county that covers it does not publish market value or building size for its parcels in any public dataset we could find, so no records are shown rather than estimating them.'
              : 'Public records may be pending county ingestion or have source gaps in this jurisdiction.'}
          </p>
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {visibleListings.map((listing) => (
              <ListingCard key={listing.id} item={listing} cityName={cityName} commentCount={counts[listing.id]} />
            ))}
          </div>

          {hasMore && (
            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => setLimit((prev) => prev + 6)}
                className="cursor-pointer rounded-full border border-rock-300 bg-white px-5 py-2 text-xs font-semibold text-rock-700 hover:bg-rock-50 hover:text-ink focus-visible:outline-2 focus-visible:outline-alpine-500"
              >
                Show more properties ({listings!.length - limit} remaining)
              </button>
            </div>
          )}
        </>
      )}

      {/* Honest Data Footnote */}
      <p className="mt-4 text-[11px] text-dusk">
        <strong className="text-rock-600">Benchmark Notice: </strong>
        Home values are county assessor market value assessments; apartment rents are HUD FY2025 Fair Market Rents for 2-bedroom units. Public records only, never asking prices.
      </p>
    </section>
  );
}
