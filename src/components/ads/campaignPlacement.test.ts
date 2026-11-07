import { describe, expect, it } from 'vitest';
import { campaignPlacement } from './campaignPlacement';

const NOW = 1_000_000;

describe('campaignPlacement', () => {
  it('tells a pending advertiser it is not visible, with a next step per provider', () => {
    const c = { status: 'pending_payment', endsAt: NOW + 1, cityId: 'provo' } as const;
    const stripe = campaignPlacement(c, 'Provo', 'stripe', NOW);
    expect(stripe.text).toMatch(/^Not visible yet/);
    expect(stripe.next).toMatch(/pay at checkout/);
    expect(stripe.link).toBeUndefined();
    expect(campaignPlacement(c, 'Provo', 'none', NOW).next).toMatch(/publish it again/);
  });

  it('links an active campaign to its town page', () => {
    const p = campaignPlacement({ status: 'active', endsAt: NOW + 1, cityId: 'park-city' }, 'Park City', 'stripe', NOW);
    expect(p.label).toBe('Live');
    expect(p.text).toContain('Park City town page');
    expect(p.link).toEqual({ href: '#/town/park-city', label: 'See it on the Park City page' });
  });

  it('says every town page for a campaign with no target town', () => {
    expect(campaignPlacement({ status: 'active', endsAt: NOW + 1 }, undefined, 'stripe', NOW).text).toContain('every town page');
  });

  it('treats an active campaign past its end date as ended, since the public queries hide it', () => {
    const p = campaignPlacement({ status: 'active', endsAt: NOW - 1, cityId: 'provo' }, 'Provo', 'stripe', NOW);
    expect(p.label).toBe('Ended');
    expect(p.link).toBeUndefined();
  });
});
