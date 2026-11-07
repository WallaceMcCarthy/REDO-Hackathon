import boundary from '../../data/utah-state-boundary.json';

type Location = { address?: string | null; zip?: string | null; lat: number | null; lng: number | null };
type Point = readonly number[];
const rings = boundary.geometry.coordinates as number[][][];
const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

/** Full official TIGER geometry, including Utah's northeast step; points on the edge count as Utah. */
export function insideUtah(lng: number, lat: number): boolean {
  if (!finite(lng) || !finite(lat) || lng < -114.1 || lng > -109 || lat < 36.9 || lat > 42.1) return false;
  let inside = false;
  for (const ring of rings) {
    let contained = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a: Point = ring[j], b: Point = ring[i];
      const cross = (lng - a[0]) * (b[1] - a[1]) - (lat - a[1]) * (b[0] - a[0]);
      if (Math.abs(cross) < 1e-11 && lng >= Math.min(a[0], b[0]) - 1e-10 && lng <= Math.max(a[0], b[0]) + 1e-10
        && lat >= Math.min(a[1], b[1]) - 1e-10 && lat <= Math.max(a[1], b[1]) + 1e-10) return true;
      if ((a[1] > lat) !== (b[1] > lat) && lng < (b[0] - a[0]) * (lat - a[1]) / (b[1] - a[1]) + a[0]) contained = !contained;
    }
    if (contained) inside = !inside;
  }
  return inside;
}

/** Missing location fields alone are not evidence that a row is outside Utah. */
export function nonUtahReasons(row: Location): string[] {
  const reasons: string[] = [];
  const state = row.address?.trim().match(/(?:,\s*|\s)([A-Z]{2})\s+\d{5}(?:-\d{4})?\s*$/i)?.[1]?.toUpperCase();
  if (state && state !== 'UT') reasons.push(`address_state:${state}`);
  const zip = row.zip?.trim();
  if (zip && !zip.startsWith('84')) reasons.push(`zip:${zip}`);
  if (finite(row.lat) && finite(row.lng) && !insideUtah(row.lng, row.lat)) reasons.push('coordinates_outside_utah');
  return reasons;
}
