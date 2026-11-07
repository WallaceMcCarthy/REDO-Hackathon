import * as fs from "node:fs";
import * as path from "node:path";
import { loadTowns } from "./towns.js";

/**
 * Metric: national_parks
 * Modeled driving distance in miles to the nearest Utah National Park (Mighty 5) or premier State Park based on road detour factors.
 * Source: National Park Service & Utah State Parks coordinates, modeled road distances
 * Source URL: https://www.nps.gov/state/ut/index.htm
 */

export interface ParkLocation {
  name: string;
  lat: number;
  lng: number;
  type: "National Park" | "State Park" | "National Monument";
  roadDetour: number;
}

export const PARKS: ParkLocation[] = [
  { name: "Zion National Park", lat: 37.2002, lng: -112.9871, type: "National Park", roadDetour: 1.2 },
  { name: "Bryce Canyon National Park", lat: 37.6403, lng: -112.1695, type: "National Park", roadDetour: 1.25 },
  { name: "Capitol Reef National Park", lat: 38.2913, lng: -111.2615, type: "National Park", roadDetour: 1.25 },
  { name: "Arches National Park", lat: 38.6166, lng: -109.5797, type: "National Park", roadDetour: 1.15 },
  { name: "Canyonlands National Park", lat: 38.4596, lng: -109.8212, type: "National Park", roadDetour: 1.25 },
  { name: "Dead Horse Point State Park", lat: 38.5083, lng: -109.7397, type: "State Park", roadDetour: 1.2 },
  { name: "Goblin Valley State Park", lat: 38.5737, lng: -110.7032, type: "State Park", roadDetour: 1.3 },
  { name: "Snow Canyon State Park", lat: 37.2046, lng: -113.6420, type: "State Park", roadDetour: 1.2 },
  { name: "Sand Hollow State Park", lat: 37.1246, lng: -113.3853, type: "State Park", roadDetour: 1.2 },
  { name: "Coral Pink Sand Dunes State Park", lat: 37.0544, lng: -112.7275, type: "State Park", roadDetour: 1.25 },
  { name: "Cedar Breaks National Monument", lat: 37.6472, lng: -112.8539, type: "National Monument", roadDetour: 1.3 },
  { name: "Wasatch Mountain State Park", lat: 40.5283, lng: -111.5034, type: "State Park", roadDetour: 1.25 },
  { name: "Jordanelle State Park", lat: 40.6277, lng: -111.4283, type: "State Park", roadDetour: 1.2 },
  { name: "Deer Creek State Park", lat: 40.4077, lng: -111.5173, type: "State Park", roadDetour: 1.2 },
  { name: "Utah Lake State Park", lat: 40.2372, lng: -111.7375, type: "State Park", roadDetour: 1.15 },
  { name: "Antelope Island State Park", lat: 41.0374, lng: -112.2467, type: "State Park", roadDetour: 1.35 },
  { name: "Great Salt Lake State Park", lat: 40.7397, lng: -112.2089, type: "State Park", roadDetour: 1.2 },
  { name: "Willard Bay State Park", lat: 41.3719, lng: -112.0722, type: "State Park", roadDetour: 1.15 },
  { name: "Bear Lake State Park", lat: 41.9602, lng: -111.3175, type: "State Park", roadDetour: 1.3 },
  { name: "Dinosaur National Monument", lat: 40.4411, lng: -109.3039, type: "National Monument", roadDetour: 1.2 },
  { name: "Steinaker State Park", lat: 40.5186, lng: -109.5447, type: "State Park", roadDetour: 1.2 },
  { name: "Red Fleet State Park", lat: 40.5897, lng: -109.4319, type: "State Park", roadDetour: 1.2 },
  { name: "Scofield State Park", lat: 39.7891, lng: -111.1278, type: "State Park", roadDetour: 1.3 },
  { name: "Huntington State Park", lat: 39.3364, lng: -110.9636, type: "State Park", roadDetour: 1.25 },
  { name: "Palisade State Park", lat: 39.2133, lng: -111.6669, type: "State Park", roadDetour: 1.2 },
  { name: "Fremont Indian State Park", lat: 38.5772, lng: -112.3392, type: "State Park", roadDetour: 1.25 }
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

const towns = loadTowns();
const values: Record<string, number> = {};

for (const t of towns) {
  let minDistance = Infinity;
  for (const park of PARKS) {
    const directMiles = haversineDistanceMiles(t.lat, t.lng, park.lat, park.lng);
    const roadMiles = directMiles * park.roadDetour;
    if (roadMiles < minDistance) {
      minDistance = roadMiles;
    }
  }
  values[t.id] = Number(minDistance.toFixed(1));
}

export const metricData = {
  id: "national_parks",
  label: "National & State parks",
  category: "outdoors",
  unit: "miles",
  higherIsBetter: false,
  description: "Estimated driving distance in miles to the nearest Utah National Park (Mighty 5) or premier State Park. It is modeled from straight-line distance, not a routed drive.",
  source: "National Park Service & Utah State Parks coordinates, modeled road distances",
  sourceUrl: "https://www.nps.gov/state/ut/index.htm",
  year: 2025,
  values,
};

const outDir = path.resolve(process.cwd(), "data/metrics");
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const outPath = path.join(outDir, "national_parks.json");
fs.writeFileSync(outPath, JSON.stringify(metricData, null, 2) + "\n", "utf-8");
console.log(`Wrote ${outPath}`);
