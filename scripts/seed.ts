import { ConvexHttpClient } from "convex/browser";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { config } from "dotenv";
import { api } from "../convex/_generated/api";

config({ path: ".env.local" });
const url = process.env.VITE_CONVEX_URL;
if (!url) throw new Error("VITE_CONVEX_URL missing (.env.local)");

const readJson = (p: string) => JSON.parse(readFileSync(p, "utf8"));
const cities = existsSync("data/cities.json") ? readJson("data/cities.json") : [];
const dir = "data/metrics";
const metrics = existsSync(dir)
  ? readdirSync(dir).filter((f) => f.endsWith(".json")).sort().map((f) => readJson(join(dir, f)))
  : [];
if (!cities.length) console.warn("No data/cities.json found; seeding 0 cities");
if (!metrics.length) console.warn("No data/metrics/*.json found; seeding 0 metrics");

const client = new ConvexHttpClient(url);
console.log(await client.mutation(api.seed.replaceAll, { cities, metrics }));
