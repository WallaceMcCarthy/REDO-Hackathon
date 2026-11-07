import type { Listing } from '../../../convex/lib/listings';

/** Both homes and apartments can have an exact-address Zillow preview. */
export function shouldFetchListingPreview(kind: Listing['kind']): boolean {
  return kind === 'home' || kind === 'apartment';
}
