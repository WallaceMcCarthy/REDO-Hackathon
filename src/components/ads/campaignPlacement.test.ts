import { describe, expect, it } from 'vitest';
import { campaignPlacement, titleRepeatsMessage } from './campaignPlacement';

const NOW = 1_000_000;

describe('campaignPlacement', () => {
  it('tells a pending advertiser it is not visible, with a next step per provider', () => {
    const c = { kind: 'pin', status: 'pending_payment', endsAt: NOW + 1, cityId: 'provo' } as const;
    const stripe = campaignPlacement(c, 'Provo', 'stripe', NOW);
    expect(stripe.text).toMatch(/^Not visible yet/);
    expect(stripe.next).toMatch(/pay at checkout/);
    expect(stripe.link).toBeUndefined();
    expect(campaignPlacement(c, 'Provo', 'none', NOW).next).toMatch(/publish it again/);
  });

  it('links an active campaign to its town page', () => {
    const p = campaignPlacement({ kind: 'pin', status: 'active', endsAt: NOW + 1, cityId: 'park-city' }, 'Park City', 'stripe', NOW);
    expect(p.label).toBe('Live');
    expect(p.text).toContain('Park City town page');
    expect(p.link).toEqual({ href: '#/town/park-city', label: 'See it on the Park City page' });
  });

  it('says every town page for a campaign with no target town', () => {
    expect(campaignPlacement({ kind: 'pin', status: 'active', endsAt: NOW + 1 }, undefined, 'stripe', NOW).text).toContain('every town page');
  });

  it('mentions the map only for a located pin, never a featured slot', () => {
    const live = { status: 'active', endsAt: NOW + 1, cityId: 'provo', lat: 40.2 } as const;
    expect(campaignPlacement({ ...live, kind: 'pin' }, 'Provo', 'none', NOW).text).toContain('on the map');
    expect(campaignPlacement({ ...live, kind: 'featured' }, 'Provo', 'none', NOW).text).not.toContain('on the map');
    expect(campaignPlacement({ ...live, kind: 'pin', lat: undefined }, 'Provo', 'none', NOW).text).not.toContain('on the map');
  });

  it('treats an active campaign past its end date as ended, since the public queries hide it', () => {
    const p = campaignPlacement({ kind: 'pin', status: 'active', endsAt: NOW - 1, cityId: 'provo' }, 'Provo', 'stripe', NOW);
    expect(p.label).toBe('Ended');
    expect(p.link).toBeUndefined();
  });
});

describe('titleRepeatsMessage', () => {
  it('spots a derived title, whole or cut short, and leaves a real business name alone', () => {
    expect(titleRepeatsMessage({ title: 'Fresh bagels daily', body: 'Fresh bagels daily' })).toBe(true);
    expect(titleRepeatsMessage({ title: 'Fresh bag…', body: 'Fresh bagels daily' })).toBe(true);
    expect(titleRepeatsMessage({ title: 'Sego Bakery', body: 'Fresh bagels daily' })).toBe(false);
  });
});
