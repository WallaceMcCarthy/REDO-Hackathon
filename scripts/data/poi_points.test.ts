import { describe, expect, it } from "vitest";
import { toPoiFile } from "./poi_points";

describe("POI points", () => {
  it("creates compact, rounded points with distinct types", () => {
    const file = toPoiFile([
      { type: "node", id: 1, lat: 40.760812, lon: -111.891047, tags: { amenity: "restaurant", name: "Cafe One" } },
      { type: "way", id: 2, center: { lat: 40.61, lon: -111.7 }, tags: { tourism: "trailhead", name: "Creek Trail" } },
      { type: "node", id: 3, lat: 40.25, lon: -111.65, tags: { amenity: "school", name: "Central High" } },
    ], [{ name: "Test Ski", lat: 40.5, lng: -111.6 }]);
    expect(file.points).toEqual([
      ["restaurant", "Cafe One", 40.76081, -111.89105],
      ["school", "Central High", 40.25, -111.65],
      ["ski", "Test Ski", 40.5, -111.6],
      ["trail", "Creek Trail", 40.61, -111.7],
    ]);
  });

  it("drops out-of-region and unsupported rows and deduplicates exact POIs", () => {
    const restaurant = { type: "node" as const, id: 1, lat: 40.76, lon: -111.89, tags: { amenity: "cafe", name: "Same" } };
    const file = toPoiFile([
      restaurant, { ...restaurant, id: 2 },
      { type: "node", id: 3, lat: 43, lon: -111, tags: { amenity: "school" } },
      { type: "node", id: 4, lat: 40, lon: -111, tags: { shop: "books" } },
    ], []);
    expect(file.points).toEqual([["restaurant", "Same", 40.76, -111.89]]);
  });

  it("uses honest generic labels when OpenStreetMap has no name", () => {
    const file = toPoiFile([
      { type: "node", id: 1, lat: 40, lon: -111, tags: { amenity: "restaurant" } },
      { type: "relation", id: 2, center: { lat: 40.1, lon: -111.1 }, tags: { route: "hiking" } },
    ], []);
    expect(file.points.map(point => point[1])).toEqual(["Restaurant or cafe", "Trail"]);
  });
});
