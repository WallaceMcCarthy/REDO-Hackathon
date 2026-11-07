import { describe, expect, it } from "vitest";
import { isInUtah, nearestTown } from "./adLocation";

describe("nearestTown", () => {
  it("picks the closest town and copes with none", () => {
    const provo = { lat: 40.23, lng: -111.66 }, ogden = { lat: 41.22, lng: -111.97 };
    expect(nearestTown([provo, ogden], 41, -112)).toBe(ogden);
    expect(nearestTown([], 41, -112)).toBeUndefined();
  });

  it("measures real distance, where a degree east is shorter than a degree north", () => {
    const north = { lat: 40.9, lng: -111 }, east = { lat: 40, lng: -109.9 };
    expect(nearestTown([north, east], 40, -111)).toBe(east);
  });
});

describe("isInUtah", () => {
  it("accepts Utah and refuses elsewhere, including a non-number", () => {
    expect(isInUtah(40.76, -111.89)).toBe(true);
    expect(isInUtah(40.71, -74.01)).toBe(false);
    expect(isInUtah(NaN, -111.89)).toBe(false);
  });
});
