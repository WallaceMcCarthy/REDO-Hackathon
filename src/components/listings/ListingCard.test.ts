import { describe, expect, it } from 'vitest';
import type { Listing } from '../../../convex/lib/listings';
import { formatListingFinancials } from './types';

describe('formatListingFinancials', () => {
  const homeFixture: Listing = {
    id: 'h-1',
    cityId: 'salt-lake-city',
    kind: 'home',
    name: null,
    address: '123 Main St',
    lat: 40.76,
    lng: -111.89,
    value: 550_000,
    rent: null,
    beds: 3,
    sqft: 1800,
    yearBuilt: 1965,
    units: null,
    propertyType: 'Single family',
    year: 2025,
    source: 'UGRC Salt Lake County LIR parcels 2025',
    sourceUrl: 'https://opendata.gis.utah.gov/',
  };

  const aptFixture: Listing = {
    id: 'apt-1',
    cityId: 'provo',
    kind: 'apartment',
    name: 'Mountain View Apts',
    address: '450 E 500 S',
    lat: 40.23,
    lng: -111.65,
    value: null,
    rent: 1355,
    beds: 2,
    sqft: null,
    yearBuilt: 2012,
    units: 120,
    propertyType: 'Apartment complex',
    year: 2025,
    source: 'HUD LIHTC Database + HUD FY2025 FMR',
    sourceUrl: 'https://lihtc.huduser.gov/',
  };

  it('labels home values as county assessor estimates, never asking prices', () => {
    const financials = formatListingFinancials(homeFixture);
    expect(financials.amountFormatted).toBe('$550k');
    expect(financials.label).toContain('Estimated value (county assessor');
    expect(financials.label.toLowerCase()).not.toContain('price');
    expect(financials.disclaimer).toContain('not an asking price');
  });

  it('formats millions correctly for luxury home values', () => {
    const luxuryHome: Listing = { ...homeFixture, value: 1_850_000 };
    const financials = formatListingFinancials(luxuryHome);
    expect(financials.amountFormatted).toBe('$1.85M');
  });

  it('labels apartment rents as HUD 2-bedroom fair market rent benchmarks', () => {
    const financials = formatListingFinancials(aptFixture);
    expect(financials.amountFormatted).toBe('$1,355/mo');
    expect(financials.label).toContain('HUD 2-bedroom fair market rent');
    expect(financials.benchmarkBadge).toContain('HUD 2-BR benchmark');
    expect(financials.disclaimer).toContain('not asking rent');
  });

  it('handles missing values gracefully without crashing', () => {
    const missingHome: Listing = { ...homeFixture, value: null };
    const financials = formatListingFinancials(missingHome);
    expect(financials.amountFormatted).toBe('N/A');

    const missingApt: Listing = { ...aptFixture, rent: null };
    const aptFinancials = formatListingFinancials(missingApt);
    expect(aptFinancials.amountFormatted).toBe('N/A');
  });
});
