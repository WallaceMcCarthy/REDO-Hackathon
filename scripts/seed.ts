// Loads data/cities.json and data/metrics/*.json into Convex.
// seed.replaceAll is an internal mutation, so this goes through the Convex CLI,
// which needs the deploy owner's login. Nobody can wipe data from the browser.
//   npm run seed        -> dev deployment in .env.local
//   npm run seed:prod   -> production deployment
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const readJson = (p: string) => JSON.parse(readFileSync(p, "utf8"));
const cities = existsSync("data/cities.json") ? readJson("data/cities.json") : [];
const dir = "data/metrics";
const metrics = existsSync(dir)
  ? readdirSync(dir).filter((f) => f.endsWith(".json")).sort().map((f) => readJson(join(dir, f)))
  : [];
if (!cities.length) console.warn("No data/cities.json found; seeding 0 cities");
if (!metrics.length) console.warn("No data/metrics/*.json found; seeding 0 metrics");

const args = ["convex", "run", "seed:replaceAll", JSON.stringify({ cities, metrics })];
if (process.argv.includes("--prod")) args.push("--prod");
execFileSync("npx", args, { stdio: "inherit" });
