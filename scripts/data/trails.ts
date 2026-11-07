import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { readMethodology, townList, writeMethodology } from "./lib.ts";

/**
 * Metric: trails
 * Count of designated hiking/biking trail infrastructure within 20km of each town,
 * queried live from the OpenStreetMap Overpass API.
 *
 * Overpass QL used (lat/lng substituted per town):
 *   [out:json][timeout:50];
 *   (
 *     way["highway"~"^(path|footway|track|cycleway|bridleway)$"]["sac_scale"](around:20000,{lat},{lng});
 *     relation["route"~"^(hiking|mtb)$"](around:20000,{lat},{lng});
 *   );
 *   out count;
 *
 * This counts ways tagged with sac_scale (the OSM hiking-difficulty tag, which in practice
 * is only applied to actual trails, not urban sidewalks) plus hiking/mountain-biking route
 * relations, so it reflects maintained trail infrastructure rather than every path/footway
 * in town (which would just measure sidewalk density).
 *
 * Endpoints tried in order (first that returns a valid response wins):
 *   1. https://overpass-api.de/api/interpreter        - the main public instance
 *   2. https://overpass.kumi.systems/api/interpreter   - documented public mirror
 *   3. https://maps.mail.ru/osm/tools/overpass/api/interpreter - additional public mirror
 *      (added because, when this script was developed, overpass-api.de returned HTTP 406
 *      to every request from the dev sandbox's network and kumi.systems connected but never
 *      responded; maps.mail.ru/osm/tools/overpass is a known public Overpass instance that
 *      answered real queries with live, current OSM data and was used for the actual run
 *      logged below - see per-town notes in data/raw/trails/<id>.json for which endpoint and
 *      timestamp actually produced each town's count).
 *
 * Each town's raw Overpass JSON response (including the Overpass-reported query timestamp)
 * is cached at data/raw/trails/<id>.json so the count is auditable and reproducible without
 * re-querying. Delete a cache file to force that town to be re-queried live.
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const RAW_DIR = path.join(ROOT, "data", "raw", "trails");

const ENDPOINTS: { url: string; timeoutMs: number }[] = [
  // Main instance: fast to fail if blocked/down, so a short timeout doesn't cost much.
  { url: "https://overpass-api.de/api/interpreter", timeoutMs: 10_000 },
  // Documented mirror: observed to accept the TCP/TLS connection but never respond in
  // this environment, so cap its timeout rather than let it eat the whole run.
  { url: "https://overpass.kumi.systems/api/interpreter", timeoutMs: 12_000 },
  // Additional public mirror (see header comment) - the one that actually answered with
  // live data during development; its real queries took 18-50s, so give it more room.
  { url: "https://maps.mail.ru/osm/tools/overpass/api/interpreter", timeoutMs: 65_000 },
  { url: "https://overpass.private.coffee/api/interpreter", timeoutMs: 65_000 },
  { url: "https://overpass.osm.jp/api/interpreter", timeoutMs: 65_000 },
];

// `npx tsx scripts/data/trails.ts --only draper,x` re-queries just those towns (more retry rounds)
// and merges them into the existing data/metrics/trails.json instead of re-querying all 42.
const onlyArg = process.argv.indexOf("--only");
const ONLY: string[] | null = onlyArg > 0 ? process.argv[onlyArg + 1].split(",") : null;

// How many towns to query concurrently. Kept modest (not 10+) to stay polite to the
// single public mirror that actually answers in this environment; the two dead
// endpoints fail/hang independently per request so they don't add real server load.
const CONCURRENCY = 6;

const RADIUS_M = 20000;
const USER_AGENT = "utahfit-hackathon/1.0 (data pipeline; contact: hackathon@example.com)";

type Town = { id: string; name: string; county: string; lat: number; lng: number };

function loadTowns(): Town[] {
  const citiesPath = path.join(ROOT, "data", "cities.json");
  const cities = JSON.parse(fs.readFileSync(citiesPath, "utf-8"));
  return cities.map((c: any) => ({ id: c.id, name: c.name, county: c.county, lat: c.lat, lng: c.lng }));
}

function buildQuery(lat: number, lng: number): string {
  return (
    `[out:json][timeout:50];(` +
    `way["highway"~"^(path|footway|track|cycleway|bridleway)$"]["sac_scale"](around:${RADIUS_M},${lat},${lng});` +
    `relation["route"~"^(hiking|mtb)$"](around:${RADIUS_M},${lat},${lng});` +
    `);out count;`
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function queryOnce(endpoint: string, query: string, timeoutMs: number): Promise<any> {
  const url = `${endpoint}?data=${encodeURIComponent(query)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: controller.signal,
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} from ${endpoint}: ${text.slice(0, 200)}`);
    }
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`Non-JSON response from ${endpoint}: ${text.slice(0, 200)}`);
    }
    const countElement = (data.elements ?? []).find((e: any) => e.type === "count");
    if (!countElement) {
      throw new Error(`No count element in response from ${endpoint}: ${JSON.stringify(data).slice(0, 300)}`);
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

async function queryWithRetries(
  lat: number,
  lng: number,
  townId: string,
  rounds: number
): Promise<{ data: any; endpoint: string } | null> {
  const query = buildQuery(lat, lng);
  for (let round = 1; round <= rounds; round++) {
    for (const { url: endpoint, timeoutMs } of ENDPOINTS) {
      try {
        console.log(`[${townId}] round ${round}: querying ${endpoint} (timeout ${timeoutMs}ms) ...`);
        const data = await queryOnce(endpoint, query, timeoutMs);
        console.log(`[${townId}] success via ${endpoint}`);
        return { data, endpoint };
      } catch (err: any) {
        console.warn(`[${townId}] ${endpoint} round ${round} failed: ${err?.message ?? err}`);
      }
    }
    if (round < rounds) {
      // Jittered backoff so concurrent workers don't all hammer the one working
      // mirror again at exactly the same moment.
      const backoffMs = 8_000 + Math.floor(Math.random() * 6_000);
      console.log(`[${townId}] all endpoints failed in round ${round}, backing off ${backoffMs}ms before retry...`);
      await sleep(backoffMs);
    }
  }
  return null;
}

/** Simple bounded-concurrency worker pool over a list of items. */
async function runPool<T>(items: T[], concurrency: number, worker: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  async function runWorker() {
    while (next < items.length) {
      const idx = next++;
      await worker(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => runWorker()));
}

function readCachedValue(townId: string): { total: number; endpoint: string } | null {
  const cachePath = path.join(RAW_DIR, `${townId}.json`);
  if (!fs.existsSync(cachePath)) return null;
  try {
    const cached = JSON.parse(fs.readFileSync(cachePath, "utf-8"));
    const countElement = (cached.elements ?? []).find((e: any) => e.type === "count");
    if (!countElement) return null;
    return { total: Number(countElement.tags.total ?? 0), endpoint: cached.__meta?.endpoint ?? "cached" };
  } catch {
    return null;
  }
}

async function fetchAndCacheTown(
  t: Town,
  rounds: number
): Promise<{ total: number; endpoint: string } | null> {
  const cachePath = path.join(RAW_DIR, `${t.id}.json`);
  const cached = readCachedValue(t.id);
  if (cached) {
    console.log(`[${t.id}] using cached result: ${cached.total} (from ${cached.endpoint})`);
    return cached;
  }

  // Small random jitter before a town's first attempt so a batch of concurrent
  // workers doesn't all land on the one working mirror in the same instant.
  await sleep(Math.floor(Math.random() * 2000));

  const result = await queryWithRetries(t.lat, t.lng, t.id, rounds);
  if (!result) {
    console.error(`[${t.id}] FAILED this pass: exhausted all endpoints/retries, no live data obtained.`);
    return null;
  }

  const countElement = result.data.elements.find((e: any) => e.type === "count");
  const total = Number(countElement.tags.total ?? 0);

  const withMeta = {
    ...result.data,
    __meta: {
      townId: t.id,
      lat: t.lat,
      lng: t.lng,
      endpoint: result.endpoint,
      queriedAt: new Date().toISOString(),
      query: buildQuery(t.lat, t.lng),
    },
  };
  fs.writeFileSync(cachePath, JSON.stringify(withMeta, null, 2) + "\n", "utf-8");
  console.log(`[${t.id}] total=${total}, cached at ${cachePath} (via ${result.endpoint})`);
  return { total, endpoint: result.endpoint };
}

async function main() {
  const allTowns = loadTowns();
  const towns = ONLY ? allTowns.filter((t) => ONLY.includes(t.id)) : allTowns;
  if (ONLY && towns.length !== ONLY.length) throw new Error(`unknown town id in --only ${ONLY}`);
  fs.mkdirSync(RAW_DIR, { recursive: true });
  const metricPath = path.join(ROOT, "data", "metrics", "trails.json");
  const previous = ONLY ? JSON.parse(fs.readFileSync(metricPath, "utf-8")) : null;

  const values: Record<string, number> = {};
  const sourceByTown: Record<string, string> = {};
  let stillFailed: Town[] = [];

  console.log(`Pass 1: querying ${towns.length} towns with concurrency ${CONCURRENCY} ...`);
  await runPool(towns, CONCURRENCY, async (t) => {
    const result = await fetchAndCacheTown(t, ONLY ? 6 : 2);
    if (result) {
      values[t.id] = result.total;
      sourceByTown[t.id] = result.endpoint;
    } else {
      stillFailed.push(t);
    }
  });

  // Cleanup pass: retry any stragglers one at a time (lower load, more patience),
  // since most 504s seen in testing were transient "server too busy" responses
  // from the single working public mirror under concurrent load.
  if (stillFailed.length > 0) {
    console.log(
      `\nPass 2 (serial cleanup): retrying ${stillFailed.length} town(s) that failed under concurrency: ` +
        `${stillFailed.map((t) => t.id).join(", ")}`
    );
    const retryList = stillFailed;
    stillFailed = [];
    for (const t of retryList) {
      const result = await fetchAndCacheTown(t, 3);
      if (result) {
        values[t.id] = result.total;
        sourceByTown[t.id] = result.endpoint;
      } else {
        stillFailed.push(t);
      }
      await sleep(2000);
    }
  }

  if (Object.keys(values).length === 0) {
    console.error("\nABORTING: no town could be queried live from any Overpass endpoint. Writing nothing.");
    process.exit(1);
  }

  if (stillFailed.length > 0) {
    console.error(
      `\n${stillFailed.length} town(s) could NOT be queried live after all retries across all endpoints: ` +
        `${stillFailed.map((t) => t.id).join(", ")}. NOT inventing a fallback value for them - they are ` +
        "omitted from this metric's values (the app's scoring code treats a missing value as neutral and " +
        "says so in the town's highlights) rather than silently guessing. Re-run this script later " +
        "(already-cached towns are skipped) to fill them in once the Overpass mirrors are reachable."
    );
  }

  const merged: Record<string, number> = { ...(previous?.values ?? {}), ...values };
  const omitted = allTowns.filter((t) => merged[t.id] === undefined);
  const endpointsUsed = Array.from(new Set(Object.values(sourceByTown))).filter((e) => e !== "cached");
  const queriedDate = new Date().toISOString().slice(0, 10);

  const baseMethodology =
    "Count of OpenStreetMap ways tagged with sac_scale (the hiking-difficulty tag applied to real trails, " +
    "not urban sidewalks) whose highway type is path/footway/track/cycleway/bridleway, plus hiking/mountain-biking " +
    "route relations, within 20km of the town center. Queried live from the Overpass API " +
    `(Overpass QL: [out:json][timeout:50];(way["highway"~"^(path|footway|track|cycleway|bridleway)$"]` +
    `["sac_scale"](around:20000,lat,lng);relation["route"~"^(hiking|mtb)$"](around:20000,lat,lng););out count;) `;
  const queriedNote = `on ${queriedDate}, via ${endpointsUsed.join(" and/or ")} (raw per-town responses cached under data/raw/trails/<town-id>.json).`;
  // In --only mode keep the earlier run's provenance and add this run's, so each town's date and mirror stay auditable.
  const previousMethodology = ONLY ? readMethodology().trails : undefined;
  const methodology =
    (previousMethodology ? previousMethodology.replace(/ \d+ town\(s\) could not be queried live.*$/, "") + ` ${towns.map((t) => t.id).join(", ")} re-queried separately ${queriedNote}` : baseMethodology + queriedNote) +
    (omitted.length > 0
      ? ` ${omitted.length} town(s) could not be queried live after repeated retries across all ` +
        `endpoints and are omitted here rather than guessed: ${omitted.map((t) => t.id).sort().join(", ")}.`
      : "");
  writeMethodology("trails", methodology);
  const description =
    "Count of mapped hiking and mountain-biking trails and routes within 20 km of the town center, from OpenStreetMap. It counts trails, not city sidewalks, and depends on how completely each area has been mapped." +
    (omitted.length > 0 ? ` No count for ${townList(omitted.map((t) => t.id).sort())}, which could not be queried.` : "");
  const metric = {
    id: "trails",
    label: "Hiking & biking trails",
    category: "outdoors",
    unit: "trails within 20km",
    higherIsBetter: true,
    description,
    source: "OpenStreetMap contributors, via the Overpass API",
    sourceUrl: previous?.sourceUrl ?? endpointsUsed[0] ?? ENDPOINTS[0].url,
    year: new Date().getFullYear(),
    values: merged,
  };

  const outDir = path.join(ROOT, "data", "metrics");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "trails.json");
  fs.writeFileSync(outPath, JSON.stringify(metric, null, 2) + "\n", "utf-8");
  console.log(`\nWrote ${outPath}`);
  console.log(`Endpoints used: ${endpointsUsed.join(", ")}`);
  console.log(`Succeeded: ${Object.keys(values).length}/${towns.length} towns.`);
  if (stillFailed.length > 0) {
    console.log(`Failed (omitted, no fallback): ${stillFailed.map((t) => t.id).join(", ")}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
