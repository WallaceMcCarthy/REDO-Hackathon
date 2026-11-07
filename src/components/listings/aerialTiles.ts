import type { Listing } from './types';

const SERVICE = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer';

/** A 256 × 160 Mercator viewport centered precisely on the property's coordinates.
 * At most four cached tiles cover it; nearby properties reuse the same URLs.
 */
export function aerialTiles(listing: Pick<Listing, 'lat' | 'lng' | 'kind'>) {
  const zoom = listing.kind === 'apartment' ? 17 : 18;
  const scale = 2 ** zoom;
  const lat = Math.max(-85.05112878, Math.min(85.05112878, listing.lat)) * Math.PI / 180;
  const centerX = (listing.lng + 180) / 360 * scale * 256;
  const centerY = (1 - Math.asinh(Math.tan(lat)) / Math.PI) / 2 * scale * 256;
  const left = centerX - 128;
  const top = centerY - 80;
  const tiles = [];
  for (let row = Math.floor(top / 256); row <= Math.floor((top + 160 - 1e-7) / 256); row++) {
    for (let column = Math.floor(left / 256); column <= Math.floor((left + 256 - 1e-7) / 256); column++) {
      tiles.push({
        url: `${SERVICE}/tile/${zoom}/${row}/${column}`,
        left: (column * 256 - left) / 256 * 100,
        top: (row * 256 - top) / 160 * 100,
      });
    }
  }
  return tiles;
}
