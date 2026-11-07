import type { Listing as BaseListing, ListingKind, Recommendation as BaseRecommendation } from '../../../convex/lib/listings';

export type Listing = BaseListing & {
  year?: number;
};

export type Recommendation = Omit<BaseRecommendation, 'listing'> & {
  listing: Listing;
};

export type { ListingKind };

export type ListingFilter = {
  kind: ListingKind;
  maxValue?: number;
  maxRent?: number;
};

/**
 * Format listing financial information honestly according to public data sources.
 * Never labels values as asking prices or verified rents.
 */
export function formatListingFinancials(listing: Listing): {
  amountFormatted: string;
  label: string;
  benchmarkBadge: string;
  disclaimer: string;
} {
  if (listing.kind === 'home') {
    const val = listing.value;
    const formatted =
      val == null
        ? 'N/A'
        : val >= 1e6
        ? `$${(val / 1e6).toFixed(2)}M`
        : `$${Math.round(val / 1000)}k`;
    return {
      amountFormatted: formatted,
      label: `Estimated value (county assessor, ${listing.year ?? 2025})`,
      benchmarkBadge: 'Assessor estimate',
      disclaimer: 'County assessor assessment record; not an asking price or appraisal.',
    };
  }

  // Apartment
  const rent = listing.rent;
  const formatted = rent != null ? `$${rent.toLocaleString()}/mo` : 'N/A';
  return {
    amountFormatted: formatted,
    label: 'HUD 2-bedroom fair market rent (county/metro benchmark)',
    benchmarkBadge: 'HUD 2-BR benchmark',
    disclaimer: 'HUD FY2025 Fair Market Rent for this county/metro area; not asking rent.',
  };
}
