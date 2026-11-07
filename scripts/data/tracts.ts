/** Real ACS2020–2024 tract estimates joined to official2024 cartographic polygons.
 * Geometry requires Python packages pyshp and pyproj; TRACTS_PYTHON can select a venv.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = new URL("../../", import.meta.url);
const RAW = new URL("data/raw/tracts/", ROOT);
const BASE = "https://www2.census.gov/programs-surveys/acs/summary_file/2024/table-based-SF/data/5YRData/";
const GEOMETRY_URL = "https://www2.census.gov/geo/tiger/GENZ2024/shp/cb_2024_49_tract_500k.zip";
type Measurement = { estimate: number | null; moe: number | null; annotation: string | null };

/** Suppression sentinels and text annotations are not zero-valued observations. */
export function parseAcsNumber(raw: string | undefined): number | null {
  if (!raw || !raw.trim() || !/^\d+(\.\d+)?$/.test(raw.trim())) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
/** ACS median jam codes represent open-ended intervals, not exact dollar amounts. */
export function medianBound(estimate: number | null, table: "B25077" | "B25064") {
  const top = table === "B25077" ? 2000001 : 3501;
  return estimate === top ? { value: top - 1, bound: "at_least" as const } : { value: estimate, bound: null };
}
export function tractRows(lines: string[], table: string): Record<string, Measurement> {
  const header = lines[0].replace(/\r$/, "").split("|");
  const geo = header.indexOf("GEO_ID"), est = header.indexOf(`${table}_E001`), moe = header.indexOf(`${table}_M001`);
  if (geo < 0 || est < 0 || moe < 0) throw new Error(`Invalid ACS columns for ${table}`);
  const output: Record<string, Measurement> = {};
  for (const line of lines.slice(1)) {
    const row = line.replace(/\r$/, "").split("|");
    if (!row[geo]?.startsWith("1400000US49")) continue;
    const geoid = row[geo].split("US")[1];
    const raw = row[est];
    const estimate = parseAcsNumber(raw);
    output[geoid] = { estimate, moe: parseAcsNumber(row[moe]), annotation: estimate === null ? (raw || "unavailable") : null };
  }
  return output;
}

async function getTable(table: string) {
  const path = new URL(`${table}.json`, RAW);
  if (!process.argv.includes("--refresh") && existsSync(path)) return JSON.parse(await readFile(path, "utf8")) as Record<string, Measurement>;
  const url = `${BASE}acsdt5y2024-${table.toLowerCase()}.dat`;
  console.log(`Retrieving ${url}`);
  const response = await fetch(url, { signal: AbortSignal.timeout(180000) });
  if (!response.ok || !response.body) throw new Error(`ACS retrieval failed ${response.status}`);
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  const lines: string[] = [];
  let pending = "", geo = -1;
  const accept = (line: string) => {
    if (!lines.length) {
      geo = line.split("|").indexOf("GEO_ID");
      if (geo < 0) throw new Error("Missing GEO_ID");
      lines.push(line);
    } else if (line.split("|")[geo]?.startsWith("1400000US49")) lines.push(line);
  };
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    pending += value;
    const complete = pending.split("\n"); pending = complete.pop()!;
    for (const line of complete) if (line) accept(line);
  }
  if (pending) accept(pending);
  const rows = tractRows(lines, table);
  if (Object.keys(rows).length < 500) throw new Error(`Unexpected Utah tract coverage for ${table}`);
  await writeFile(path, JSON.stringify(rows));
  await writeFile(new URL(`${table}.raw.txt`, RAW), lines.join("\n") + "\n");
  return rows;
}

