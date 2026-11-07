/** One cached regional OSM retrieval for restaurants and arts/culture venues. */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { haversineKm } from "./osmlib.ts";

export type Town = { id: string; name: string; lat: number; lng: number; population: number };
export type Poi = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags: Record<string, string>;
};
type OsmResponse = {
  elements: Poi[];
  osm3s: { timestamp_osm_base: string; copyright: string };
  remark?: string;
};

const ROOT = new URL("../../", import.meta.url);
export const SOURCE_URL = "https://overpass-api.de/api/interpreter";
// Padding includes every 15 km catchment around the canonical Utah towns.
export const QUERY = `[out:json][timeout:90];
(
  nwr["amenity"~"^(restaurant|cafe|theatre|arts_centre|music_venue)$"](36.8,-114.3,42.2,-108.8);
  nwr["tourism"~"^(gallery|museum)$"](36.8,-114.3,42.2,-108.8);
);
out center tags;`;

export async function loadCulture(): Promise<{ towns: Town[]; osm: OsmResponse }> {
  const towns: Town[] = JSON.parse(await readFile(new URL("data/cities.json", ROOT), "utf8"));
  if (towns.length !== 42 || towns.some((town) => !Number.isFinite(town.population) || town.population <= 0)) {
    throw new Error("Expected 42 canonical towns with valid populations");
  }
  const cache = new URL("data/raw/culture_osm.json", ROOT);
  const valid = (value: OsmResponse) => {
    if (value.remark || !Array.isArray(value.elements) || value.elements.length === 0 || !value.osm3s?.timestamp_osm_base) {
      throw new Error(`Incomplete Overpass response: ${value.remark ?? "missing elements/timestamp"}`);
    }
    return value;
  };
  if (!process.argv.includes("--refresh")) {
    try {
      const cached = JSON.parse(await readFile(cache, "utf8"));
      if (cached.query === QUERY) return { towns, osm: valid(cached.response) };
    } catch { /* Missing/invalid cache: retrieve a complete response. */ }
  }
  const endpoint = process.env.OVERPASS_URL ?? SOURCE_URL;
  console.log(`Retrieving culture POIs from ${endpoint}`);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "User-Agent": "UtahFit-research/1.0", "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ data: QUERY }),
    signal: AbortSignal.timeout(110_000),
  });
  if (!response.ok) throw new Error(`Overpass returned ${response.status}; rerun later or set OVERPASS_URL to a public mirror`);
  const osm = valid(await response.json() as OsmResponse);
  await mkdir(new URL("data/raw/", ROOT), { recursive: true });
  await writeFile(cache, JSON.stringify({ endpoint, query: QUERY, retrievedAt: new Date().toISOString(), response: osm }, null, 2) + "\n");
  console.log(`Cached ${osm.elements.length} mapped features (OSM base ${osm.osm3s.timestamp_osm_base})`);
  return { towns, osm };
}

export function countNearby(town: Town, pois: Poi[], radiusKm: number, accepts: (tags: Poi["tags"]) => boolean): number {
  const unique = new Set<string>();
  for (const poi of pois) {
    if (!poi.tags || !accepts(poi.tags)) continue;
    const lat = poi.lat ?? poi.center?.lat;
    const lon = poi.lon ?? poi.center?.lon;
    if (lat === undefined || lon === undefined || !Number.isFinite(lat) || !Number.isFinite(lon)) {
      throw new Error(`Missing coordinates for OSM ${poi.type}/${poi.id}`);
    }
    if (haversineKm([town.lat, town.lng], [lat, lon]) <= radiusKm) unique.add(`${poi.type}/${poi.id}`);
  }
  return unique.size;
}

export async function writeCultureMetric(id: string, metric: object) {
  await mkdir(new URL("data/metrics/", ROOT), { recursive: true });
  await writeFile(new URL(`data/metrics/${id}.json`, ROOT), JSON.stringify(metric, null, 2) + "\n");
}
