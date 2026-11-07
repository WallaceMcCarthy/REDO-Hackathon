import React, { useState } from 'react';
import { useListingCommentCounts, useMySaved } from '../data/socialHooks';
import type { ListingKind } from '../../convex/lib/listings';
import ListingCard from '../components/listings/ListingCard';

interface SavedPlacesProps {
  onBack: () => void;
  onOpenTown?: (cityId: string) => void;
}

export default function SavedPlaces({ onBack, onOpenTown }: SavedPlacesProps) {
  const [filter, setFilter] = useState<'all' | ListingKind>('all');
  const savedItems = useMySaved();

  const isLoading = savedItems === undefined;
  const counts = useListingCommentCounts((savedItems || []).map((i) => i.listingId));
  const filtered = (savedItems || []).filter((item) => {
    if (!item.listing) return false;
    if (filter !== 'all' && item.listing.kind !== filter) return false;
    return true;
  });

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-rock-200 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="mb-3 inline-flex min-h-[44px] items-center cursor-pointer rounded-full border border-rock-300 px-4 py-2 text-xs font-semibold text-rock-700 hover:bg-rock-100 focus-visible:outline-2 focus-visible:outline-alpine-500"
          >
            ← Back to results
          </button>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-ink">My saved places</h1>
          <p className="mt-1 text-xs sm:text-sm text-dusk">
            Your shortlisted Utah homes and apartment complexes.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="inline-flex self-start rounded-full bg-rock-100 p-1 text-xs font-semibold sm:self-auto">
          {(['all', 'apartment', 'home'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilter(tab)}
              className={`min-h-[44px] inline-flex items-center cursor-pointer rounded-full px-4 py-2 capitalize transition-all focus-visible:outline-2 focus-visible:outline-alpine-500 ${
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

      {/* Content */}
      <div className="mt-8">
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-48 animate-pulse rounded-2xl bg-rock-100/60" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-rock-300 p-8 sm:p-12 text-center">
            <span className="text-3xl">❤️</span>
            <h2 className="mt-3 font-display text-xl font-semibold text-ink">
              No saved {filter === 'all' ? 'places' : filter + 's'} yet
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-dusk max-w-md mx-auto">
              Heart listings from the "Homes for you" tab or inside any town page to keep track of them here.
            </p>
            <button
              type="button"
              onClick={onBack}
              className="mt-5 inline-flex min-h-[44px] items-center rounded-full bg-rock-800 px-6 py-2.5 text-xs font-semibold text-white hover:bg-rock-900 focus-visible:outline-2 focus-visible:outline-alpine-500"
            >
              Browse Utah towns & listings
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((item) => (
              <div key={item.listingId} className="relative">
                <ListingCard
                  item={item.listing!}
                  commentCount={counts[item.listingId]}
                  onSelect={(l) => l.cityId && onOpenTown?.(l.cityId)}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
