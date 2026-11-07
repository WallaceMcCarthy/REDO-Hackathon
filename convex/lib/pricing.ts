/** Server-side campaign price table (cents per day). Never trust a client-sent amount. */
export type CampaignKind = "pin" | "featured" | "job";

export const RATE_CENTS_PER_DAY: Record<CampaignKind, number> = {
  pin: 500,
  featured: 1000,
  job: 700,
};

/** Every self-serve ad runs this long; the form does not ask. */
export const DEFAULT_AD_DAYS = 7;
/** A free ad lets anyone try publishing, so it is short and never needs checkout. */
export const FREE_AD_DAYS = 1;

export function priceCents(kind: CampaignKind, durationDays: number): number {
  const rate = RATE_CENTS_PER_DAY[kind];
  if (rate === undefined) throw new Error(`Unknown campaign kind: ${kind}`);
  return rate * durationDays;
}
