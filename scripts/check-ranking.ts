/** Run after npm run seed: npx tsx scripts/check-ranking.ts */
import assert from "node:assert/strict";
import { config } from "dotenv";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { PERSONA_WEIGHTS, rankTowns, type Filters, type TownScore } from "../convex/lib/scoring";

config({ path: ".env.local", quiet: true });
const url = process.env.VITE_CONVEX_URL;
assert(url, "VITE_CONVEX_URL must point to a seeded backend");
const client = new ConvexHttpClient(url);
const [cities, metrics] = await Promise.all([
  client.query(api.cities.list), client.query(api.metrics.list),
]);
assert.equal(cities.length, 42, "Expected all 42 canonical cities after seeding");
assert.equal(new Set(cities.map((city) => city.id)).size, cities.length, "City IDs must be unique");
assert.equal(new Set(metrics.map((metric) => metric.id)).size, metrics.length, "Metric IDs must be unique");
assert(metrics.length > 0, "Expected real metric datasets after seeding");
for (const metric of metrics) {
  assert(["http:", "https:"].includes(new URL(metric.sourceUrl).protocol), `Source URL missing: ${metric.id}`);
  for (const city of cities) {
    assert(Number.isFinite(metric.values[city.id]), `${metric.id} lacks a measurement for ${city.id}`);
  }
}
const checkRank = (result: TownScore[]) => {
  for (let i = 0; i < result.length; i++) {
    const town = result[i];
    assert(Number.isFinite(town.score) && town.score >= 0 && town.score <= 100, `Invalid score for ${town.cityId}`);
    if (i > 0) assert(result[i - 1].score >= town.score, "Results must be sorted by score");
    for (const entry of town.breakdown) {
      assert(Number.isFinite(entry.raw), `Invalid raw value: ${town.cityId}/${entry.metricId}`);
      assert(entry.normalized >= 0 && entry.normalized <= 1, "Normalized values must be in [0, 1]");
    }
    const sum = town.breakdown.reduce((total, entry) => total + entry.contribution, 0);
    assert(Math.abs(sum - town.score) <= 0.006, `Contributions must explain score: ${town.cityId}`);
  }
};

for (const [persona, weights] of Object.entries(PERSONA_WEIGHTS)) {
  const ranked = await client.query(api.search.rank, { weights, filters: {} });
  assert.equal(ranked.length, 42);
  checkRank(ranked);
  // React imports this same pure scorer: verify its output matches deployed code.
  assert.deepEqual(ranked, rankTowns(cities, metrics, weights, {}), `Client/server ranking mismatch for ${persona}`);
  console.log(`${persona}: ${ranked.slice(0, 3).map((town) => `${town.cityId} (${town.score})`).join(", ")}`);
}

const home = metrics.find((metric) => metric.id === "home_value");
const commute = metrics.find((metric) => metric.id === "commute_minutes");
assert(home, "Seed home_value before checking combined filters");
assert(commute, "Seed commute_minutes before checking commute filters");
const homeValues = cities.map((city) => home.values[city.id]).sort((a, b) => a - b);
const filters: Filters = { maxHomeValue: homeValues[Math.floor(homeValues.length / 2)], maxCommuteMinutes: 25 };
const filtered = await client.query(api.search.rank, { weights: PERSONA_WEIGHTS.family, filters });
checkRank(filtered);
const expectedIds = cities.filter((city) => home.values[city.id] <= filters.maxHomeValue! && commute.values[city.id] <= filters.maxCommuteMinutes!).map((city) => city.id).sort();
assert.deepEqual(filtered.map((town) => town.cityId).sort(), expectedIds, "Filters must enforce both inclusive caps");
assert(filtered.length > 0 && filtered.length < 42, "Smoke-test filters should narrow the real dataset");
console.log(`PASS: ${cities.length} cities, ${metrics.length} metrics; six personas agree across client/server; combined filters retain ${filtered.length} towns.`);
