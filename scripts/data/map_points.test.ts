import { describe, expect, it } from "vitest";
import { toPointsFile } from "./map_points";

const row = (id: string, over = {}) => ({ id, cityId: "provo", lat: 40.2338412, lng: -111.6585337, value: 400000, rent: null, ...over });

describe("map points file", () => {
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
