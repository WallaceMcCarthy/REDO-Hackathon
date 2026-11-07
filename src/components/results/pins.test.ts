import { describe, expect, it } from 'vitest';
import type { Listing } from '../listings/types';
import { keepForKind, PIN_CAP, selectPins, townsInView, type View } from './pins';

const mk = (id: string, lat: number, lng: number): Listing => ({
  id, cityId: 'x', kind: 'home', name: null, address: null, lat, lng, value: 1, rent: null, beds: null,
  sqft: null, yearBuilt: null, units: null, propertyType: null, source: 's', sourceUrl: 'u', year: 2025,
});
const view = (zoom: number): View => ({ south: 40, west: -112, north: 41, east: -111, zoom });

describe('townsInView', () => {
  const cities = [{ id: 'in', lat: 40.5, lng: -111.5 }, { id: 'edge', lat: 41.05, lng: -111.5 }, { id: 'far', lat: 38, lng: -111.5 }];
  it('is empty below zoom 11', () => expect(townsInView(cities, view(10))).toEqual([]));
  it('keeps towns in or just off the viewport', () => expect(townsInView(cities, view(11))).toEqual(['in', 'edge']));
});

describe('selectPins', () => {
  it('shows only recommended pins when zoomed out, even outside the view', () => {
    const rec = [mk('r', 37, -113)];
    const pins = selectPins(rec, [mk('n', 40.5, -111.5)], view(9));
    expect(pins.map(p => [p.listing.id, p.recommended])).toEqual([['r', true]]);
  });
  it('adds in-view nearby pins, dropping off-screen and duplicate ones', () => {
    const pins = selectPins([mk('r', 40.5, -111.5)], [mk('r', 40.5, -111.5), mk('a', 40.6, -111.4), mk('off', 45, -111.5)], view(12));
    expect(pins.map(p => [p.listing.id, p.recommended])).toEqual([['r', true], ['a', false]]);
  });
  it('caps the total, keeps every recommended pin and prefers pins nearest the centre', () => {
    const rec = Array.from({ length: 60 }, (_, i) => mk(`r${i}`, 40.5, -111.5));
    const nearby = Array.from({ length: 500 }, (_, i) => mk(`n${i}`, 40 + i / 500, -111.5));
    const pins = selectPins(rec, nearby, view(12));
    expect(pins).toHaveLength(PIN_CAP);
    expect(pins.filter(p => p.recommended)).toHaveLength(60);
    const far = pins.filter(p => !p.recommended).map(p => Number(p.listing.id.slice(1)));
    expect(Math.min(...far)).toBeGreaterThan(100);
    expect(Math.max(...far)).toBeLessThan(400);
  });
});

describe('keepForKind', () => {
  const prev = { kind: 'home', value: [1] };
  it('prefers the fresh answer', () => expect(keepForKind(prev, 'home', [2])?.value).toEqual([2]));
  it('keeps the previous answer of the same kind while loading', () => expect(keepForKind(prev, 'home', undefined)).toBe(prev));
  it('drops it when the kind changed', () => expect(keepForKind(prev, 'apartment', undefined)).toBeUndefined());
});
