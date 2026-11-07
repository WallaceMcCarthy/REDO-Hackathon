import type { CampaignRecord } from '../../data/adsHooks';

/** Featured campaigns for the towns on screen, first town first. Statewide campaigns only fill what is left. */
export function pickFeatured(featured: CampaignRecord[], townIds: string[], max: number): CampaignRecord[] {
  const order = new Map(townIds.map((id, i) => [id, i]));
  const rank = (c: CampaignRecord) => (c.cityId ? order.get(c.cityId) : townIds.length);
  return [...new Map(featured.map(c => [c._id, c])).values()]
    .filter(c => rank(c) !== undefined)
    .sort((a, b) => rank(a)! - rank(b)!)
    .slice(0, max);
}

/** The town closest to a point. Plain degrees are close enough to tell Utah towns apart. */
export function nearestTown<T extends { lat: number; lng: number }>(towns: T[], lat: number, lng: number): T | undefined {
  const distance = (t: T) => (t.lat - lat) ** 2 + (t.lng - lng) ** 2;
  return towns.reduce<T | undefined>((best, t) => (!best || distance(t) < distance(best) ? t : best), undefined);
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
