/** Build the compact, browser-served POI layer used by the Results map.
 *
 * Run: npx tsx scripts/data/poi_points.ts
 * Override a busy Overpass mirror with OVERPASS_URL. The raw response is cached
 * under data/raw/ (gitignored); --from-raw rebuilds without network access.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export type PoiKind = "restaurant" | "trail" | "ski" | "school";
export type PoiPoint = [kind: PoiKind, name: string, lat: number, lng: number];
export type PoiFile = {
  version: 1;
  sources: Record<PoiKind, string>;
  points: PoiPoint[];
};

type OsmElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

type Resort = { name: string; lat: number; lng: number };
// Ski Utah locations used by scripts/data/ski_access.ts, repeated here so importing this
// generator never runs that script's file-writing main body as a side effect.
const SKI_RESORTS: Resort[] = [
  ["Park City Mountain", 40.6514, -111.5080], ["Deer Valley Resort", 40.6374, -111.4783],
  ["Alta Ski Area", 40.5883, -111.6378], ["Snowbird", 40.5830, -111.6560],
  ["Solitude Mountain Resort", 40.6199, -111.5919], ["Brighton Resort", 40.5980, -111.5832],
  ["Sundance Mountain Resort", 40.3934, -111.5889], ["Snowbasin Resort", 41.2160, -111.8569],
  ["Powder Mountain", 41.3789, -111.7806], ["Beaver Mountain", 41.9681, -111.5436],
  ["Brian Head Resort", 37.7022, -112.8499], ["Eagle Point Resort", 38.3204, -112.3835],
  ["Cherry Peak Resort", 41.9248, -111.7580], ["Nordic Valley", 41.3113, -111.8389],
  ["Woodward Park City", 40.7519, -111.5647],
].map(([name, lat, lng]) => ({ name: String(name), lat: Number(lat), lng: Number(lng) }));

const RAW = "data/raw/poi_points_osm.json";
const OUT = "public/data/poi-points.json";
const MAX_BYTES = 2_000_000;
const SOURCE = "https://www.openstreetmap.org/copyright";
type Town = { id: string; lat: number; lng: number };
const queryForTowns = (towns: readonly Town[]) => `[out:json][timeout:60];(${towns.map(t => `
  node["amenity"~"^(restaurant|cafe|school)$"](around:15000,${t.lat},${t.lng});
  nwr["tourism"="trailhead"](around:20000,${t.lat},${t.lng});
  relation["route"~"^(hiking|mtb)$"](around:20000,${t.lat},${t.lng});`).join("")}
);out center tags;`;

const round5 = (n: number) => Math.round(n * 1e5) / 1e5;
const inUtahBox = (lat: number, lng: number) => lat >= 36.95 && lat <= 42.05 && lng >= -114.1 && lng <= -108.9;

function kindOf(tags: Record<string, string>): PoiKind | null {
  if (tags.amenity === "restaurant" || tags.amenity === "cafe") return "restaurant";
  if (tags.amenity === "school") return "school";
  if (tags.tourism === "trailhead" || tags.route === "hiking" || tags.route === "mtb") return "trail";
  return null;
}

/** Convert source rows to deterministic compact tuples, deduped by type/name/location. */
export function toPoiFile(elements: readonly OsmElement[], resorts: readonly Resort[] = SKI_RESORTS): PoiFile {
  const seen = new Set<string>();
  const points: PoiPoint[] = [];
  for (const element of elements) {
    const tags = element.tags ?? {};
    const kind = kindOf(tags);
    const lat = element.lat ?? element.center?.lat;
    const lng = element.lon ?? element.center?.lon;
    if (!kind || !Number.isFinite(lat) || !Number.isFinite(lng) || !inUtahBox(lat!, lng!)) continue;
    const name = (tags.name ?? (kind === "restaurant" ? "Restaurant or cafe" : kind === "school" ? "School" : "Trail")).trim().slice(0, 80);
    const point: PoiPoint = [kind, name, round5(lat!), round5(lng!)];
    const key = `${kind}|${name.toLowerCase()}|${point[2]}|${point[3]}`;
    if (!seen.has(key)) { seen.add(key); points.push(point); }
  }
  for (const resort of resorts) points.push(["ski", resort.name.slice(0, 80), round5(resort.lat), round5(resort.lng)]);
  points.sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]) || a[2] - b[2] || a[3] - b[3]);
  return {
    version: 1,
    sources: { restaurant: SOURCE, trail: SOURCE, school: SOURCE, ski: "https://www.skiutah.com/resorts" },
    points,
  };
}

async function fetchOsm(): Promise<OsmElement[]> {
  const endpoint = process.env.OVERPASS_URL ?? "https://overpass-api.de/api/interpreter";
  const elements: OsmElement[] = [];
  const towns = JSON.parse(readFileSync("data/cities.json", "utf8")) as Town[];
  // cities.json is population-sorted. Round-robin batches keep the Wasatch Front's
  // largest towns from landing in one expensive Overpass request.
  const batchCount = 7;
  const batches = Array.from({ length: batchCount }, (_, i) => towns.filter((_, index) => index % batchCount === i));
  for (const [batchIndex, batch] of batches.entries()) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "UtahFit-research/1.0" },
      body: new URLSearchParams({ data: queryForTowns(batch) }),
      signal: AbortSignal.timeout(90_000),
    });
    if (!response.ok) throw new Error(`Overpass returned ${response.status} for town batch ${batchIndex + 1}; set OVERPASS_URL to another public mirror and retry`);
    const data = await response.json() as { elements?: OsmElement[]; remark?: string };
    if (data.remark || !data.elements) throw new Error(`Incomplete Overpass response: ${data.remark ?? "no elements"}`);
    elements.push(...data.elements);
    console.log(`Retrieved ${data.elements.length} rows for town batch ${batchIndex + 1}/${batches.length}`);
  }
  mkdirSync("data/raw", { recursive: true });
  writeFileSync(RAW, JSON.stringify({ elements }));
  return elements;
}

async function main() {
  const elements = process.argv.includes("--from-raw")
    ? (JSON.parse(readFileSync(RAW, "utf8")) as { elements: OsmElement[] }).elements
    : await fetchOsm();
  const file = toPoiFile(elements);
  const json = JSON.stringify(file);
  if (Buffer.byteLength(json) >= MAX_BYTES) throw new Error(`POI file is ${Buffer.byteLength(json)} bytes, above the 2 MB browser limit`);
  mkdirSync("public/data", { recursive: true });
  writeFileSync(OUT, json);
  const counts = Object.fromEntries((["restaurant", "trail", "ski", "school"] as PoiKind[]).map(kind => [kind, file.points.filter(p => p[0] === kind).length]));
  console.log(`Wrote ${file.points.length} points (${Buffer.byteLength(json)} bytes): ${JSON.stringify(counts)}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main();
