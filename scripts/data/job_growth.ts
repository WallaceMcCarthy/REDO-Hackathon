// job_growth: % change in county annual-average employment, 2021 to 2024.
// Source: BLS Quarterly Census of Employment and Wages, all ownerships, all industries (own_code 0, industry 10).
// QCEW publishes counties, not these towns, so each town takes its county's value.
// Run: npx tsx scripts/data/job_growth.ts
import { cached, csvLine, requireAllTowns, towns, utahCountyFips } from "./town_lookup";
import { writeMetric } from "./lib";

const FROM = 2021, TO = 2024;
const url = (year: number, fips: string) => `https://data.bls.gov/cew/data/api/${year}/a/area/49${fips}.csv`;

/** Annual average employment for the county total row (all ownerships, all industries). */
export function countyEmployment(csv: string): number {
  const lines = csv.split(/\r?\n/).filter(Boolean);
  const h = csvLine(lines[0]);
  const [own, ind, lvl, emp, disc] = ["own_code", "industry_code", "agglvl_code", "annual_avg_emplvl", "disclosure_code"].map(c => {
    const i = h.indexOf(c);
    if (i < 0) throw new Error(`missing column ${c}`);
    return i;
  });
  for (const l of lines.slice(1)) {
    const r = csvLine(l);
    if (r[own] === "0" && r[ind] === "10" && r[lvl] === "70") {
      const n = Number(r[emp]);
      if (r[disc] || !(n > 0)) throw new Error("county total employment withheld or empty");
      return n;
    }
  }
  throw new Error("no county total row");
}

if (process.argv[1]?.endsWith("job_growth.ts")) {
  const fips = await utahCountyFips();
  const growth: Record<string, number> = {};
  for (const county of new Set(towns().map(t => t.county))) {
    const [a, b] = await Promise.all([FROM, TO].map(async y => countyEmployment(await cached(url(y, fips[county]), `data/raw/bls/qcew-${y}-49${fips[county]}.csv`))));
    growth[county] = Math.round(((b - a) / a) * 1000) / 10;
  }
  const values = requireAllTowns(Object.fromEntries(towns().map(t => [t.id, growth[t.county]])));
  writeMetric("data/metrics/job_growth.json", {
    id: "job_growth",
    label: "Job growth",
    category: "community",
    unit: `% change in county jobs, ${FROM} to ${TO}`,
    higherIsBetter: true,
    description: `Change in annual-average employment (all industries, all ownerships) in the town's county from ${FROM} to ${TO}, from the BLS Quarterly Census of Employment and Wages. QCEW does not publish these towns separately, so every town takes its county's value.`,
    source: "U.S. Bureau of Labor Statistics, Quarterly Census of Employment and Wages (county annual averages)",
    sourceUrl: "https://www.bls.gov/cew/",
    year: TO,
    values,
  });
  console.log(`job_growth: ${Object.keys(values).length}/42`);
}
