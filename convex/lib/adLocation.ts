/** Geographic bounding box covering the state of Utah */
export const UTAH_BOUNDS = {
  minLat: 36.9,
  maxLat: 42.1,
  minLng: -114.1,
  maxLng: -108.9,
};

// Written as positive range checks so NaN fails. shortcut: a box also admits the Wyoming notch, use the state outline if that matters.
export const isInUtah = (lat: number, lng: number) =>
  lat >= UTAH_BOUNDS.minLat && lat <= UTAH_BOUNDS.maxLat && lng >= UTAH_BOUNDS.minLng && lng <= UTAH_BOUNDS.maxLng;

/** The town closest to a point. A degree of longitude is shorter than a degree of latitude, so it is scaled to match. */
export function nearestTown<T extends { lat: number; lng: number }>(towns: T[], lat: number, lng: number): T | undefined {
  const lngScale = Math.cos((lat * Math.PI) / 180);
  const distance = (t: T) => (t.lat - lat) ** 2 + ((t.lng - lng) * lngScale) ** 2;
  return towns.reduce<T | undefined>((best, t) => (!best || distance(t) < distance(best) ? t : best), undefined);
}
