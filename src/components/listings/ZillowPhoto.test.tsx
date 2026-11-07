import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import ZillowPhoto from './ZillowPhoto';
import type { Listing } from './types';
import type { ZillowPreview } from './useZillowPreview';

it('keeps a Zillow preview photo inside the listing card rather than linking away', () => {
  const listing = { id: 'fixture', kind: 'home', address: 'Fixture address', lat: 40, lng: -111 } as Listing;
  const preview = { imageUrl: 'https://photos.zillowstatic.com/fp/photo.jpg', pageUrl: 'https://www.zillow.com/homes/fixture/' } as ZillowPreview;
  const html = renderToStaticMarkup(<ZillowPhoto listing={listing} preview={preview} fallbackUrl="https://www.zillow.com/homes/" />);
  expect(html).toContain('Photo of Fixture address from Zillow');
  expect(html).toContain('https://photos.zillowstatic.com/fp/photo.jpg');
  expect(html).not.toContain('<a ');
});

it('shows the aerial instead of the Zillow app icon that photoless pages return', () => {
  const listing = { id: 'fixture', kind: 'home', address: 'Fixture address', lat: 40, lng: -111 } as Listing;
  const preview = { imageUrl: 'https://www.zillow.com/apple-touch-icon.png', pageUrl: null } as ZillowPreview;
  const html = renderToStaticMarkup(<ZillowPhoto listing={listing} preview={preview} fallbackUrl="https://www.zillow.com/homes/" />);
  expect(html).not.toContain('apple-touch-icon');
  expect(html).not.toContain('from Zillow');
});
