import type { CampaignRecord } from '../../data/adsHooks';
import { safeHttpsHref } from './safeHttpsHref';

/** The one main advertiser for now. Not a campaign row, so it counts no impressions or clicks. */
export const REDO_IT = {
  title: 'REDO IT',
  body: 'We are hiring engineers, product builders, and designers in Utah! Build software that moves mountains.',
  url: 'https://www.linkedin.com/company/redo-tech/',
  lat: 40.5247,
  lng: -111.8638,
};

/** The fixed REDO marker replaces every REDO campaign, including the old Salt Lake City job sample. */
export const isRedoCampaign = (c: { url: string }) => c.url === REDO_IT.url || c.url.startsWith('https://getredo.com/');

const isRental = (listingId: string) => listingId.startsWith('market:for_rent:');

/** Where an ad's click goes: the listing inside this app, or the advertiser's site in a new tab. Undefined when the url is unsafe. */
export function adLink({ listingId, cityId, url }: Pick<CampaignRecord, 'listingId' | 'cityId' | 'url'>) {
  if (listingId) {
    // The app reads a town as the homes view, so a rental opens in the apartments view instead.
    const place: Record<string, string> = isRental(listingId) ? { view: 'apartments' } : cityId ? { town: cityId } : {};
    return { href: `#/results?${new URLSearchParams({ ...place, listing: listingId })}` };
  }
  const href = safeHttpsHref(url);
  return href ? { href, target: '_blank', rel: 'noopener noreferrer' } : undefined;
}

/** The call to action on an ad for a listing. */
export const listingAction = (listingId: string) => (isRental(listingId) ? 'View rental' : 'View home');

/** Featured campaigns for the towns on screen: paid ads, then sample ads for real listings, then other samples. First town first within each. */
export function pickFeatured(featured: CampaignRecord[], townIds: string[], max: number): CampaignRecord[] {
  const order = new Map(townIds.map((id, i) => [id, i]));
  const rank = (c: CampaignRecord) => (c.cityId ? order.get(c.cityId) : townIds.length);
  const tier = (c: CampaignRecord) => (!c.isSample ? 0 : c.listingId ? 1 : 2);
  return [...new Map(featured.map(c => [c._id, c])).values()]
    .filter(c => rank(c) !== undefined)
    .sort((a, b) => tier(a) - tier(b) || rank(a)! - rank(b)!)
    .slice(0, max);
}

/** Keeps items whose boxes do not overlap an earlier kept item, so the set depends on zoom but not on panning. */
export function declutter<T>(items: T[], at: (item: T) => { x: number; y: number }, width: number, height: number): T[] {
  const kept: { item: T; x: number; y: number }[] = [];
  for (const item of items) {
    const { x, y } = at(item);
    if (!kept.some(k => Math.abs(k.x - x) < width && Math.abs(k.y - y) < height)) kept.push({ item, x, y });
  }
  return kept.map(k => k.item);
}
