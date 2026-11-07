// Derives two affordability metrics from data already on main — no new retrieval.
//   price_to_income = home_value / median_income        (years of income to buy)
//   rent_burden      = median_rent * 12 / median_income  (share of income spent on rent)
// Both inputs are Census ACS 2019-2023 5-year estimates already landed as
// data/metrics/{home_value,median_income,median_rent}.json. Run: npx tsx scripts/data/affordability.ts
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "../..");
const metricsDir = resolve(ROOT, "data/metrics");
const readMetric = (id: string) => JSON.parse(readFileSync(resolve(metricsDir, `${id}.json`), "utf8"));

type Metric = { values: Record<string, number>; sourceUrl: string; year: number };

const homeValue: Metric = readMetric("home_value");
const medianIncome: Metric = readMetric("median_income");
const medianRent: Metric = readMetric("median_rent");

const townIds = Object.keys(medianIncome.values);
const priceToIncome: Record<string, number> = {};
const rentBurden: Record<string, number> = {};
const skipped: string[] = [];

for (const id of townIds) {
  const income = medianIncome.values[id];
  const value = homeValue.values[id];
  const rent = medianRent.values[id];
  if (!(income > 0)) { skipped.push(id); continue; }
  if (typeof value === "number") priceToIncome[id] = Math.round((value / income) * 100) / 100;
  if (typeof rent === "number") rentBurden[id] = Math.round(((rent * 12) / income) * 1000) / 1000;
}

if (skipped.length) {
  console.warn(`Skipped (no positive median_income to divide by): ${skipped.join(", ")}`);
}

writeFileSync(
  resolve(metricsDir, "price_to_income.json"),
  JSON.stringify(
    {
      id: "price_to_income",
      label: "Price-to-income ratio",
      category: "cost",
      unit: "years of median household income",
      higherIsBetter: false,
      description:
        "Median home value divided by median household income: roughly how many years of the typical " +
        "household's income it takes to buy the typical home here. Derived entirely from this repo's existing " +
        `home_value.json and median_income.json (both ${medianIncome.year} Census ACS 5-year estimates), no new ` +
        "data retrieved. Lower is more affordable.",
      source: "Derived from this repo's home_value and median_income metrics (Census ACS 5-year estimates)",
      sourceUrl: homeValue.sourceUrl,
      year: medianIncome.year,
      values: priceToIncome,
    },
    null,
    2,
  ) + "\n",
);

writeFileSync(
  resolve(metricsDir, "rent_burden.json"),
  JSON.stringify(
    {
      id: "rent_burden",
      label: "Rent burden",
      category: "cost",
      unit: "share of median household income spent on median rent (annualized)",
      higherIsBetter: false,
      description:
        "Median gross rent annualized (×12) divided by median household income: the share of the typical " +
        "household's income the typical rent here would consume. Derived entirely from this repo's existing " +
        `median_rent.json and median_income.json (both ${medianIncome.year} Census ACS 5-year estimates), no new ` +
        "data retrieved. Lower is more affordable. A common affordability guideline is that paying more than " +
        "0.30 (30%) of income on rent is considered cost-burdened.",
      source: "Derived from this repo's median_rent and median_income metrics (Census ACS 5-year estimates)",
      sourceUrl: medianRent.sourceUrl,
      year: medianIncome.year,
      values: rentBurden,
    },
    null,
    2,
  ) + "\n",
);

console.log(
  `Wrote price_to_income.json (${Object.keys(priceToIncome).length}/${townIds.length}) and ` +
    `rent_burden.json (${Object.keys(rentBurden).length}/${townIds.length}).`,
);
