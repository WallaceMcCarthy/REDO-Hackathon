import * as fs from "fs";
import * as path from "path";

/**
 * Metric: national_parks
 * Driving distance in miles to the nearest Utah National Park (Mighty 5) or premier State Park.
 * Source: National Park Service & Utah State Parks
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

const nationalParksValues: Record<string, number> = {
  "midway": 2.3,
  "moab": 4.2,
  "park-city": 4.8,
  "provo": 5.2,
  "orem": 5.9,
  "heber-city": 6.2,
  "hurricane": 7.9,
  "washington": 8.5,
  "st-george": 10.6,
  "pleasant-grove": 11.0,
  "spanish-fork": 11.9,
  "brigham-city": 12.5,
  "american-fork": 12.7,
  "ephraim": 13.5,
  "kanab": 13.9,
  "ogden": 14.4,
  "cedar-city": 14.5,
  "saratoga-springs": 14.6,
  "vernal": 14.8,
  "lehi": 15.1,
  "tooele": 16.2,
  "roy": 17.8,
  "layton": 18.1,
  "eagle-mountain": 18.9,
  "kaysville": 20.1,
  "cottonwood-heights": 22.1,
  "sandy": 23.7,
  "draper": 23.7,
  "richfield": 24.2,
  "holladay": 24.4,
  "millcreek": 26.5,
  "bountiful": 27.1,
  "riverton": 27.9,
  "murray": 27.9,
  "south-jordan": 28.1,
  "west-jordan": 29.3,
  "herriman": 30.8,
  "taylorsville": 31.0,
  "price": 32.4,
  "salt-lake-city": 32.4,
  "west-valley-city": 33.1,
  "logan": 35.1,
};

export const metricData = {
  id: "national_parks",
  label: "National & State parks",
  category: "outdoors",
  unit: "miles",
  higherIsBetter: false,
  description: "Driving distance in miles to the nearest Utah National Park (Mighty 5) or premier State Park.",
  source: "National Park Service & Utah State Parks",
  sourceUrl: "https://www.nps.gov/state/ut/index.htm",
  year: 2025,
  values: nationalParksValues,
};

const outDir = path.resolve(process.cwd(), "data/metrics");
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const outPath = path.join(outDir, "national_parks.json");
fs.writeFileSync(outPath, JSON.stringify(metricData, null, 2), "utf-8");
console.log(`Wrote ${outPath}`);
