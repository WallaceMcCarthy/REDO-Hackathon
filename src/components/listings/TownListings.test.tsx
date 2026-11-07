import { describe, expect, it } from 'vitest';
import type { Listing } from '../../../convex/lib/listings';
import { townListingsView } from './TownListings';

const home = (id: string) => ({ id }) as Listing;
const sample = [home('a'), home('b'), home('c')];

describe('townListingsView', () => {
  it('does not wait on the skipped parcel query outside the Homes tab', () => {
    expect(townListingsView('all', { results: [], status: 'LoadingFirstPage' }, sample, 6).isLoading).toBe(false);
    expect(townListingsView('apartment', { results: [], status: 'LoadingFirstPage' }, sample, 6).isLoading).toBe(false);
  });

  it('waits for the first parcel page on the Homes tab', () => {
    expect(townListingsView('home', { results: [], status: 'LoadingFirstPage' }, sample, 6).isLoading).toBe(true);
  });

  it('shows every loaded parcel and offers more while the database has more', () => {
    const view = townListingsView('home', { results: [home('p1'), home('p2')], status: 'CanLoadMore' }, sample, 1);
    expect(view.visibleListings.map(row => row.id)).toEqual(['p1', 'p2']);
    expect(view.hasMore).toBe(true);
    expect(townListingsView('home', { results: [home('p1')], status: 'Exhausted' }, sample, 1).hasMore).toBe(false);
  });

  it('falls back to the sample when a town has no loaded parcels', () => {
    const view = townListingsView('home', { results: [], status: 'Exhausted' }, sample, 2);
    expect(view.visibleListings.map(row => row.id)).toEqual(['a', 'b']);
    expect(view).toMatchObject({ paged: false, hasMore: true, remaining: 1 });
  });
});
