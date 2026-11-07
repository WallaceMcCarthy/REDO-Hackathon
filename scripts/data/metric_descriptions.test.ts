import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";

const read = (p: string) => JSON.parse(readFileSync(p, "utf8"));
const methodology: Record<string, string> = read("data/metrics-methodology.json");

// Descriptions are shown to end users, so internal notes live in data/metrics-methodology.json.
describe("metric descriptions", () => {
  for (const file of readdirSync("data/metrics").filter((f) => f.endsWith(".json"))) {
    const m = read(`data/metrics/${file}`);
    it(`${m.id} is plain user-facing text with a methodology record`, () => {
      for (const banned of [".json", "Overpass QL", "http"]) expect(m.description).not.toContain(banned);
      expect(m.description).not.toMatch(/\brepo\b/i);
      expect(m.description.length).toBeLessThanOrEqual(400);
      expect(typeof methodology[m.id]).toBe("string");
      expect(methodology[m.id].length).toBeGreaterThan(0);
    });
  }
});