async function main() {
  await mkdir(RAW, { recursive: true });
  const zip = new URL("cb_2024_49_tract_500k.zip", RAW);
  if (!existsSync(zip) || process.argv.includes("--refresh")) {
    const response = await fetch(GEOMETRY_URL, { signal: AbortSignal.timeout(60000) });
    if (!response.ok) throw new Error(`Geometry download failed ${response.status}`);
    await writeFile(zip, Buffer.from(await response.arrayBuffer()));
  }
  const geometryPath = new URL("geometry.geojson", RAW);
  execFileSync(process.env.TRACTS_PYTHON ?? "python3", [fileURLToPath(new URL("tracts_geometry.py", import.meta.url)), fileURLToPath(zip), fileURLToPath(geometryPath)], { stdio: "inherit" });
  const [home, rent] = await Promise.all([getTable("B25077"), getTable("B25064")]);
  const geometry = JSON.parse(await readFile(geometryPath, "utf8"));
  let missingHome = 0, missingRent = 0;
  const features = geometry.features.map((feature: { properties: { GEOID: string; NAMELSAD: string }; geometry: unknown }) => {
    const geoid = feature.properties.GEOID;
    if (!home[geoid] || !rent[geoid]) throw new Error(`Missing ACS geography ${geoid}`);
    const h = home[geoid], r = rent[geoid];
    const homeBound = medianBound(h.estimate, "B25077"), rentBound = medianBound(r.estimate, "B25064");
    if (h.estimate === null) missingHome++;
    if (r.estimate === null) missingRent++;
    return { type: "Feature", id: geoid, geometry: feature.geometry, properties: {
      geoid, name: feature.properties.NAMELSAD, home_value: homeBound.value, home_value_moe: h.moe,
      median_rent: rentBound.value, median_rent_moe: r.moe, year: 2024, geography: "census_tract",
      ...(homeBound.bound ? { home_value_bound: homeBound.bound } : {}),
      ...(rentBound.bound ? { median_rent_bound: rentBound.bound } : {}),
    } };
  });
  features.sort((a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id));
  const output = JSON.stringify({ type: "FeatureCollection", features });
  if (Buffer.byteLength(output) > 2000000) throw new Error(`GeoJSON exceeds2MB: ${Buffer.byteLength(output)}`);
  await mkdir(new URL("public/data/", ROOT), { recursive: true });
  await writeFile(new URL("public/data/utah-tracts.geojson", ROOT), output + "\n");
  const provenance = {
    generatedAt: new Date().toISOString(), geography: "2024 census tract, Utah", surveyPeriod: "2020–2024 ACS5-year", year: 2024,
    geometryUrl: GEOMETRY_URL, geometryMethod: "Official1:500,000 cartographic boundaries; NAD83 transformed to WGS84/RFC7946,5decimalcoordinates; no town interpolation or additional simplification.",
    metrics: { home_value: { table: "B25077", unit: "USD", universe: "Owner-occupied housing units", sourceUrl: `${BASE}acsdt5y2024-b25077.dat` }, median_rent: { table: "B25064", unit: "USD/month", universe: "Renter-occupied housing units paying cash rent; gross rent includes contract rent plus utilities", sourceUrl: `${BASE}acsdt5y2024-b25064.dat` } },
    uncertainty: "MOEs are published ACS90% margins of error. Negative suppression sentinels and nonnumeric observations remain null; never substituted from nearby towns. ACS medians describe surveyed occupied housing, not asking prices or current available listings. The2024 median jam codes2000001(homevalue) and3501(rent) become2000000 and3500 with corresponding *_bound:at_least; display these as $2,000,000+ and $3,500+, never exact estimates. Original downloaded values are preserved in data/raw/tracts/.",
    annotationDocumentation: "https://www.census.gov/data/developers/data-sets/acs-1year/notes-on-acs-estimate-and-annotation-values.html",
    tractCount: features.length, measuredHomeValues: features.length - missingHome, measuredRents: features.length - missingRent,
    bytes: Buffer.byteLength(output) + 1,
  };
  await writeFile(new URL("data/tracts-provenance.json", ROOT), JSON.stringify(provenance, null, 2) + "\n");
  console.log(JSON.stringify(provenance, null, 2));
}
if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error); process.exitCode = 1; });
