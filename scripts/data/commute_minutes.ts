/**
 * 2020–2024 ACS mean travel time for workers 16+ who do not work at home.
 * Derivation: B08013_E001 aggregate travel minutes / B08303_E001 workers.
 * Downloads official table-based summary files: no Census API key required.
 * Run: npx tsx scripts/data/commute_minutes.ts [--refresh]
 * The cache keeps the downloaded Utah place rows with the original headers.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const ROOT = new URL("../../", import.meta.url);
const BASE = "https://www2.census.gov/programs-surveys/acs/summary_file/2024/table-based-SF/";
const SOURCES = {
  geography: `${BASE}documentation/Geos20245YR.txt`,
  minutes: `${BASE}data/5YRData/acsdt5y2024-b08013.dat`,
  workers: `${BASE}data/5YRData/acsdt5y2024-b08303.dat`,
};

async function getUtahRows(kind: keyof typeof SOURCES): Promise<string[][]> {
  const cache = new URL(`data/raw/commute_minutes_${kind}.json`, ROOT);
  if (!process.argv.includes("--refresh")) {
    try { return JSON.parse(await readFile(cache, "utf8")); } catch { /* Download on cache miss. */ }
  }
  console.log(`Downloading ${SOURCES[kind]}`);
  const response = await fetch(SOURCES[kind], { signal: AbortSignal.timeout(120_000) });
  if (!response.ok || !response.body) throw new Error(`Download failed (${response.status}): ${kind}`);
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  const rows: string[][] = [];
  let pending = "";
  let header: string[] | undefined;
  const accept = (line: string) => {
    const fields = line.replace(/\r$/, "").split("|");
    if (!header) {
      header = fields;
      if (!header.includes("GEO_ID")) throw new Error(`Invalid header: ${kind}`);
      rows.push(header);
    } else if (fields[header.indexOf("GEO_ID")]?.startsWith("1600000US49")) {
      rows.push(fields);
    }
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    pending += value;
    const lines = pending.split("\n");
    pending = lines.pop()!;
    for (const line of lines) if (line) accept(line);
  }
  if (pending) accept(pending);
  if (rows.length < 43) throw new Error(`Expected Utah place records in ${kind}; received ${rows.length - 1}`);
  await mkdir(new URL("data/raw/", ROOT), { recursive: true });
  await writeFile(cache, JSON.stringify(rows, null, 2) + "\n");
  return rows;
}

const slug = (name: string) => name.split(",")[0].replace(/ (city|town|metro township|CDP)$/, "")
  .toLowerCase().replace(/\./g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

async function main() {
  // CONTRACT is canonical and available before the cities dataset lands.
  const contract = await readFile(new URL("CONTRACT.md", ROOT), "utf8");
  const cityLine = contract.split("\n").find((line) => line.startsWith("salt-lake-city,"));
  if (!cityLine) throw new Error("Canonical city list missing from CONTRACT.md");
  const cityIds = cityLine.split(",").map((id) => id.trim());
  const [geography, minutes, workers] = await Promise.all([
    getUtahRows("geography"), getUtahRows("minutes"), getUtahRows("workers"),
  ]);
  const geoColumn = geography[0].indexOf("GEO_ID");
  const nameColumn = geography[0].indexOf("NAME");
  const geoById = new Map(geography.slice(1).map((row) => [slug(row[nameColumn]), row[geoColumn]]));
  const valuesByGeo = (rows: string[][], column: string) => {
    const geoIndex = rows[0].indexOf("GEO_ID");
    const valueIndex = rows[0].indexOf(column);
    if (valueIndex < 0) throw new Error(`Missing column ${column}`);
    return new Map(rows.slice(1).map((row) => [row[geoIndex], row[valueIndex] === "" ? NaN : Number(row[valueIndex])]));
  };
  const aggregate = valuesByGeo(minutes, "B08013_E001");
  const counts = valuesByGeo(workers, "B08303_E001");
  const values: Record<string, number> = {};
  for (const id of cityIds) {
    // Census's official place name is "Heber city", locally known as Heber City.
    const geo = geoById.get(id === "heber-city" ? "heber" : id);
    const sum = geo ? aggregate.get(geo) : undefined;
    const count = geo ? counts.get(geo) : undefined;
    if (sum === undefined || count === undefined || !Number.isFinite(sum) || !Number.isFinite(count) || sum <= 0 || count <= 0) {
      throw new Error(`Missing or suppressed ACS commute estimate for ${id} (${geo ?? "unknown geography"})`);
    }
    values[id] = Math.round(sum / count * 10) / 10;
  }
  const metric = {
    id: "commute_minutes",
    label: "Average commute",
    category: "transit",
    unit: "minutes",
    higherIsBetter: false,
    description: "2020–2024 ACS mean one-way travel time to work for workers age 16+ who do not work at home. Calculated from aggregate travel minutes (B08013) divided by commuting workers (B08303), rounded to one decimal. Place-level estimates; no county substitutions.",
    source: "U.S. Census Bureau, 2020–2024 ACS 5-year estimates (B08013 / B08303)",
    sourceUrl: `${BASE}data/5YRData/`,
    year: 2024,
    values,
  };
  const output = new URL("data/metrics/commute_minutes.json", ROOT);
  await mkdir(new URL("data/metrics/", ROOT), { recursive: true });
  await writeFile(output, JSON.stringify(metric, null, 2) + "\n");
  console.log(`Wrote ${fileURLToPath(output)}: ${Object.keys(values).length} towns, ${Math.min(...Object.values(values))}–${Math.max(...Object.values(values))} minutes`);
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
