import { renderToStaticMarkup as html } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { CampaignRecord } from '../../data/adsHooks';
import { MapAd } from './SponsoredMapPins';

const pin = { _id: 'a', kind: 'pin', title: 'Fresh bagels', body: 'Fresh bagels daily', url: 'https://example.com/a', imageUrl: 'https://example.com/i.png' } as CampaignRecord;

describe('MapAd', () => {
  it('is one labelled link to the advertiser, in a new tab that cannot reach back', () => {
    const out = html(<MapAd pin={pin} />);
    expect(out).toMatch(/^<a [^>]*href="https:\/\/example.com\/a"/);
    expect(out).toContain('target="_blank"');
    expect(out).toContain('rel="noopener noreferrer"');
    expect(out).toContain('>Sponsored<');
    expect(out).toContain('Fresh bagels daily');
    expect(out).toContain('<img src="https://example.com/i.png"');
    expect(out.match(/<a /g)).toHaveLength(1);
  });

  it('says Sample on sample ads and keeps Sponsored', () => {
    const out = html(<MapAd pin={{ ...pin, isSample: true }} />);
    expect(out).toContain('>Sample<');
    expect(out).toContain('>Sponsored<');
  });
});
