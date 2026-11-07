import { describe, expect, it } from 'vitest';
import type { CommentItem, SavedListingItem } from './types';

describe('social UI logic', () => {
  it('identifies reported comments that should be hidden (>= 3 reports)', () => {
    const comments: CommentItem[] = [
      {
        _id: 'c1',
        targetType: 'town',
        targetId: 'moab',
        userId: 'u1',
        displayName: 'Alice',
        body: 'Great trails!',
        createdAt: 1000,
        reports: 1,
      },
      {
        _id: 'c2',
        targetType: 'town',
        targetId: 'moab',
        userId: 'u2',
        displayName: 'Spammer',
        body: 'Click my link',
        createdAt: 2000,
        reports: 3,
      },
      {
        _id: 'c3',
        targetType: 'town',
        targetId: 'moab',
        userId: 'u3',
        displayName: 'Bob',
        body: 'Love this town',
        createdAt: 3000,
        reports: 0,
      },
    ];

    const visible = comments.filter((c) => (c.reports ?? 0) < 3 && !c.hidden);
    expect(visible.map((c) => c._id)).toEqual(['c1', 'c3']);
  });

  it('filters saved listings by kind', () => {
    const saved: SavedListingItem[] = [
      {
        listingId: 'apt-1',
        listing: {
          id: 'apt-1',
          cityId: 'salt-lake-city',
          kind: 'apartment',
          name: 'Central Apts',
          address: '100 S Main',
          lat: 40.76,
          lng: -111.89,
          value: null,
          rent: 1748,
          beds: 2,
          sqft: null,
          yearBuilt: 2018,
          year: 2025,
          units: 50,
          propertyType: 'Apartment complex',
          source: 'HUD',
          sourceUrl: 'https://hud.gov',
        },
      },
      {
        listingId: 'home-1',
        listing: {
          id: 'home-1',
          cityId: 'alpine',
          kind: 'home',
          name: null,
          address: '456 Oak Ln',
          lat: 40.45,
          lng: -111.78,
          value: 600000,
          rent: null,
          beds: 4,
          sqft: 2400,
          yearBuilt: 2005,
          year: 2025,
          units: null,
          propertyType: 'Single family',
          source: 'UGRC',
          sourceUrl: 'https://gis.utah.gov',
        },
      },
    ];

    const onlyApts = saved.filter((s) => s.listing?.kind === 'apartment');
    expect(onlyApts.map((s) => s.listingId)).toEqual(['apt-1']);

    const onlyHomes = saved.filter((s) => s.listing?.kind === 'home');
    expect(onlyHomes.map((s) => s.listingId)).toEqual(['home-1']);
  });
});
