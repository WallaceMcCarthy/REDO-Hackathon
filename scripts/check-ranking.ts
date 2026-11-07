/** Run after npm run seed: npx tsx scripts/check-ranking.ts */
import assert from "node:assert/strict";
import { isDeepStrictEqual } from "node:util";
import { config } from "dotenv";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { PERSONA_WEIGHTS, rankTowns, type Filters, type TownScore, type Weights } from "../convex/lib/scoring";

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
let measuredCount = 0;
for (const metric of metrics) {
  assert(["http:", "https:"].includes(new URL(metric.sourceUrl).protocol), `Source URL missing: ${metric.id}`);
  const missing: string[] = [];
  for (const city of cities) {
    if (!Object.hasOwn(metric.values, city.id)) { missing.push(city.id); continue; }
    assert(Number.isFinite(metric.values[city.id]), `${metric.id} has an invalid measurement for ${city.id}`);
    measuredCount += 1;
  }
  assert(missing.length < cities.length, `${metric.id} has no usable observations`);
  if (missing.length) console.warn(`SOURCE GAP: ${metric.id}: ${missing.join(", ")} (scored neutrally, not invented)`);
}
const checkRank = (result: TownScore[], weights: Weights) => {
  const selected = metrics.filter((metric) => weights[metric.id] > 0 && cities.some((city) => Number.isFinite(metric.values[city.id])));
  const totalWeight = selected.reduce((sum, metric) => sum + Math.min(5, weights[metric.id]), 0);
  for (let i = 0; i < result.length; i++) {
    const town = result[i];
    assert(Number.isFinite(town.score) && town.score >= 0 && town.score <= 100, `Invalid score for ${town.cityId}`);
    if (i > 0) assert(result[i - 1].score >= town.score, "Results must be sorted by score");
    for (const entry of town.breakdown) {
      assert(Number.isFinite(entry.raw), `Invalid raw value: ${town.cityId}/${entry.metricId}`);
      assert(entry.normalized >= 0 && entry.normalized <= 1, "Normalized values must be in [0, 1]");
      const metric = metrics.find((item) => item.id === entry.metricId);
      assert(metric && metric.values[town.cityId] === entry.raw, `Breakdown must cite a real observation: ${town.cityId}/${entry.metricId}`);
    }
    const sum = town.breakdown.reduce((total, entry) => total + entry.contribution, 0);
    const missingWeight = selected.filter((metric) => !Number.isFinite(metric.values[town.cityId])).reduce((total, metric) => total + Math.min(5, weights[metric.id]), 0);
    const neutralPoints = totalWeight > 0 ? missingWeight / totalWeight * 50 : 50;
    assert(Math.abs(sum + neutralPoints - town.score) <= 0.006, `Measured contributions plus neutral missing-data points must explain score: ${town.cityId}`);
    if (missingWeight > 0) assert(town.highlights.some((text) => text.includes("unavailable; scored neutrally")), `Missing data must be disclosed: ${town.cityId}`);
  }
};

for (const [persona, weights] of Object.entries(PERSONA_WEIGHTS)) {
  const ranked = await client.query(api.search.rank, { weights, filters: {} });
  assert.equal(ranked.length, 42);
  checkRank(ranked, weights);
  // React imports this same pure scorer: verify its output matches deployed code.
  assert(isDeepStrictEqual(ranked, rankTowns(cities, metrics, weights, {})), `Client/server ranking mismatch for ${persona}`);
  console.log(`${persona}: ${ranked.slice(0, 3).map((town) => `${town.cityId} (${town.score})`).join(", ")}`);
}

const home = metrics.find((metric) => metric.id === "home_value");
const commute = metrics.find((metric) => metric.id === "commute_minutes");
assert(home, "Seed home_value before checking combined filters");
assert(commute, "Seed commute_minutes before checking commute filters");
const homeValues = cities.map((city) => home.values[city.id]).sort((a, b) => a - b);
const filters: Filters = { maxHomeValue: homeValues[Math.floor(homeValues.length / 2)], maxCommuteMinutes: 25 };
const filtered = await client.query(api.search.rank, { weights: PERSONA_WEIGHTS.family, filters });
checkRank(filtered, PERSONA_WEIGHTS.family);
const expectedIds = cities.filter((city) => home.values[city.id] <= filters.maxHomeValue! && commute.values[city.id] <= filters.maxCommuteMinutes!).map((city) => city.id).sort();
assert.deepEqual(filtered.map((town) => town.cityId).sort(), expectedIds, "Filters must enforce both inclusive caps");
assert(filtered.length > 0 && filtered.length < 42, "Smoke-test filters should narrow the real dataset");
console.log(`PASS: ${cities.length} cities, ${metrics.length} metrics, ${measuredCount}/${cities.length * metrics.length} measured town/metric pairs; six personas agree across client/server; missing data explicitly neutral; combined filters retain ${filtered.length} towns.`);
