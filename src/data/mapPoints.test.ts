import { describe, expect, it } from 'vitest';
import type { Listing } from '../../convex/lib/listings';
import { mapPins, type MapPin } from './mapPoints';

const point = (id: string, value: number, cityId = 'provo'): MapPin => ({ id, cityId, kind: 'home', lat: 40, lng: -111, value, rent: null });
const rental = (id: string, rent: number): MapPin => ({ id, cityId: 'provo', kind: 'apartment', lat: 40, lng: -111, value: null, rent });
const listing = (id: string, value: number) => ({ ...point(id, value), source: 'RentCast' }) as Listing;
const ids = (pins: MapPin[]) => pins.map(p => p.id);

describe('mapPins', () => {
  const points = [point('a', 300_000), point('b', 400_000), point('c', 500_000, 'orem')];

  it('keeps every point when nothing limits the list', () => {
    expect(ids(mapPins(points, []))).toEqual(['a', 'b', 'c']);
  });

  it('includes a home priced exactly at the cap, as the list does', () => {
    expect(ids(mapPins(points, [], 400_000))).toEqual(['a', 'b']);
  });

  it('caps rent the same way', () => {
    expect(ids(mapPins([rental('r1', 1400), rental('r2', 1600)], [], 1500))).toEqual(['r1']);
  });

  it('shows nothing under a zero budget', () => {
    expect(mapPins(points, [], 0)).toEqual([]);
  });

  it('limits points to the given towns', () => {
    expect(ids(mapPins(points, [], undefined, new Set(['orem'])))).toEqual(['c']);
    expect(mapPins(points, [], undefined, new Set())).toEqual([]);
  });

  it('applies the cap and the towns together', () => {
    expect(mapPins(points, [], 400_000, new Set(['orem']))).toEqual([]);
  });

  it('prefers the loaded listing over its point, so its details stay available', () => {
    const loaded = listing('a', 300_000);
    const pins = mapPins(points, [loaded]);
    expect(pins.filter(p => p.id === 'a')).toEqual([loaded]);
    expect(pins).toHaveLength(3);
  });

  it('keeps a loaded listing the snapshot does not have yet', () => {
    expect(ids(mapPins(points, [listing('new', 300_000)], 300_000))).toEqual(['new', 'a']);
  });
});
