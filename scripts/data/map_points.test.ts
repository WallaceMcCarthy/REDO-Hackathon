import { describe, expect, it } from "vitest";
import { appendUnrankedSnapshot, toPointsFile } from "./map_points";
import type { MarketInput } from '../../convex/lib/market';

const row = (id: string, over = {}) => ({ id, cityId: "provo", lat: 40.2338412, lng: -111.6585337, value: 400000, rent: null, ...over });

describe("map points file", () => {
  it('augments retained rural Utah from the paid snapshot without adding land, out-of-state or duplicate rows', () => {
    const rural: MarketInput = { rcId: 'rural', market: 'for_sale', address: 'Fixture', city: 'Delta', zip: '84624', lat: 39.3522, lng: -112.5772, price: 250000, beds: 3, baths: 2, sqft: 1500, yearBuilt: 2000, propertyType: 'Single Family', listedDate: null, daysOnMarket: null };
    const snapshot = [rural, rural, { ...rural, rcId: 'rental', market: 'for_rent' as const, price: 1200 },
      { ...rural, rcId: 'land', propertyType: 'Land' }, { ...rural, rcId: 'other-state', zip: '82930', lat: 41.5, lng: -110 },
      { ...rural, rcId: 'wrong-zip', zip: '82930' },
      { ...rural, rcId: 'unknown', lat: null, lng: null }, { ...rural, rcId: 'ranked', lat: 40.2338, lng: -111.6585 }];
    const first = appendUnrankedSnapshot([['existing', 40.23, -111.66, 400000, 'provo'], ['market:for_sale:wrong-zip', 39.3522, -112.5772, 250000, '']], snapshot, 'home');
    expect(first.map(p => p[0])).toEqual(['market:for_sale:rural', 'existing']);
    expect(first[0][4]).toBe('');
    expect(appendUnrankedSnapshot(first, snapshot, 'home')).toEqual(first);
    expect(appendUnrankedSnapshot([], snapshot, 'apartment').map(p => p[0])).toEqual(['market:for_rent:rental']);
  });
  it("keeps the five map fields and rounds coordinates to about a metre", () => {
    expect(toPointsFile([row("a")], "home")).toEqual([["a", 40.23384, -111.65853, 400000, "provo"]]);
  });

  it("uses rent for apartments", () => {
    expect(toPointsFile([row("a", { value: null, rent: 1500 })], "apartment")).toEqual([["a", 40.23384, -111.65853, 1500, "provo"]]);
  });

  it("drops rows outside Utah, including the Wyoming notch", () => {
    const outside = [row("nevada", { lng: -114.2 }), row("idaho", { lat: 42.3 }), row("wyoming", { lat: 41.5, lng: -110 })];
    expect(toPointsFile([row("in"), ...outside], "home").map(p => p[0])).toEqual(["in"]);
  });

  it("drops rows without coordinates or a price", () => {
    expect(toPointsFile([row("no-lat", { lat: null }), row("no-lng", { lng: Number.NaN }), row("no-price", { value: null })], "home")).toEqual([]);
  });

  it("writes the same order however the rows arrive, so a rerun on the same data changes nothing", () => {
    const rows = [row("b", { cityId: "orem" }), row("b"), row("a")];
    expect(toPointsFile(rows, "home")).toEqual(toPointsFile([...rows].reverse(), "home"));
    expect(toPointsFile(rows, "home").map(p => [p[4], p[0]])).toEqual([["orem", "b"], ["provo", "a"], ["provo", "b"]]);
  });
});
