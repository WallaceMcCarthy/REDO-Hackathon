// population_growth: % change in resident population, April 2020 base to July 2024, per town.
// Source: Census Bureau Vintage 2024 city/town population estimates (SUMLEV 162, incorporated places).
// Run: npx tsx scripts/data/population_growth.ts
import { cached, csvLine, placeKey, requireAllTowns, towns } from "./town_lookup";
import { writeMetric } from "./lib";

const URL_ = "https://www2.census.gov/programs-surveys/popest/datasets/2020-2024/cities/totals/sub-est2024_49.csv";

export function growthByPlace(csv: string): Record<string, number> {
  const lines = csv.split(/\r?\n/).filter(Boolean);
  const h = csvLine(lines[0]);
  const [lev, name, base, last] = ["SUMLEV", "NAME", "ESTIMATESBASE2020", "POPESTIMATE2024"].map(c => {
    const i = h.indexOf(c);
    if (i < 0) throw new Error(`missing column ${c}`);
    return i;
  });
  const out: Record<string, number> = {};
  for (const l of lines.slice(1)) {
    const r = csvLine(l);
    if (r[lev] !== "162") continue;
    const b = Number(r[base]), n = Number(r[last]);
    if (b > 0 && Number.isFinite(n)) out[placeKey(r[name])] = Math.round(((n - b) / b) * 1000) / 10;
  }
  return out;
}

if (process.argv[1]?.endsWith("population_growth.ts")) {
  const byPlace = growthByPlace(await cached(URL_, "data/raw/popest/sub-est2024_49.csv"));
  const values = requireAllTowns(Object.fromEntries(towns().map(t => [t.id, byPlace[placeKey(t.name)]])));
  writeMetric("data/metrics/population_growth.json", {
    id: "population_growth",
    label: "Population growth",
    category: "community",
    unit: "% change in population, April 2020 to July 2024",
    higherIsBetter: true,
    description: "Percent change in the town's population from April 2020 to July 2024, from Census Bureau estimates. Shows how fast a town is attracting residents.",
    source: "U.S. Census Bureau, Vintage 2024 Population Estimates, incorporated places (sub-est2024)",
    sourceUrl: URL_,
    year: 2024,
    values,
  });
  console.log(`population_growth: ${Object.keys(values).length}/42`);
}
