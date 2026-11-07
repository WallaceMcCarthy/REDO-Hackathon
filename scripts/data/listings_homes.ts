/**
 * Real county-assessor residential parcels, not available/for-sale listings.
 * Run: npx tsx scripts/data/listings_homes.ts [--refresh] [--town=provo]
 * UGRC source: https://gis.utah.gov/products/sgid/cadastre/parcels/
 * Queries and complete responses are cached under data/raw/homes/.
 * Each town is sampled across a 4x4 spatial grid, then round-robin selected.
 * Parcel centroids must fall inside its official municipal polygon.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type Town = { id: string; name: string; county: string; lat: number; lng: number };
export type Point = [number, number];
type Polygon = { rings: Point[][] };
type Attributes = Record<string, string | number | null>;
export type Parcel = { attributes: Attributes; centroid?: { x: number; y: number } };
type Response = {
  services?: { name: string; url: string }[];
  fields?: { name: string }[];
  features?: (Parcel & { geometry?: Polygon })[];
  error?: { message: string; details?: string[] };
  exceededTransferLimit?: boolean;
};
export type Home = {
  id: string; cityId: string; kind: "home"; name: null; address: string | null;
  lat: number; lng: number; value: number; rent: null; beds: null;
  sqft: number | null; yearBuilt: number | null; units: number | null;
  propertyType: string; source: string; sourceUrl: string; year: number;
};

const ROOT = new URL("../../", import.meta.url);
const SERVICES = "https://services1.arcgis.com/99lidPhWCzftIe9K/ArcGIS/rest/services";
const MUNICIPAL = `${SERVICES}/UtahMunicipalBoundaries/FeatureServer/0`;
// This file is only the git-tracked sample that `listings` serves as a fallback,
// so the 2MB check below still binds: 80/town * 40 towns ~= 1.92MB at ~601
// bytes/row. The full parcel set streams to Convex: see assessor_homes.ts.
const MAX_PER_TOWN = 80;
const REQUEST_GAP_MS = 250;
const MAX_ATTEMPTS = 6;
export const FIELDS = ["OBJECTID", "COUNTY_NAME", "PARCEL_ID", "PARCEL_ADD", "PARCEL_CITY", "TOTAL_MKT_VALUE", "LAND_MKT_VALUE", "PROP_CLASS", "PRIMARY_RES", "HOUSE_CNT", "BLDG_SQFT", "BUILT_YR", "CURRENT_ASOF"];
const residentialWhere = "UPPER(PROP_CLASS) IN ('RESIDENTIAL','SINGLE FAMILY') AND TOTAL_MKT_VALUE > 0 AND BLDG_SQFT > 0";
/** A building is proven by its size, its year built, or improvements worth more than the land. */
export const improvedResidentialWhere = residentialWhere.replace("BLDG_SQFT > 0", "(BLDG_SQFT > 0 OR BUILT_YR > 0 OR TOTAL_MKT_VALUE > LAND_MKT_VALUE)");
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const text = (value: unknown): string | null => typeof value === "string" && value.trim() ? value.trim() : null;
const positive = (value: unknown): number | null => finite(value) && value > 0 ? value : null;

