import { describe, expect, it } from 'vitest';
import { shouldFetchListingPreview } from './previewPolicy';

describe('listing photo preview policy', () => {
  it.each(['home', 'apartment'] as const)('requests a cached preview for %s listings', kind => {
    expect(shouldFetchListingPreview(kind)).toBe(true);
  });
});
