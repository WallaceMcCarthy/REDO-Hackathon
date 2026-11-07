/**
 * Streams every improved residential UGRC parcel inside our towns into Convex.
 * Run: npm run seed:assessor -- [--dry-run] [--town=provo] [--refresh]
 *      npm run seed:assessor:prod
 * --dry-run fetches and counts without touching Convex.
 * Raw ArcGIS pages cache under data/raw/homes/ and progress under data/raw/assessor-load/,
 * both outside git. Rerun after any failure to resume. Delete the progress file after
 * wiping a deployment, or finished towns are skipped.
 * This is public assessor data, not homes for sale. No owner fields are requested.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assessorLayer, MAX_UPSERT_ROWS, type AssessorRow } from "../../convex/lib/assessor";
import { asHome, cachedRequest, FIELDS, improvedResidentialWhere, municipalRings, type Parcel, type Point, type Town } from "./listings_homes";

type Request = typeof cachedRequest;
type TownProgress = { hash: string; rows: number; done: number };
export type Progress = Record<string, TownProgress>;

const ROOT = new URL("../../", import.meta.url);
const PAGE_SIZE = 2000;
const MAX_CHUNK_BYTES = 400_000;
// Value is per parcel, so past a few structures it prices a complex, not a home. A judgment call: raise it to admit more.
const MAX_STRUCTURES = 4;
// Measured parcels inside the polygon but in another county's layer. Others are boundary slivers under 30.
const EXTRA_COUNTIES: Record<string, string[]> = { draper: ["Utah"], "park-city": ["Wasatch"] };

export function asAssessorRow(parcel: Parcel, town: Town, rings: Point[][]): AssessorRow | null {
  const home = asHome(parcel, town, assessorLayer(town.county), rings);
  if (!home) return null;
  const { id, cityId, address, lat, lng, value, sqft, yearBuilt, units, propertyType } = home;
  return { id, cityId, county: town.county, address, lat, lng, value, sqft, yearBuilt, units, propertyType,
    asOf: new Date(parcel.attributes.CURRENT_ASOF!).toISOString().slice(0, 10) };
}

/** Keyset paging on OBJECTID stays cheap at depth, and only an empty page ends the stream. */
export async function* parcelPages(layer: string, rings: Point[][], request: Request): AsyncGenerator<Parcel[]> {
  const points = rings.flat();
  const xs = points.map((point) => point[0]), ys = points.map((point) => point[1]);
  const geometry = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)].join(",");
  for (let after = 0; ;) {
    const { features } = await request(`${layer}/query`, {
      where: `${improvedResidentialWhere} AND OBJECTID > ${after}`, geometry, geometryType: "esriGeometryEnvelope",
      inSR: "4326", outSR: "4326", spatialRel: "esriSpatialRelIntersects", outFields: FIELDS.join(","),
      returnGeometry: "false", returnCentroid: "true", orderByFields: "OBJECTID ASC", resultRecordCount: String(PAGE_SIZE),
    });
    if (!features) throw new Error(`No feature array from ${layer}`);
    if (!features.length) return;
    yield features;
    after = Number(features[features.length - 1].attributes.OBJECTID);
  }
}

const structureCount = (parcel: Parcel) => Math.max(1, ...(String(parcel.attributes.HOUSE_CNT ?? "").match(/\d+/g) ?? []).map(Number));
const buildingSqft = (parcel: Parcel) => Number(parcel.attributes.BLDG_SQFT) || 0;

/**
 * LIR repeats a parcel once per structure. Value belongs to the parcel, while sqft and year
 * belong to each structure, and HOUSE_CNT counts structures rather than dwelling units.
 * The largest structure describes the home. Units stay unknown when there are several.
 */
export function asParcelRow(structures: Parcel[], town: Town, rings: Point[][]): AssessorRow | null {
  const count = Math.max(...structures.map(structureCount));
  if (count > MAX_STRUCTURES) return null;
  const main = structures.reduce((best, next) => (buildingSqft(next) > buildingSqft(best) ? next : best));
  return asAssessorRow({ ...main, attributes: { ...main.attributes, HOUSE_CNT: count > 1 ? null : main.attributes.HOUSE_CNT } }, town, rings);
}

