import { describe, expect, it } from 'vitest';
import type { CampaignRecord } from '../../data/adsHooks';
import { declutter, pickFeatured } from './placement';

const ad = (_id: string, cityId?: string) => ({ _id, cityId }) as CampaignRecord;

describe('pickFeatured', () => {
  const ads = [ad('statewide'), ad('ogden-ad', 'ogden'), ad('moab-ad', 'moab'), ad('provo-ad', 'provo')];

  it('shows only towns on screen, in their order, up to the limit', () => {
    expect(pickFeatured(ads, ['provo', 'ogden'], 2).map(c => c._id)).toEqual(['provo-ad', 'ogden-ad']);
  });
  it('lets a statewide campaign fill a slot no town claimed', () => {
    expect(pickFeatured(ads, ['provo'], 2).map(c => c._id)).toEqual(['provo-ad', 'statewide']);
  });
  it('counts a campaign once when two town queries both return it', () => {
    expect(pickFeatured([ad('statewide'), ad('statewide')], ['provo'], 2).map(c => c._id)).toEqual(['statewide']);
  });
  it('shows nothing before any town is known and no statewide ad exists', () => {
    expect(pickFeatured([ad('moab-ad', 'moab')], [], 2)).toEqual([]);
  });
});

describe('declutter', () => {
  const at = (p: { x: number; y: number }) => p;

  it('drops a pin that would overlap an earlier one and keeps the rest', () => {
    const a = { x: 0, y: 0 }, overlaps = { x: 50, y: 10 }, beside = { x: 120, y: 0 }, below = { x: 50, y: 60 };
    expect(declutter([a, overlaps, beside, below], at, 100, 48)).toEqual([a, beside, below]);
  });
});
