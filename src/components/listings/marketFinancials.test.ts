import { expect, it } from 'vitest';
import { formatListingFinancials, type Listing } from './types';

it('labels live asking amounts separately from estimated source records', () => {
  const base = { kind: 'home', value: 400000, rent: null, year: 2026 } as Listing;
  expect(formatListingFinancials({ ...base, market: 'for_sale', askingPrice: 425000 })).toMatchObject({ amountFormatted: '$425,000', label: 'Asking price', benchmarkBadge: 'For sale' });
  expect(formatListingFinancials({ ...base, kind: 'apartment', market: 'for_rent', rent: 1800, askingPrice: 1800 })).toMatchObject({ amountFormatted: '$1,800/mo', label: 'Asking rent', benchmarkBadge: 'For rent' });
  expect(formatListingFinancials(base).label).toContain('county assessor');
  expect(formatListingFinancials({ ...base, kind: 'apartment', rent: 1500 }).label).toContain('benchmark');
});