/** Even/odd rule handles multiple municipal parts and interior holes. */
export function insideMunicipality([x, y]: Point, rings: Point[][]): boolean {
  let inside = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

/** Equal opportunities for occupied cells rather than taking one central cluster. */
export function spatialSample(groups: Home[][], limit: number): Home[] {
  const result: Home[] = [];
  const seen = new Set<string>();
  for (let offset = 0; result.length < limit; offset++) {
    let any = false;
    for (const group of groups) {
      const row = group[offset];
      if (!row) continue;
      any = true;
      if (!seen.has(row.id)) { result.push(row); seen.add(row.id); }
      if (result.length === limit) break;
    }
    if (!any) break;
  }
  return result;
}

export function asHome(parcel: Parcel, town: Town, layer: string, rings: Point[][]): Home | null {
  const a = parcel.attributes;
  const id = text(a.PARCEL_ID);
  const propertyType = text(a.PROP_CLASS);
  const value = positive(a.TOTAL_MKT_VALUE);
  const sqft = positive(a.BLDG_SQFT);
  const built = positive(a.BUILT_YR);
  const yearBuilt = built && Number.isInteger(built) && built >= 1600 && built <= new Date().getUTCFullYear() ? built : null;
  const landValue = positive(a.LAND_MKT_VALUE);
  const point = parcel.centroid;
  const date = new Date(typeof a.CURRENT_ASOF === "number" || typeof a.CURRENT_ASOF === "string" ? a.CURRENT_ASOF : NaN);
  const year = date.getUTCFullYear();
  const units = a.HOUSE_CNT === null || a.HOUSE_CNT === "" ? null : positive(Number(a.HOUSE_CNT));
  const unitRange = typeof a.HOUSE_CNT === "string" ? a.HOUSE_CNT.match(/^(\d+)\s*[-–]\s*(\d+)$/) : null;
  if (unitRange && Math.max(Number(unitRange[1]), Number(unitRange[2])) > 1) return null;
  if (!id || !propertyType || !["RESIDENTIAL", "SINGLE FAMILY"].includes(propertyType.toUpperCase()) || !value || (!sqft && !yearBuilt && !(landValue !== null && value > landValue)) || !point || !finite(point.x) || !finite(point.y) || !insideMunicipality([point.x, point.y], rings) || !Number.isInteger(year) || year < 2000 || year > new Date().getUTCFullYear() || (units !== null && units > 1)) return null;
  const county = town.county.toLowerCase().replaceAll(" ", "-");
  const query = new URLSearchParams({ objectIds: String(a.OBJECTID), outFields: "PARCEL_ID,PARCEL_ADD,TOTAL_MKT_VALUE,BLDG_SQFT,BUILT_YR,CURRENT_ASOF", returnGeometry: "false", f: "pjson" });
  return {
    id: `${county}-${id}`, cityId: town.id, kind: "home", name: null,
    address: text(a.PARCEL_ADD), lat: point.y, lng: point.x, value,
    rent: null, beds: null, sqft,
    yearBuilt,
    units, propertyType,
    source: `UGRC ${town.county} County assessor LIR; records as of ${date.toISOString().slice(0, 10)}`,
    sourceUrl: `${layer}/query?${query}`, year,
  };
}

const sleepFor = (ms: number) => new Promise((resume) => setTimeout(resume, ms));

/** ArcGIS reports throttling both as HTTP status and as a 200 with an error body. */
export async function fetchWithBackoff(query: URL, sleep = sleepFor): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    let retryAfter = 0;
    try {
      const response = await fetch(query, { signal: AbortSignal.timeout(60_000), headers: { "User-Agent": "UtahFit-public-parcel-research/1.0" } });
      retryAfter = Number(response.headers.get("retry-after")) || 0;
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${query.origin}${query.pathname}`);
      const data = await response.json() as Response;
      if (data.error) throw new Error(`${data.error.message}: ${data.error.details?.join("; ") ?? ""}`);
      await sleep(REQUEST_GAP_MS);
      return data;
    } catch (error) {
      if (attempt === MAX_ATTEMPTS - 1) throw error;
      await sleep(Math.max(retryAfter * 1000, 2000 * 2 ** attempt));
    }
  }
}

export async function cachedRequest(url: string, params: Record<string, string> = {}): Promise<Response> {
  const request = { url, params: { f: "json", ...params } };
  const key = createHash("sha256").update(JSON.stringify(request)).digest("hex");
  const cache = new URL(`data/raw/homes/${key}.json`, ROOT);
  if (!process.argv.includes("--refresh")) {
    try { return JSON.parse(await readFile(cache, "utf8")).response as Response; } catch { /* Fetch missing cache. */ }
  }
  const query = new URL(url);
  query.search = new URLSearchParams(request.params).toString();
  const data = await fetchWithBackoff(query);
  await mkdir(new URL("data/raw/homes/", ROOT), { recursive: true });
  await writeFile(cache, JSON.stringify({ ...request, retrievedAt: new Date().toISOString(), response: data }) + "\n");
  return data;
}

async function collectTown(town: Town, rings: Point[][], layer: string, allowMissingSqft = false): Promise<{ homes: Home[]; examined: number; occupiedCells: number; layer: string; allowMissingSqft: boolean; sourceAvailability?: Attributes }> {
  const metadata = await cachedRequest(layer);
  const available = new Set(metadata.fields?.map((field) => field.name));
  const missing = ["OBJECTID", "PARCEL_ID", "TOTAL_MKT_VALUE", "PROP_CLASS", "BLDG_SQFT", "CURRENT_ASOF"].filter((field) => !available.has(field));
  if (missing.length) throw new Error(`Missing required source fields: ${missing.join(", ")}`);
  const fields = FIELDS.filter((field) => available.has(field));
  const points = rings.flat();
  const xs = points.map((point) => point[0]), ys = points.map((point) => point[1]);
  const bounds = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  const groups: Home[][] = [];
  let examined = 0;
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      const box = [bounds[0] + (bounds[2] - bounds[0]) * col / 4, bounds[1] + (bounds[3] - bounds[1]) * row / 4, bounds[0] + (bounds[2] - bounds[0]) * (col + 1) / 4, bounds[1] + (bounds[3] - bounds[1]) * (row + 1) / 4];
      const response = await cachedRequest(`${layer}/query`, {
        where: allowMissingSqft ? improvedResidentialWhere : residentialWhere,
        geometry: box.join(","), geometryType: "esriGeometryEnvelope", inSR: "4326", outSR: "4326",
        spatialRel: "esriSpatialRelIntersects", outFields: fields.join(","),
        returnGeometry: "false", returnCentroid: "true", orderByFields: "OBJECTID ASC", resultRecordCount: "150",
      });
      if (!response.features) throw new Error(`No feature array for ${town.id}`);
      examined += response.features.length;
      const group = response.features.map((parcel) => asHome(parcel, town, layer, rings)).filter((home): home is Home => home !== null);
      // Spread within the returned cell sample as well as across occupied cells.
      groups.push(group.filter((_, index) => index % Math.max(1, Math.floor(group.length / 20)) === 0));
    }
  }
  const homes = spatialSample(groups, MAX_PER_TOWN);
  if (homes.length === 0 && !allowMissingSqft) {
    console.log(`${town.id}: no size-qualified homes; checking dated buildings/improvement values with unavailable sqft`);
    return collectTown(town, rings, layer, true);
  }
  let sourceAvailability: Attributes | undefined;
  if (homes.length === 0) {
    const stats = await cachedRequest(`${layer}/query`, {
      where: "1=1", geometry: bounds.join(","), geometryType: "esriGeometryEnvelope", inSR: "4326", returnGeometry: "false",
      outStatistics: JSON.stringify(["OBJECTID", "TOTAL_MKT_VALUE", "BLDG_SQFT", "PROP_CLASS"].map((field, index) => ({ statisticType: "count", onStatisticField: field, outStatisticFieldName: ["parcelsInMunicipalBoundingBox", "withValue", "withSqft", "withClass"][index] }))),
    });
    sourceAvailability = stats.features?.[0]?.attributes;
  }
  console.log(`${town.id}: ${homes.length} homes; ${examined} candidate records; ${groups.filter((group) => group.length > 0).length}/16 occupied cells`);
  return { homes, examined, occupiedCells: groups.filter((group) => group.length > 0).length, layer, allowMissingSqft, ...(sourceAvailability ? { sourceAvailability } : {}) };
}

/** Official polygons by lowercase town name, multiple parts merged. */
export async function municipalRings(): Promise<Map<string, Point[][]>> {
  const municipalities = await cachedRequest(`${MUNICIPAL}/query`, { where: "1=1", outFields: "NAME,OBJECTID", outSR: "4326", returnGeometry: "true", resultRecordCount: "2000" });
  if (!municipalities.features || municipalities.exceededTransferLimit) throw new Error("Incomplete municipal boundary response");
  const byName = new Map<string, Point[][]>();
  for (const feature of municipalities.features) {
    const name = text(feature.attributes.NAME)?.toLowerCase();
    if (name && feature.geometry?.rings) byName.set(name, [...(byName.get(name) ?? []), ...feature.geometry.rings]);
  }
  return byName;
}

async function main() {
  const allTowns: Town[] = JSON.parse(await readFile(new URL("data/cities.json", ROOT), "utf8"));
  const onlyTown = process.argv.find((arg) => arg.startsWith("--town="))?.slice(7);
  const towns = onlyTown ? allTowns.filter((town) => town.id === onlyTown) : allTowns;
  if (towns.length === 0) throw new Error(`Unknown town ${onlyTown}`);
  const catalog = await cachedRequest(SERVICES);
  if (!catalog.services) throw new Error("UGRC service catalog unavailable");
  const byName = await municipalRings();
  const homes: Home[] = [];
  const coverage: Record<string, object> = {};
  let index = 0;
  await Promise.all(Array.from({ length: 3 }, async () => {
    while (index < towns.length) {
      const town = towns[index++];
      try {
        const rings = byName.get(town.name.toLowerCase());
        if (!rings) throw new Error("No official municipal polygon");
        const name = `Parcels_${town.county.replaceAll(" ", "")}_LIR`;
        const service = catalog.services!.find((item) => item.name === name);
        if (!service) throw new Error(`No public LIR service: ${name}`);
        const { homes: sample, ...stats } = await collectTown(town, rings, `${service.url}/0`);
        homes.push(...sample);
        coverage[town.id] = { count: sample.length, ...stats };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        coverage[town.id] = { count: 0, error: message };
        console.error(`${town.id}: ${message}`);
      }
    }
  }));
  homes.sort((a, b) => a.cityId.localeCompare(b.cityId) || a.id.localeCompare(b.id));
  if (new Set(homes.map((home) => home.id)).size !== homes.length) throw new Error("Duplicate parcel IDs across town samples");
  const body = `[\n${homes.map((home) => JSON.stringify(home)).join(",\n")}\n]\n`;
  const bytes = Buffer.byteLength(body);
  if (bytes >= 2_000_000) throw new Error(`Home file exceeds 2 MB: ${bytes}`);
  await mkdir(new URL("data/listings/", ROOT), { recursive: true });
  // Single-town probes cache source requests but never overwrite the full dataset.
  if (!onlyTown) {
    await writeFile(new URL("data/listings/homes.json", ROOT), body);
    await writeFile(new URL("data/homes-provenance.json", ROOT), JSON.stringify({
      generatedAt: new Date().toISOString(), source: "https://gis.utah.gov/products/sgid/cadastre/parcels/", municipalSource: MUNICIPAL,
      methodology: `Up to ${MAX_PER_TOWN} improved residential assessor parcels per town; 4x4 municipal-extent grid, up to 150 source candidates per cell, centroid-in-municipality check, round-robin selection across occupied cells. If building sizes are absent, source year-built or improvement value must establish a building; unavailable sqft stays null. Excludes multi-unit records where unit count is known. This is a spatial sample of public records, not homes advertised for sale. year is CURRENT_ASOF snapshot year, not independently verified assessment tax year. Missing bedrooms are null. No owner data retrieved.`,
      count: homes.length, bytes, coverage,
    }, null, 2) + "\n");
  }
  console.log(`Total: ${homes.length} real homes, ${bytes} bytes; ${onlyTown ? "probe only (no dataset overwritten)" : "data/listings/homes.json"}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
}
