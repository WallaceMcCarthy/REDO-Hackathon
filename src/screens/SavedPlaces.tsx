import { useState } from 'react';
import { useConvexAuth } from 'convex/react';
import { useMySaved } from '../data/socialHooks';
import type { ListingKind } from '../../convex/lib/listings';
import { openSignIn } from '../components/auth/AccountMenu';
import SavedButton from '../components/social/SavedButton';
import { formatListingFinancials } from '../components/listings/types';
import type { Listing } from '../components/listings/types';
import { Badge, Button, Card, Chip, EmptyState, PageHeader, Skeleton } from '../components/ui';

interface SavedPlacesProps {
  onBack: () => void;
  onOpenTown?: (cityId: string) => void;
}

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'apartment', label: 'Apartments' },
  { id: 'home', label: 'Homes' },
] as const;

function SavedCard({ listing, onOpenTown }: { listing: Listing; onOpenTown?: (cityId: string) => void }) {
  const fin = formatListingFinancials(listing);
  const name = listing.name || listing.address || 'Residential Property';
  const facts =
    listing.kind === 'apartment'
      ? [listing.units != null && `${listing.units} units`, listing.yearBuilt != null && `Built ${listing.yearBuilt}`]
      : [listing.beds != null && `${listing.beds} beds`, listing.sqft != null && `${listing.sqft.toLocaleString()} sq ft`, listing.yearBuilt != null && `Built ${listing.yearBuilt}`];
  return (
    <Card as="li" raised className="flex min-w-0 flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Badge>{listing.propertyType || (listing.kind === 'apartment' ? 'Apartment' : 'Single Family')}</Badge>
          <h2 className="mt-2 font-display text-title text-text [overflow-wrap:anywhere]">{name}</h2>
          {listing.name && listing.address && <p className="text-small text-text-muted [overflow-wrap:anywhere]">{listing.address}</p>}
        </div>
        <SavedButton listingId={listing.id} initialSaved />
      </div>
      <div className="rounded-control bg-surface-sunken p-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <span className="font-display text-heading text-text">{fin.amountFormatted}</span>
          <Badge>{fin.benchmarkBadge}</Badge>
        </div>
        <p className="mt-1 text-caption text-text-muted">{fin.label}</p>
      </div>
      <p className="text-small text-text-muted">{facts.filter(Boolean).join(' · ')}</p>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 border-t border-border pt-3 text-caption text-text-muted">
        <span title={fin.disclaimer} className="min-w-0 truncate">{listing.source}</span>
        {listing.sourceUrl && (
          <a href={listing.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center font-semibold text-primary-hover underline underline-offset-2">
            Source ↗
          </a>
        )}
      </div>
      {listing.cityId && onOpenTown && (
        <Button variant="secondary" size="sm" onClick={() => onOpenTown(listing.cityId)}>See this town</Button>
      )}
    </Card>
  );
}

export default function SavedPlaces({ onBack, onOpenTown }: SavedPlacesProps) {
  const [filter, setFilter] = useState<'all' | ListingKind>('all');
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const savedItems = useMySaved();

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
                {filtered.map((item) => <SavedCard key={item.listingId} listing={item.listing!} onOpenTown={onOpenTown} />)}
              </ul>
            )}
          </div>
        </>
      )}
    </main>
  );
}
