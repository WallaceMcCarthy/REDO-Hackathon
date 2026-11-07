import { expect, it } from "vitest";
import { municipalFeatures } from "./municipal_boundaries";

it("retains municipal annexes and interior holes without mixing neighbouring towns", () => {
  const outer: [number, number][] = [[0, 0], [4, 0], [4, 4], [0, 4], [0, 0]];
  const hole: [number, number][] = [[1, 1], [1, 2], [2, 2], [2, 1], [1, 1]];
  const annex: [number, number][] = [[5, 5], [6, 5], [6, 6], [5, 6], [5, 5]];
  const result = municipalFeatures([{ id: "town", name: "Town" }], [
    { properties: { NAME: " TOWN " }, geometry: { type: "Polygon", coordinates: [outer, hole] } },
    { properties: { NAME: "Town" }, geometry: { type: "MultiPolygon", coordinates: [[annex]] } },
    { properties: { NAME: "Neighbour" }, geometry: { type: "Polygon", coordinates: [outer] } },
  ]);
  expect(result).toEqual([{ type: "Feature", id: "town", properties: { cityId: "town", name: "Town" }, geometry: { type: "MultiPolygon", coordinates: [[outer, hole], [annex]] } }]);
  expect(() => municipalFeatures([{ id: "missing", name: "Missing" }], [])).toThrow("Missing official");
});
