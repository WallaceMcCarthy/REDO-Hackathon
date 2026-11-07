import { describe, expect, it } from "vitest";
import { centroid, inGeometry, rollUp, type Geometry, type TractScore } from "./nri";

const sq = (x: number, y: number, s: number): Geometry => ({ type: "Polygon", coordinates: [[[x, y], [x + s, y], [x + s, y + s], [x, y + s], [x, y]]] });
const score = (tract: string, population: number, s: number): [string, TractScore] => [tract, { tract, population, score: s }];

describe("NRI roll-up", () => {
  it("finds centroids and respects holes", () => {
    expect(centroid(sq(0, 0, 2))).toEqual([1, 1]);
    const donut: Geometry = { type: "Polygon", coordinates: [sq(0, 0, 10).coordinates[0], sq(4, 4, 2).coordinates[0]] };
    expect(inGeometry([5, 5], donut)).toBe(false);
    expect(inGeometry([1, 1], donut)).toBe(true);
  });
  it("weights tracts inside the town by population and ignores outside tracts", () => {
    const town = { id: "t", center: [5, 5] as [number, number], geometry: sq(0, 0, 10) };
    const tracts = [{ tract: "a", geometry: sq(1, 1, 2) }, { tract: "b", geometry: sq(5, 5, 2) }, { tract: "far", geometry: sq(50, 50, 2) }];
    const r = rollUp([town], tracts, new Map([score("a", 100, 10), score("b", 300, 50), score("far", 999, 99)]));
    expect(r.values.t).toBe(40);
    expect(r.centerFallback).toEqual([]);
  });
  it("falls back to the tract holding the town center, and omits a town with nothing", () => {
    const small = { id: "s", center: [20.5, 20.5] as [number, number], geometry: sq(20, 20, 1) };
    const none = { id: "n", center: [90, 90] as [number, number], geometry: sq(90, 90, 1) };
    const r = rollUp([small, none], [{ tract: "big", geometry: sq(10, 10, 16) }], new Map([score("big", 10, 7)]));
    expect(r.values).toEqual({ s: 7 });
    expect(r.centerFallback).toEqual(["s"]);
  });
});
