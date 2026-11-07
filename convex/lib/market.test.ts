import { expect, it } from "vitest";
import { nearestMarketTown, normalizeMarketRow, pricesWithinBudget, type MarketInput } from "./market";

it("assigns only an actual nearby town and handles missing coordinates", () => {
  const cities = [{ id: "provo", lat: 40.23, lng: -111.66 }, { id: "orem", lat: 40.30, lng: -111.69 }];
  expect(nearestMarketTown(40.231, -111.66, cities)).toBe("provo");
  expect(nearestMarketTown(37, -110, cities)).toBeNull();
  expect(nearestMarketTown(null, -111, cities)).toBeNull();
});
it("excludes land, preserves real asking-bedroom data, and computes nullable sort keys", () => {
  const row: MarketInput = { rcId: "record", market: "for_sale", address: "Fixture", city: "Town", zip: null, lat: 40, lng: -111, price: 400000, beds: 3, baths: 2, sqft: 1500, yearBuilt: null, propertyType: "Land", listedDate: null, daysOnMarket: null };
  expect(normalizeMarketRow(row, [], Date.now())).toMatchObject({ residential: false, cityId: null, sortYearBuilt: -1, beds: 3 });
  expect(normalizeMarketRow({ ...row, propertyType: "Single Family", price: -1 }, [], Date.now())).toMatchObject({ residential: true, price: null });
  expect(normalizeMarketRow({ ...row, propertyType: "Single Family", zip: '90210' }, [], Date.now())).toMatchObject({ residential: false });
});
it("counts an inclusive budget with duplicate asking prices and zero matches", () => {
  expect(pricesWithinBudget([100, 200, 200, 400], 200)).toBe(3);
  expect(pricesWithinBudget([100], 0)).toBe(0);
  expect(pricesWithinBudget([], 100)).toBe(0);
  expect(pricesWithinBudget([100, 200])).toBe(2);
});
