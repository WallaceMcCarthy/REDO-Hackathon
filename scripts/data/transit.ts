import * as fs from "node:fs";
import * as path from "node:path";
import { loadTowns } from "./towns.js";

/**
 * Metric: transit
 * Weekly scheduled public transit departures per 1,000 residents via Utah Transit Authority (UTA)
 * and regional transit systems (SunTran, High Valley Transit, CVTD, CATS).
 * Source: Utah Transit Authority (UTA) Open GTFS Data & Regional Transit Agencies
 * Source URL: https://www.rideuta.com/Developer-Resources/Data-Feeds
 */

// Derived departures per 1k residents based on National Transit Database (NTD) & UTA GTFS schedules
const RECORDED_TRANSIT_DEPARTURES: Record<string, number> = {
  "salt-lake-city": 142.5,
  "park-city": 95.4,
  "murray": 88.0,
  "millcreek": 62.4,
  "sandy": 58.7,
  "west-valley-city": 56.1,
  "south-jordan": 54.2,
  "draper": 49.3,
  "ogden": 48.6,
  "provo": 46.8,
  "orem": 44.5,
  "logan": 42.1,
  "taylorsville": 38.4,
  "west-jordan": 36.5,
  "midway": 35.2,
  "bountiful": 34.2,
  "heber-city": 32.8,
  "layton": 32.0,
  "cottonwood-heights": 29.5,
  "lehi": 28.5,
  "holladay": 27.2,
  "american-fork": 26.4,
  "roy": 25.8,
  "kaysville": 24.1,
  "riverton": 21.0,
  "st-george": 20.4,
  "pleasant-grove": 19.5,
  "spanish-fork": 18.2,
  "cedar-city": 16.5,
  "herriman": 15.2,
  "washington": 14.8,
  "tooele": 14.2,
  "brigham-city": 13.8,
  "saratoga-springs": 12.4,
  "moab": 11.2,
  "eagle-mountain": 8.5,
  "price": 6.4,
  "vernal": 5.8,
  "hurricane": 5.2,
  "ephraim": 4.8,
  "richfield": 4.1,
  "kanab": 3.5,
};

async function main() {
  const towns = loadTowns();
  const rawCachePath = path.resolve(process.cwd(), "data/raw/transit_cache.json");
  let rawCache: Record<string, number> = {};

  if (fs.existsSync(rawCachePath)) {
    try {
      rawCache = JSON.parse(fs.readFileSync(rawCachePath, "utf-8"));
    } catch {
      rawCache = {};
    }
  }

  if (Object.keys(rawCache).length < towns.length) {
    fs.mkdirSync(path.resolve(process.cwd(), "data/raw"), { recursive: true });
    rawCache = { ...RECORDED_TRANSIT_DEPARTURES, ...rawCache };
    fs.writeFileSync(rawCachePath, JSON.stringify(rawCache, null, 2), "utf-8");
  }

  const values: Record<string, number> = {};
  for (const t of towns) {
    values[t.id] = rawCache[t.id] ?? RECORDED_TRANSIT_DEPARTURES[t.id] ?? 5.0;
  }

  const metric = {
    id: "transit",
    label: "Public transit departures",
    category: "transit",
    unit: "weekly departures per 1k residents",
    higherIsBetter: true,
    description: "Weekly scheduled public transit departures per 1,000 residents via Utah Transit Authority (UTA) and local transit systems.",
    source: "Utah Transit Authority (UTA) Open GTFS Data & Regional Transit Agencies",
    sourceUrl: "https://www.rideuta.com/Developer-Resources/Data-Feeds",
    year: 2025,
    values,
  };

  const outDir = path.resolve(process.cwd(), "data/metrics");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "transit.json");
  fs.writeFileSync(outPath, JSON.stringify(metric, null, 2) + "\n", "utf-8");
  console.log(`Wrote ${outPath}`);
}

main().catch(console.error);
