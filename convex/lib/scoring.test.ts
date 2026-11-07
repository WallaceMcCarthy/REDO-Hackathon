import { describe, expect, it } from "vitest";
import { PERSONAS, PERSONA_WEIGHTS, rankTowns, type City, type Metric } from "./scoring";

const cities: City[] = ["alpine", "desert", "valley"].map((id) => ({
  id, name: id, county: "Test", lat: 0, lng: 0, population: 100, blurb: "Fixture",
}));
const metric = (id: string, values: Record<string, number>, higherIsBetter = true): Metric => ({
  id, values, higherIsBetter, label: id.replaceAll("_", " "), category: "cost", unit: "test",
  description: "Fixture", source: "Fixture", sourceUrl: "https://example.com", year: 2025,
});

describe("rankTowns", () => {
  const metrics = [
    metric("home_value", { alpine: 300, desert: 100, valley: 200 }, false),
    metric("trails", { alpine: 30, desert: 10, valley: 20 }),
  ];

  it("respects direction and produces auditable weighted percentage contributions", () => {
    const ranked = rankTowns(cities, metrics, { home_value: 1, trails: 3 }, {});
    expect(ranked.map((town) => [town.cityId, town.score])).toEqual([["alpine", 75], ["valley", 50], ["desert", 25]]);
    for (const town of ranked) {
      expect(town.breakdown.reduce((sum, item) => sum + item.contribution, 0)).toBeCloseTo(town.score);
      expect(town.breakdown.every((item) => item.normalized >= 0 && item.normalized <= 1)).toBe(true);
    }
    expect(ranked[0].highlights).toContain("Best for trails");
  });

  it("changes the winner when priorities change", () => {
    expect(rankTowns(cities, metrics, { home_value: 5 }, {})[0].cityId).toBe("desert");
    expect(rankTowns(cities, metrics, { trails: 5 }, {})[0].cityId).toBe("alpine");
  });

  it("applies an inclusive budget without renormalizing surviving towns", () => {
    const ranked = rankTowns(cities, metrics, { trails: 5 }, { maxHomeValue: 200 });
    expect(ranked.map((town) => [town.cityId, town.score])).toEqual([["valley", 50], ["desert", 0]]);
  });

  it("checks commute caps and excludes missing measurements only for active filters", () => {
    const commute = metric("commute_minutes", { alpine: 20, valley: 35 }, false);
    expect(rankTowns(cities, [...metrics, commute], { trails: 1 }, { maxCommuteMinutes: 20 }).map((town) => town.cityId)).toEqual(["alpine"]);
    expect(rankTowns(cities, metrics, { trails: 1 }, { maxCommuteMinutes: 20 })).toEqual([]);
    expect(rankTowns(cities, [metric("home_value", { alpine: 100 }, false)], {}, { maxHomeValue: 100 }).map((town) => town.cityId)).toEqual(["alpine"]);
  });

  it("returns deterministic neutral scores without available priorities", () => {
    const result = rankTowns([...cities].reverse(), metrics, { unknown: 5, trails: 0 }, {});
    expect(result.map((town) => [town.cityId, town.score])).toEqual([["alpine", 50], ["desert", 50], ["valley", 50]]);
    expect(result[0].breakdown).toEqual([]);
  });

  it("treats constant metrics and missing values neutrally without inventing raw data", () => {
    const result = rankTowns(cities, [metric("constant", { alpine: 3, desert: 3, valley: 3 }), metric("partial", { alpine: 0, desert: 10 })], { constant: 1, partial: 1 }, {});
    expect(result.map((town) => [town.cityId, town.score])).toEqual([["desert", 75], ["valley", 50], ["alpine", 25]]);
    const valley = result.find((town) => town.cityId === "valley")!;
    expect(valley.breakdown.map((item) => item.metricId)).toEqual(["constant"]);
    expect(valley.highlights).toContain("1 selected measurement is unavailable; scored neutrally");
  });

  it("ignores non-finite data and weights, clamps weights, and ignores towns outside the candidate universe", () => {
    const result = rankTowns(cities, [metric("trails", { alpine: 30, desert: 10, valley: 20, outside: 10000 }), metric("bad", { alpine: NaN, desert: Infinity })], { trails: 100, bad: 5, home_value: -1, other: NaN }, {});
    expect(result.map((town) => town.score)).toEqual([100, 50, 0]);
    expect(result[0].breakdown[0].weight).toBe(5);
    expect(rankTowns(cities, metrics, { trails: Infinity }, {})[0].score).toBe(50);
  });

  it("does not mutate inputs and supports empty data", () => {
    const before = JSON.stringify({ cities, metrics });
    rankTowns(cities, metrics, { trails: 1 }, {});
    expect(JSON.stringify({ cities, metrics })).toBe(before);
    expect(rankTowns([], metrics, {}, {})).toEqual([]);
    expect(rankTowns(cities, [], {}, {})).toHaveLength(3);
  });

  it("suppresses common tied leaders and reserves Best for unique leaders", () => {
    const expanded = [...cities, { ...cities[0], id: "fourth" }, { ...cities[0], id: "fifth" }];
    const common = metric("water_quality", { alpine: 0, desert: 0, valley: 0, fourth: 0, fifth: 1 }, false);
    expect(rankTowns(expanded, [common], { water_quality: 5 }).every((town) => town.highlights.length === 0)).toBe(true);
    const rare = metric("water_quality", { alpine: 0, desert: 0, valley: 1, fourth: 1, fifth: 2 }, false);
    const ranked = rankTowns(expanded, [rare], { water_quality: 5 });
    expect(ranked[0].highlights).toEqual(["Top 3 for water quality"]);
    expect(ranked[1].highlights).toEqual(["Top 3 for water quality"]);
    expect(ranked.find((town) => town.cityId === "valley")!.highlights).toEqual([]);
  });

  it("provides six named persona presets with valid weights", () => {
    expect(Object.keys(PERSONA_WEIGHTS)).toEqual(["skier", "family", "remote_worker", "foodie", "retiree", "student"]);
    for (const persona of Object.values(PERSONAS)) {
      expect(persona.label.length).toBeGreaterThan(0);
      expect(Object.values(persona.weights).every((weight) => weight >= 0 && weight <= 5)).toBe(true);
    }
  });

  it("uses the landed university_access dataset for the student persona", () => {
    const university = metric("university_access", { alpine: 1, desert: 100, valley: 50 }, false);
    const ranked = rankTowns(cities, [university], PERSONA_WEIGHTS.student);
    expect(ranked[0].cityId).toBe("alpine");
    expect(ranked[0].score).toBe(100);
    expect(ranked[0].breakdown[0].metricId).toBe("university_access");
  });
});
