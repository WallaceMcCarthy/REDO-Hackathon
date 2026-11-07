import { expect, it } from 'vitest';
import boundary from '../../data/utah-state-boundary.json';
import { insideUtah, nonUtahReasons } from './utah';

it('uses Utah geometry rather than the bounding rectangle', () => {
  expect(insideUtah(-111.891, 40.7608)).toBe(true);
  expect(insideUtah(-113.5684, 37.0965)).toBe(true);
  expect(insideUtah(-112.08, 38.77)).toBe(true); // Rural Utah, outside the scored town set.
  expect(insideUtah(-110, 41.5)).toBe(false); // Wyoming inside Utah's bounding rectangle.
  expect(insideUtah(-112, 36.8)).toBe(false); // Arizona.
  expect(insideUtah(-115, 40)).toBe(false); // Nevada.
  const [lng, lat] = boundary.geometry.coordinates[0][20];
  expect(insideUtah(lng, lat)).toBe(true);
});

it('only reports affirmative non-Utah evidence, preserving missing and null-town locations', () => {
  expect(nonUtahReasons({ address: null, zip: null, lat: null, lng: null })).toEqual([]);
  expect(nonUtahReasons({ address: '123 Main St', zip: '84701', lat: 38.77, lng: -112.08 })).toEqual([]);
  expect(nonUtahReasons({ address: '123 Main St, Evanston, WY 82930', zip: '82930', lat: 41.27, lng: -110.96 }))
    .toEqual(['address_state:WY', 'zip:82930', 'coordinates_outside_utah']);
  expect(nonUtahReasons({ address: '123 Main St, Salt Lake City, UT 84101', zip: '84101', lat: 40.76, lng: -111.89 })).toEqual([]);
  expect(nonUtahReasons({ address: '123 MAIN ST 84101', zip: '84101', lat: 40.76, lng: -111.89 })).toEqual([]);
  expect(nonUtahReasons({ address: '123 Main Rd NE 84101', zip: '84101', lat: 40.76, lng: -111.89 })).toEqual([]);
  expect(nonUtahReasons({ address: '123 Main St, Evanston, WY', zip: null, lat: null, lng: null })).toEqual(['address_state:WY']);
});
