import { useState } from 'react';
import { useConvexAuth } from 'convex/react';
import { useListingCommentCounts, useMySaved } from '../data/socialHooks';
import type { ListingKind } from '../../convex/lib/listings';
import { openSignIn } from '../components/auth/AccountMenu';
import ListingCard from '../components/listings/ListingCard';
import { Button, Chip, EmptyState, PageHeader, Skeleton } from '../components/ui';

interface SavedPlacesProps {
  onBack: () => void;
  onOpenTown?: (cityId: string) => void;
}

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'apartment', label: 'Apartments' },
  { id: 'home', label: 'Homes' },
] as const;

export default function SavedPlaces({ onBack, onOpenTown }: SavedPlacesProps) {
  const [filter, setFilter] = useState<'all' | ListingKind>('all');
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const savedItems = useMySaved();
  const counts = useListingCommentCounts((savedItems || []).map((i) => i.listingId));

  const all = (savedItems || []).filter((item) => item.listing);
  const count = (id: string) => all.filter((item) => id === 'all' || item.listing!.kind === id).length;
  const filtered = all.filter((item) => filter === 'all' || item.listing!.kind === filter);
  const loading = authLoading || (isAuthenticated && savedItems === undefined);
  const noun = filter === 'all' ? 'places' : filter === 'home' ? 'homes' : 'apartments';

  return (
    <main className="mx-auto max-w-5xl px-gutter pb-section pt-stack">
      <Button variant="ghost" size="sm" onClick={onBack} className="-ml-4">← Back to results</Button>
      <PageHeader title="My saved places" description="Your shortlisted Utah homes and apartment complexes." className="mt-2" />

      {!authLoading && !isAuthenticated ? (
        <EmptyState
          className="mt-stack"
          title="Sign in to see your saved places"
          description="Tap the heart on any home or apartment to keep it. Sign in and your shortlist follows you from phone to laptop."
          action={<Button onClick={openSignIn}>Sign in</Button>}
        />
      ) : (
        <>
          <div role="group" aria-label="Filter saved places" className="mt-stack flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <Chip key={f.id} pressed={filter === f.id} onClick={() => setFilter(f.id)}>
                {f.label}{savedItems ? ` (${count(f.id)})` : ''}
              </Chip>
            ))}
          </div>

          <div className="mt-stack" aria-busy={loading || undefined}>
            {loading ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[0, 1, 2].map((i) => <Skeleton key={i} className="h-64" />)}
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState
                title={`No saved ${noun} yet`}
                description={
                  all.length > 0
                    ? 'You have saved places in another filter. Show everything to see them.'
                    : 'Tap the heart on a home in Homes for you, or on any town page, and it will wait for you here.'
                }
                action={
                  all.length > 0 ? (
                    <Button variant="secondary" onClick={() => setFilter('all')}>Show all saved places</Button>
                  ) : (
                    <Button href="#/results">Browse homes</Button>
                  )
                }
              />
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((item) => (
                  <li key={item.listingId}>
                    <ListingCard item={item.listing!} commentCount={counts[item.listingId]} onSelect={(l) => l.cityId && onOpenTown?.(l.cityId)} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </main>
  );
}
