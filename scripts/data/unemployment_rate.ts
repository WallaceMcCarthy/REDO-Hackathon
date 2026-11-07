// unemployment_rate: BLS Local Area Unemployment Statistics, 2024 annual average, by county.
// LAUS publishes monthly rates for counties; most of the 42 towns have no town-level series, so each town takes its county's rate.
// Run: npx tsx scripts/data/unemployment_rate.ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { requireAllTowns, towns, utahCountyFips } from "./town_lookup";
import { writeMetric } from "./lib";

// BLS API v1 (no key) takes at most 25 series per request; the towns span 17 counties.
const API = "https://api.bls.gov/publicAPI/v1/timeseries/data/";
const YEAR = "2024";
export const lausSeries = (countyFips: string) => `LAUCN49${countyFips}0000000003`;

/** Annual-average (period M13) rate per series id from a BLS API v1 response. */
export function annualAverages(body: any, year: string): Record<string, number> {
  if (body.status !== "REQUEST_SUCCEEDED") throw new Error(`BLS: ${JSON.stringify(body.message)}`);
  const out: Record<string, number> = {};
  for (const s of body.Results.series) {
    const row = s.data.find((d: any) => d.period === "M13" && d.year === year);
    const v = row ? Number(row.value) : NaN;
    if (Number.isFinite(v)) out[s.seriesID] = v;
  }
  return out;
}

if (process.argv[1]?.endsWith("unemployment_rate.ts")) {
  const fips = await utahCountyFips();
  const file = "data/raw/bls/laus-2024.json";
  if (!existsSync(file)) {
    const res = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ seriesid: [...new Set(towns().map(t => lausSeries(fips[t.county])))], startyear: YEAR, endyear: YEAR, annualaverage: true }) });
    mkdirSync("data/raw/bls", { recursive: true });
    writeFileSync(file, JSON.stringify(await res.json()));
  }
  const rates = annualAverages(JSON.parse(readFileSync(file, "utf8")), YEAR);
  const values = requireAllTowns(Object.fromEntries(towns().map(t => [t.id, rates[lausSeries(fips[t.county])]])));
  writeMetric("data/metrics/unemployment_rate.json", {
    id: "unemployment_rate",
    label: "Unemployment rate",
    category: "community",
    unit: "% of labor force unemployed, county, 2024 annual average",
    higherIsBetter: false,
    description: "Average unemployment rate in the town's county for 2024 (Bureau of Labor Statistics, not seasonally adjusted). The data is county-level, so every town in a county shows the same rate.",
    source: "U.S. Bureau of Labor Statistics, Local Area Unemployment Statistics (county series LAUCN49*)",
    sourceUrl: "https://www.bls.gov/lau/",
    year: 2024,
    values,
  });
  console.log(`unemployment_rate: ${Object.keys(values).length}/42`);
}
