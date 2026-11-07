import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const NEW = ["population_growth", "net_migration", "owner_occupancy", "flood_risk", "wildfire_risk", "unemployment_rate"];
const CATEGORIES = ["cost", "safety", "environment", "outdoors", "transit", "culture", "education", "community"];
const ids: string[] = JSON.parse(readFileSync("data/cities.json", "utf8")).map((c: { id: string }) => c.id);
const BARRED = /race|racial|ethnic|age|family|household.?type|children|senior|youth/i;

describe.each(NEW)("%s metric file", name => {
  const m = JSON.parse(readFileSync(`data/metrics/${name}.json`, "utf8"));
  it("follows the metric format and covers all 42 towns with finite numbers", () => {
    expect(m.id).toBe(name);
    expect(CATEGORIES).toContain(m.category);
    expect(typeof m.higherIsBetter).toBe("boolean");
    expect(m.sourceUrl).toMatch(/^https:\/\//);
    expect(Object.keys(m.values).sort()).toEqual([...ids].sort());
    for (const v of Object.values(m.values)) expect(Number.isFinite(v)).toBe(true);
  });
  it("is not a race, age or family-status metric", () => {
    expect(`${m.id} ${m.label}`).not.toMatch(BARRED);
  });
});
