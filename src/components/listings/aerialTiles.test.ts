import { expect, it } from 'vitest';
import { aerialTiles } from './aerialTiles';

it('places a known Mercator tile intersection at the exact center without gaps', () => {
  const tiles = aerialTiles({ lat: 0, lng: 0, kind: 'home' });
  expect(tiles.map(t => t.url.split('/tile/')[1])).toEqual([
    '18/131071/131071', '18/131071/131072', '18/131072/131071', '18/131072/131072',
  ]);
  const positions = [[-50, -110], [50, -110], [-50, 50], [50, 50]];
  tiles.forEach((tile, i) => {
    expect(tile.left).toBeCloseTo(positions[i][0]);
    expect(tile.top).toBeCloseTo(positions[i][1]);
  });
});

it('covers the entire centered Utah viewport with at most four reusable cached tiles', () => {
  for (const kind of ['home', 'apartment'] as const) {
    const tiles = aerialTiles({ lat: 40.7608, lng: -111.891, kind });
    expect(tiles.length).toBeLessThanOrEqual(4);
    for (const x of [0, 25, 50, 75, 99.99]) {
      for (const y of [0, 25, 50, 75, 99.99]) {
        expect(tiles.some(t => t.left <= x && t.left + 100 > x && t.top <= y && t.top + 160 > y)).toBe(true);
      }
    }
    expect(new Set(tiles.map(t => t.url)).size).toBe(tiles.length);
  }
});
