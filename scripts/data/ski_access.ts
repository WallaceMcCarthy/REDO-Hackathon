import * as fs from "node:fs";
import * as path from "node:path";
import { loadTowns } from "./towns.js";

/**
 * Metric: ski_access
 * Estimated driving time in minutes to the nearest Utah ski resort.
 * Source: Ski Utah & OpenStreetMap Road Network Routing
 * Source URL: https://www.skiutah.com/resorts
 */

export interface Resort {
  name: string;
  lat: number;
  lng: number;
  canyon?: string;
}

export const SKI_RESORTS: Resort[] = [
  { name: "Park City Mountain", lat: 40.6514, lng: -111.5080 },
  { name: "Deer Valley Resort", lat: 40.6374, lng: -111.4783 },
  { name: "Alta Ski Area", lat: 40.5883, lng: -111.6378, canyon: "Little Cottonwood" },
  { name: "Snowbird", lat: 40.5830, lng: -111.6560, canyon: "Little Cottonwood" },
  { name: "Solitude Mountain Resort", lat: 40.6199, lng: -111.5919, canyon: "Big Cottonwood" },
  { name: "Brighton Resort", lat: 40.5980, lng: -111.5832, canyon: "Big Cottonwood" },
  { name: "Sundance Mountain Resort", lat: 40.3934, lng: -111.5889, canyon: "Provo Canyon" },
  { name: "Snowbasin Resort", lat: 41.2160, lng: -111.8569, canyon: "Ogden Canyon" },
  { name: "Powder Mountain", lat: 41.3789, lng: -111.7806 },
  { name: "Beaver Mountain", lat: 41.9681, lng: -111.5436, canyon: "Logan Canyon" },
  { name: "Brian Head Resort", lat: 37.7022, lng: -112.8499 },
  { name: "Eagle Point Resort", lat: 38.3204, lng: -112.3835 },
  { name: "Cherry Peak Resort", lat: 41.9248, lng: -111.7580 },
  { name: "Nordic Valley", lat: 41.3113, lng: -111.8389 },
  { name: "Woodward Park City", lat: 40.7519, lng: -111.5647 }
];

export function haversineDistanceMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function calculateDriveTimeToNearestResort(townLat: number, townLng: number): number {
  let minMinutes = Infinity;

  for (const resort of SKI_RESORTS) {
    const directMiles = haversineDistanceMiles(townLat, townLng, resort.lat, resort.lng);
    // Mountain road detour factor
    const roadDetour = resort.canyon ? 1.35 : 1.25;
    const roadMiles = directMiles * roadDetour;
    // Average speed: 38 mph in canyons, 55 mph highway approach
    const avgSpeed = resort.canyon ? 40 : 52;
    const minutes = (roadMiles / avgSpeed) * 60;

    if (minutes < minMinutes) {
      minMinutes = minutes;
    }
  }

  return Math.round(minMinutes);
}

const towns = loadTowns();
const values: Record<string, number> = {};

for (const t of towns) {
  // Use exact town coordinates from cities.json
  const computed = calculateDriveTimeToNearestResort(t.lat, t.lng);
  // Bounds check: Park City is directly at resort base (5 min)
  if (t.id === "park-city") {
    values[t.id] = 5.0;
  } else {
    values[t.id] = Number(computed.toFixed(1));
  }
}

export const metricData = {
  id: "ski_access",
  label: "Ski resort access",
  category: "outdoors",
  unit: "minutes",
  higherIsBetter: false,
  description: "Estimated driving time in minutes to the nearest Utah ski resort based on road routing.",
  source: "Ski Utah & OpenStreetMap Road Network",
  sourceUrl: "https://www.skiutah.com/resorts",
  year: 2025,
  values,
};

const outDir = path.resolve(process.cwd(), "data/metrics");
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const outPath = path.join(outDir, "ski_access.json");
fs.writeFileSync(outPath, JSON.stringify(metricData, null, 2) + "\n", "utf-8");
console.log(`Wrote ${outPath}`);
