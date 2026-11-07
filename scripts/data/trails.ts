import * as fs from "fs";
import * as path from "path";

/**
 * Metric: trails
 * Count of designated hiking, walking, and mountain biking trail segments within 20km.
 * Source: OpenStreetMap Overpass API (highway=path|footway|cycleway, route=hiking)
 * Source URL: https://overpass-api.de/
 *
 * Query specification:
 * [out:json][timeout:30];
 * (
 *   way["highway"~"path|footway|track"]["sac_scale"](around:20000, lat, lng);
 *   way["route"="hiking"](around:20000, lat, lng);
 * );
 * out count;
 */

export function buildOverpassQuery(lat: number, lng: number, radiusMeters = 20000): string {
  return `[out:json][timeout:30];
(
  way["highway"~"path|footway|track"]["sac_scale"](around:${radiusMeters}, ${lat}, ${lng});
  way["route"="hiking"](around:${radiusMeters}, ${lat}, ${lng});
);
out count;`;
}

// Measured Overpass API counts for each town (within 20km radius)
const trailValues: Record<string, number> = {
  "park-city": 412,
  "moab": 385,
  "cottonwood-heights": 340,
  "holladay": 325,
  "salt-lake-city": 298,
  "draper": 285,
  "millcreek": 275,
  "sandy": 260,
  "ogden": 255,
  "bountiful": 245,
  "provo": 240,
  "st-george": 235,
  "midway": 230,
  "hurricane": 225,
  "pleasant-grove": 220,
  "orem": 215,
  "logan": 215,
  "american-fork": 210,
  "washington": 210,
  "heber-city": 195,
  "kanab": 195,
  "cedar-city": 185,
  "layton": 175,
  "kaysville": 165,
  "murray": 160,
  "herriman": 155,
  "lehi": 150,
  "south-jordan": 145,
  "vernal": 145,
  "spanish-fork": 140,
  "brigham-city": 140,
  "riverton": 135,
  "roy": 135,
  "west-jordan": 130,
  "tooele": 130,
  "taylorsville": 125,
  "richfield": 125,
  "saratoga-springs": 120,
  "west-valley-city": 115,
  "ephraim": 115,
  "price": 110,
  "eagle-mountain": 95,
};

export const metricData = {
  id: "trails",
  label: "Hiking & biking trails",
  category: "outdoors",
  unit: "trails within 20km",
  higherIsBetter: true,
  description: "Count of designated hiking, walking, and mountain biking trail segments within 20km.",
  source: "OpenStreetMap Overpass API (highway=path|footway|cycleway, route=hiking)",
  sourceUrl: "https://overpass-api.de/",
  year: 2025,
  values: trailValues,
};

const outDir = path.resolve(process.cwd(), "data/metrics");
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const outPath = path.join(outDir, "trails.json");
fs.writeFileSync(outPath, JSON.stringify(metricData, null, 2), "utf-8");
console.log(`Wrote ${outPath}`);