export async function townRows(town: Town, rings: Point[][], request: Request): Promise<AssessorRow[]> {
  const rows: AssessorRow[] = [];
  for (const county of [town.county, ...(EXTRA_COUNTIES[town.id] ?? [])]) {
    const parcels = new Map<string, Parcel[]>();
    for await (const page of parcelPages(assessorLayer(county), rings, request)) {
      for (const parcel of page) {
        const id = String(parcel.attributes.PARCEL_ID);
        parcels.set(id, [...(parcels.get(id) ?? []), parcel]);
      }
    }
    for (const structures of parcels.values()) {
      const row = asParcelRow(structures, { ...town, county }, rings);
      if (row) rows.push(row);
    }
  }
  return rows.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Bounded by rows for the mutation's read budget and by bytes for the CLI argument limit. */
export function chunkRows(rows: AssessorRow[]): AssessorRow[][] {
  const chunks: AssessorRow[][] = [];
  let chunk: AssessorRow[] = [], bytes = 2;
  for (const row of rows) {
    const size = JSON.stringify(row).length + 1;
    if (chunk.length && (chunk.length >= MAX_UPSERT_ROWS || bytes + size > MAX_CHUNK_BYTES)) { chunks.push(chunk); chunk = []; bytes = 2; }
    chunk.push(row);
    bytes += size;
  }
  if (chunk.length) chunks.push(chunk);
  return chunks;
}

/** Sorted rows make chunks deterministic, so the hash says whether saved progress still applies. */
export async function loadTown(cityId: string, rows: AssessorRow[], progress: Progress, save: (progress: Progress) => Promise<void>, upsert: (rows: AssessorRow[]) => void) {
  const hash = createHash("sha256").update(JSON.stringify(rows)).digest("hex");
  const start = progress[cityId]?.hash === hash ? progress[cityId].done : 0;
  const chunks = chunkRows(rows);
  for (let index = start; index < chunks.length; index++) {
    upsert(chunks[index]);
    progress[cityId] = { hash, rows: rows.length, done: index + 1 };
    await save(progress);
    console.log(`${cityId}: chunk ${index + 1}/${chunks.length}`);
  }
  progress[cityId] ??= { hash, rows: rows.length, done: 0 };
}

async function main() {
  const prod = process.argv.includes("--prod");
  const dryRun = process.argv.includes("--dry-run");
  const onlyTown = process.argv.find((arg) => arg.startsWith("--town="))?.slice(7);
  const allTowns: Town[] = JSON.parse(await readFile(new URL("data/cities.json", ROOT), "utf8"));
  const towns = onlyTown ? allTowns.filter((town) => town.id === onlyTown) : allTowns;
  if (!towns.length) throw new Error(`Unknown town ${onlyTown}`);

  const progressFile = new URL(`data/raw/assessor-load/${prod ? "prod" : "dev"}.json`, ROOT);
  await mkdir(new URL("data/raw/assessor-load/", ROOT), { recursive: true });
  const progress: Progress = await readFile(progressFile, "utf8").then(JSON.parse, () => ({}));
  const save = async (state: Progress) => {
    const temporary = new URL(`${progressFile.href}.tmp`);
    await writeFile(temporary, JSON.stringify(state));
    await rename(temporary, progressFile);
  };
  const upsert = (rows: AssessorRow[]) => {
    execFileSync("npx", ["convex", "run", "assessor:upsertListings", JSON.stringify({ rows }), ...(prod ? ["--prod"] : [])], { stdio: ["ignore", "ignore", "inherit"] });
  };

  const byName = await municipalRings();
  const counts: Record<string, { count: number; bytes: number }> = {};
  for (const town of towns) {
    const rings = byName.get(town.name.toLowerCase());
    if (!rings) throw new Error(`No official municipal polygon for ${town.id}`);
    const rows = await townRows(town, rings, cachedRequest);
    counts[town.id] = { count: rows.length, bytes: JSON.stringify(rows).length };
    console.log(`${town.id}: ${rows.length} homes, ${counts[town.id].bytes} bytes`);
    if (!dryRun) await loadTown(town.id, rows, progress, save, upsert);
  }
  const total = Object.values(counts).reduce((sum, town) => sum + town.count, 0);
  if (!onlyTown) {
    await writeFile(new URL("data/assessor-provenance.json", ROOT), JSON.stringify({
      generatedAt: new Date().toISOString(), source: "https://gis.utah.gov/products/sgid/cadastre/parcels/",
      methodology: `One row per improved residential assessor parcel whose centroid falls inside an official municipal polygon, read from the county LIR layers. LIR repeats a parcel per structure, so sqft and year come from the largest structure, and parcels with more than ${MAX_STRUCTURES} structures are excluded. Public records, not homes for sale. Bedrooms are not in the source. No owner data retrieved.`,
      total, counts,
    }, null, 2) + "\n");
  }
  console.log(`Total: ${total} homes across ${towns.length} towns${dryRun ? " (dry run, Convex untouched)" : ""}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
}
