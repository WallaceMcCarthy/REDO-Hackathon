// ACS 2020-2024 5-year table-based summary file, Utah place rows (GEO_ID 1600000US49xxxxx), keyed by town id.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { cached, csvLine, placeKey, towns } from "./town_lookup";

export const ACS_BASE = "https://www2.census.gov/programs-surveys/acs/summary_file/2024/table-based-SF/data/5YRData/";

/** Town id -> 5-digit Census place FIPS, from the same Vintage 2024 place file the population metrics use. */
export async function placeFips(): Promise<Record<string, string>> {
  const lines = (await cached("https://www2.census.gov/programs-surveys/popest/datasets/2020-2024/cities/totals/sub-est2024_49.csv", "data/raw/popest/sub-est2024_49.csv")).split(/\r?\n/).filter(Boolean);
  const h = csvLine(lines[0]);
  const byKey: Record<string, string> = {};
  for (const l of lines.slice(1)) {
    const r = csvLine(l);
    if (r[h.indexOf("SUMLEV")] === "162") byKey[placeKey(r[h.indexOf("NAME")])] = r[h.indexOf("PLACE")];
  }
  return Object.fromEntries(towns().map(t => [t.id, byKey[placeKey(t.name)]]));
}

/** Pick named columns for each town from a pipe-delimited ACS table (header line first). */
export function pickPlaces(lines: string[], fips: Record<string, string>, cols: string[]): Record<string, Record<string, number | null>> {
  const h = lines[0].replace(/\r$/, "").split("|");
  const idx = cols.map(c => {
    const i = h.indexOf(c);
    if (i < 0) throw new Error(`missing ACS column ${c}`);
    return i;
  });
  const rows = new Map(lines.slice(1).map(l => l.replace(/\r$/, "").split("|")).map(r => [r[0], r]));
  const out: Record<string, Record<string, number | null>> = {};
  for (const [id, f] of Object.entries(fips)) {
    const r = rows.get(`1600000US49${f}`);
    if (!r) continue;
    // Suppressed or annotated cells are not zeros.
    out[id] = Object.fromEntries(cols.map((c, k) => [c, /^\d+(\.\d+)?$/.test(r[idx[k]]) ? Number(r[idx[k]]) : null]));
  }
  return out;
}

export async function acsPlaceLines(table: string): Promise<string[]> {
  const file = `data/raw/acs/${table}.places.dat`;
  if (!existsSync(file)) {
    const res = await fetch(`${ACS_BASE}acsdt5y2024-${table.toLowerCase()}.dat`, { signal: AbortSignal.timeout(180000) });
    if (!res.ok) throw new Error(`ACS ${table} -> ${res.status}`);
    const all = (await res.text()).split(/\r?\n/);
    mkdirSync("data/raw/acs", { recursive: true });
    writeFileSync(file, [all[0], ...all.filter(l => l.startsWith("1600000US49"))].join("\n"));
  }
  return readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean);
}
