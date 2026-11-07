// net_migration: county net migration (domestic + international), July 2020 to July 2024, per 1,000 residents.
// Source: Census Bureau Vintage 2024 county population estimates components of change.
// The Census publishes migration components for counties only, so each town takes its county's value.
// Run: npx tsx scripts/data/net_migration.ts
import { cached, csvLine, requireAllTowns, towns } from "./town_lookup";
import { writeMetric } from "./lib";

const URL_ = "https://www2.census.gov/programs-surveys/popest/datasets/2020-2024/counties/totals/co-est2024-alldata.csv";

/** Net migration per 1,000 of the July 2020 population, summed over the four July-to-July years 2021-2024, keyed by county name without " County". */
export function netMigrationByCounty(csv: string): Record<string, number> {
  const lines = csv.split(/\r?\n/).filter(Boolean);
  const h = csvLine(lines[0]);
  const col = (c: string) => {
    const i = h.indexOf(c);
    if (i < 0) throw new Error(`missing column ${c}`);
    return i;
  };
  const [lev, state, name, pop] = [col("SUMLEV"), col("STATE"), col("CTYNAME"), col("POPESTIMATE2020")];
  const mig = [2021, 2022, 2023, 2024].map(y => col(`NETMIG${y}`));
  const out: Record<string, number> = {};
  for (const l of lines.slice(1)) {
    const r = csvLine(l);
    if (r[lev] !== "050" || r[state] !== "49") continue;
    const p = Number(r[pop]);
    const total = mig.reduce((s, i) => s + Number(r[i]), 0);
    if (p > 0 && Number.isFinite(total)) out[r[name].replace(/ County$/, "")] = Math.round((total / p) * 10000) / 10;
  }
  return out;
}

if (process.argv[1]?.endsWith("net_migration.ts")) {
  const byCounty = netMigrationByCounty(await cached(URL_, "data/raw/popest/co-est2024-alldata.csv"));
  const values = requireAllTowns(Object.fromEntries(towns().map(t => [t.id, byCounty[t.county]])));
  writeMetric("data/metrics/net_migration.json", {
    id: "net_migration",
    label: "Net migration",
    category: "community",
    unit: "net movers per 1,000 residents, county, July 2020 to July 2024",
    higherIsBetter: true,
    description: "Domestic plus international net migration into the town's county over the four years July 2020 to July 2024, per 1,000 residents at July 2020. The Census Bureau publishes migration components for counties only, so every town takes its county's value (13 Salt Lake County towns share one value, and so on).",
    source: "U.S. Census Bureau, Vintage 2024 County Population Estimates, components of change (co-est2024-alldata)",
    sourceUrl: URL_,
    year: 2024,
    values,
  });
  console.log(`net_migration: ${Object.keys(values).length}/42`);
}
