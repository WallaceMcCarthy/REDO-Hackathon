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
  ? readdirSync(listingsDir).filter((f) => f.endsWith(".json")).sort().flatMap((f) => {
        // Only arrays of listing rows; skip helper files such as apartments_id_migration.json.
        const rows = readJson(join(listingsDir, f));
        return Array.isArray(rows) ? rows : [];
      })
  : [];
if (listings.length) {
  // Byte-bounded, not row-count-bounded: a fixed row count risks the OS's
  // single-argument size limit (ARG_MAX) on some platforms/shells once rows
  // get bigger (e.g. longer addresses), and risks Convex's ~1MB CLI arg cap
  // either way. 400KB leaves headroom under both.
  const MAX_CHUNK_BYTES = 400_000;
  const MAX_CHUNK_ROWS = 500;
  let chunk: unknown[] = [];
  let chunkBytes = 2; // "[]"
  let seeded = 0;
  let first = true;

  // Clear existing listings in batches first: one mutation deleting every row would exceed Convex's 4096-read limit.
  for (;;) {
    const out = execFileSync("npx", ["convex", "run", "seed:clearListingsBatch", "{}", ...prodFlag], { encoding: "utf8" });
    const deleted = Number(out.trim().split("\n").pop());
    if (!deleted) break;
    console.log(`Cleared ${deleted} listings`);
  }

  function flush() {
    if (chunk.length === 0) return;
    runConvex("seed:replaceListings", { listings: chunk, reset: false });
    seeded += chunk.length;
    console.log(`Seeded listings ${seeded}/${listings.length}`);
    first = false;
    chunk = [];
    chunkBytes = 2;
  }

  for (const row of listings) {
    const rowBytes = JSON.stringify(row).length + 1; // +1 for the separating comma
    if (chunk.length > 0 && (chunkBytes + rowBytes > MAX_CHUNK_BYTES || chunk.length >= MAX_CHUNK_ROWS)) {
      flush();
    }
    chunk.push(row);
    chunkBytes += rowBytes;
  }
  flush();
} else {
  console.warn("No data/listings/*.json found; skipping listings seed");
}
