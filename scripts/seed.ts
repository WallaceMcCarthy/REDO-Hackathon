// Loads data/cities.json, data/metrics/*.json, and data/listings/*.json into Convex.
// seed.replaceAll / seed.replaceListings are internal mutations, so this goes through
// the Convex CLI, which needs the deploy owner's login. Nobody can wipe data from the browser.
//   npm run seed        -> dev deployment in .env.local
//   npm run seed:prod   -> production deployment
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const readJson = (p: string) => JSON.parse(readFileSync(p, "utf8"));
const prodFlag = process.argv.includes("--prod") ? ["--prod"] : [];

function runConvex(fn: string, args: unknown) {
  execFileSync("npx", ["convex", "run", fn, JSON.stringify(args), ...prodFlag], { stdio: "inherit" });
}

const cities = existsSync("data/cities.json") ? readJson("data/cities.json") : [];
const metricsDir = "data/metrics";
const metrics = existsSync(metricsDir)
  ? readdirSync(metricsDir).filter((f) => f.endsWith(".json")).sort().map((f) => readJson(join(metricsDir, f)))
  : [];
if (!cities.length) console.warn("No data/cities.json found; seeding 0 cities");
if (!metrics.length) console.warn("No data/metrics/*.json found; seeding 0 metrics");
runConvex("seed:replaceAll", { cities, metrics });

const listingsDir = "data/listings";
const listings = existsSync(listingsDir)
  ? readdirSync(listingsDir).filter((f) => f.endsWith(".json")).sort().flatMap((f) => readJson(join(listingsDir, f)))
  : [];
if (listings.length) {
  const CHUNK = 500;
  for (let i = 0; i < listings.length; i += CHUNK) {
    const chunk = listings.slice(i, i + CHUNK);
    runConvex("seed:replaceListings", { listings: chunk, reset: i === 0 });
    console.log(`Seeded listings ${Math.min(i + CHUNK, listings.length)}/${listings.length}`);
  }
} else {
  console.warn("No data/listings/*.json found; skipping listings seed");
}
