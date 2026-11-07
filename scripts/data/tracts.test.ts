import { describe, expect, it } from "vitest";
import { medianBound, parseAcsNumber, tractRows } from "./tracts";

describe("ACS tract values", () => {
  it("preserves suppressed/missing values instead of turning them into zero", () => {
    for (const raw of [undefined, "", " ", "-666666666", "-999999999", "N", "**", "NaN", "Infinity"]) expect(parseAcsNumber(raw)).toBeNull();
    expect(parseAcsNumber("1234")).toBe(1234);
    expect(parseAcsNumber("0")).toBe(0);
  });
  it("joins by tract GEOID and retains MOEs independently of missing estimates", () => {
    const rows = tractRows(["GEO_ID|B25077_E001|B25077_M001", "1400000US49035100100|400000|12000", "1400000US49035100200|-666666666|5000", "1600000US4967000|500000|3000", "1400000US06037100100|900000|10000"], "B25077");
    expect(rows).toEqual({ "49035100100": { estimate: 400000, moe: 12000, annotation: null }, "49035100200": { estimate: null, moe: 5000, annotation: "-666666666" } });
    expect(() => tractRows(["wrong|columns"], "B25077")).toThrow();
  });
  it("distinguishes open-ended median thresholds from exact dollar estimates", () => {
    expect(medianBound(2000001, "B25077")).toEqual({ value: 2000000, bound: "at_least" });
    expect(medianBound(3501, "B25064")).toEqual({ value: 3500, bound: "at_least" });
    expect(medianBound(1700, "B25064")).toEqual({ value: 1700, bound: null });
    expect(medianBound(null, "B25077")).toEqual({ value: null, bound: null });
  });
});
