import React, { useState } from 'react';
import type { Listing, ListingKind } from '../../../convex/lib/listings';
import { useTownListings } from '../../data/listingsHooks';
import ListingCard from './ListingCard';
import { Button, EmptyState, Segmented, Skeleton } from '../ui';

interface TownListingsProps {
  cityId: string;
  cityName: string;
}

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'apartment', label: 'Apartments' },
  { value: 'home', label: 'Homes' },
] as const;

export default function TownListings({ cityId, cityName }: TownListingsProps) {
  const [filter, setFilter] = useState<'all' | ListingKind>('all');
  const [limit, setLimit] = useState(6);

  const kind = filter === 'all' ? undefined : filter;
  const listings = useTownListings({ cityId, kind });

  const isLoading = listings === undefined;
  const visibleListings = listings?.slice(0, limit) ?? [];
  const hasMore = (listings?.length ?? 0) > limit;

  return (
    <section aria-labelledby="town-listings-heading" className="mt-section">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="town-listings-heading" className="font-display text-heading text-text">Places to live in {cityName}</h2>
          <p className="mt-1 text-small text-text-muted">Real public-record homes and apartment complexes with official benchmarks.</p>
        </div>
        <Segmented
          label="Show"
          options={FILTERS}
          value={filter}
          onChange={(next) => { setFilter(next); setLimit(6); }}
          className="sm:w-80"
        />
      </div>

      {isLoading ? (
        <div className="mt-stack grid gap-4 sm:grid-cols-2" aria-busy="true">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-44 rounded-card" />)}
        </div>
      ) : visibleListings.length === 0 ? (
        <EmptyState
          className="mt-stack"
          title={`No ${filter === 'all' ? 'listings' : filter + 's'} found for ${cityName}`}
          description={filter === 'home'
            ? 'No public assessor values available for this town: the county that covers it does not publish market value or building size for its parcels in any public dataset we could find, so no records are shown rather than estimating them.'
            : 'Public records may be pending county ingestion or have source gaps in this jurisdiction.'}
        />
      ) : (
        <>
          <div className="mt-stack grid gap-4 sm:grid-cols-2">
            {visibleListings.map((listing) => (
              <ListingCard key={listing.id} item={listing} cityName={cityName} />
            ))}
          </div>
          {hasMore && (
            <div className="mt-stack text-center">
              <Button variant="secondary" onClick={() => setLimit((prev) => prev + 6)}>
                Show more properties ({listings!.length - limit} remaining)
              </Button>
            </div>
          )}
        </>
      )}

      {/* Honest Data Footnote */}
      <p className="mt-4 text-caption text-text-muted">
        <strong className="text-text">Benchmark Notice: </strong>
        Home values are county assessor market value assessments; apartment rents are HUD FY2025 Fair Market Rents for 2-bedroom units. Public records only, never asking prices.
      </p>
    </section>
  );
}
