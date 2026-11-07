import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";

const read = (p: string) => JSON.parse(readFileSync(p, "utf8"));
const towns: string[] = read("data/cities.json").map((c: { id: string }) => c.id);
// Gaps that public sources cannot fill; each must be disclosed in the metric's description.
const KNOWN_GAPS: Record<string, string[]> = {};

describe("metric coverage", () => {
  for (const file of readdirSync("data/metrics").filter((f) => f.endsWith(".json"))) {
    it(`${file} covers every town or discloses the gap`, () => {
      const m = read(`data/metrics/${file}`);
      const missing = towns.filter((id) => typeof m.values[id] !== "number" || !Number.isFinite(m.values[id]));
      expect(missing.sort()).toEqual((KNOWN_GAPS[file] ?? []).sort());
      for (const id of missing) expect(m.description).toContain(id);
      expect(Object.keys(m.values).filter((id) => !towns.includes(id))).toEqual([]);
    });
  }
});
