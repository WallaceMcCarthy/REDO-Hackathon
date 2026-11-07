import { describe, expect, it } from "vitest";
import { asHome, insideMunicipality, spatialSample, type Home } from "./listings_homes";

const boundary: [number, number][][] = [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]];
const town = { id: "example", name: "Example", county: "Utah", lat: 5, lng: 5 };
const layer = "https://example.com/FeatureServer/0";
const parcel = {
  attributes: { OBJECTID: 123, PARCEL_ID: "real-123", PARCEL_ADD: "10 Example St", PROP_CLASS: "Residential", TOTAL_MKT_VALUE: 420000, BLDG_SQFT: 1500, BUILT_YR: 1980, HOUSE_CNT: "1", CURRENT_ASOF: Date.UTC(2025, 0, 1) },
  centroid: { x: 5, y: 5 },
};

describe("public home records", () => {
  it("checks municipal polygons, including holes and separate annexed parts", () => {
    expect(insideMunicipality([5, 5], boundary)).toBe(true);
    expect(insideMunicipality([15, 5], boundary)).toBe(false);
    const withHole: [number, number][][] = [...boundary, [[4, 4], [6, 4], [6, 6], [4, 6], [4, 4]]];
    expect(insideMunicipality([5, 5], withHole)).toBe(false);
    expect(insideMunicipality([3, 5], withHole)).toBe(true);
    expect(insideMunicipality([15, 15], [...boundary, [[14, 14], [16, 14], [16, 16], [14, 16], [14, 14]]])).toBe(true);
  });

  it("preserves real assessor values and leaves unavailable bedrooms null", () => {
    const result = asHome(parcel, town, layer, boundary)!;
    expect(result).toMatchObject({ id: "utah-real-123", cityId: "example", value: 420000, sqft: 1500, yearBuilt: 1980, year: 2025, units: 1, beds: null, rent: null });
    expect(result.source).toContain("records as of 2025-01-01");
    expect(result.sourceUrl).toContain("objectIds=123");
    expect(result).not.toHaveProperty("owner");
  });

  it("rejects nonresidential, unvalued, undated, outside-town, and multi-unit records", () => {
    for (const changes of [{ PROP_CLASS: "Commercial" }, { TOTAL_MKT_VALUE: 0 }, { CURRENT_ASOF: null }, { HOUSE_CNT: "4" }, { HOUSE_CNT: "1-3" }]) {
      expect(asHome({ ...parcel, attributes: { ...parcel.attributes, ...changes } }, town, layer, boundary)).toBeNull();
    }
    expect(asHome({ ...parcel, centroid: { x: 20, y: 20 } }, town, layer, boundary)).toBeNull();
  });

  it("allows missing optional sqft when the source establishes a building", () => {
    const unknownSize = { ...parcel, attributes: { ...parcel.attributes, BLDG_SQFT: null } };
    expect(asHome(unknownSize, town, layer, boundary)).toMatchObject({ sqft: null, yearBuilt: 1980 });
    expect(asHome({ ...unknownSize, attributes: { ...unknownSize.attributes, BUILT_YR: null } }, town, layer, boundary)).toBeNull();
  });

  it("spreads a limited sample across occupied cells and deduplicates parcels", () => {
    const home = asHome(parcel, town, layer, boundary)!;
    const rows = ["a", "b", "c", "d"].map((id): Home => ({ ...home, id }));
    expect(spatialSample([[rows[0], rows[1]], [rows[2], rows[3]]], 2).map((row) => row.id)).toEqual(["a", "c"]);
    expect(spatialSample([[rows[0], rows[1]], [rows[0], rows[2]]], 10).map((row) => row.id)).toEqual(["a", "b", "c"]);
    expect(spatialSample([], 60)).toEqual([]);
  });
});
