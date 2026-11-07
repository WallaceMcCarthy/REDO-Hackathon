import type { CampaignRecord } from '../../data/adsHooks';

export type Placement = {
  label: 'Pending payment' | 'Live' | 'Ended';
  text: string;
  next?: string;
  link?: { href: string; label: string };
};

const day = (ms: number) => new Date(ms).toLocaleDateString();

/** What the advertiser is told about visibility. Must name only surfaces that really render campaigns. */
export function campaignPlacement(
  c: Pick<CampaignRecord, 'status' | 'endsAt' | 'cityId'>,
  townName: string | undefined,
  provider: 'none' | 'stripe' | undefined,
  now: number,
): Placement {
  if (c.status === 'pending_payment') {
    return {
      label: 'Pending payment',
      text: `Not visible yet. Nobody can see this campaign${provider === 'stripe' ? ' until it is paid for' : ''}.`,
      next: provider === 'stripe'
        ? 'Next step: pay at checkout. If you left checkout, create the campaign again.'
        : 'Next step: publish it again with the form. Ads no longer need payment.',
    };
  }
  if (c.status === 'expired' || c.endsAt <= now) {
    return {
      label: 'Ended',
      text: `No longer visible. It ended on ${day(c.endsAt)}.`,
      next: 'Next step: create a new campaign to run it again.',
    };
  }
  if (!c.cityId) {
    return {
      label: 'Live',
      text: `Visible now in the Sponsored section of every town page, until ${day(c.endsAt)}.`,
      link: { href: '#/results?view=areas', label: 'Browse town pages' },
    };
  }
  const town = townName ?? c.cityId;
  return {
    label: 'Live',
    text: `Visible now in the Sponsored section of the ${town} town page, until ${day(c.endsAt)}.`,
    link: { href: `#/town/${encodeURIComponent(c.cityId)}`, label: `See it on the ${town} page` },
  };
}
