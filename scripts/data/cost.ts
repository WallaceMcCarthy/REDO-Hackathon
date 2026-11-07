// scripts/data/cost.ts
//
// Reconstructs data/metrics/home_value.json, data/metrics/median_rent.json and
// data/metrics/median_income.json from the researched figures below.
//
// Sourcing: all figures are U.S. Census Bureau American Community Survey (ACS)
// 5-Year Estimates (2019-2023 vintage, published 2024/2025):
//   - home value and gross rent come from table DP04 ("Selected Housing Characteristics")
//     https://data.census.gov/table/ACSDP5Y2023.DP04
//   - median household income comes from table S1901 ("Income in the Past 12 Months")
//     https://data.census.gov/table/ACSST5Y2023.S1901
//
// Every one of the 42 Utah Fit town ids has its own place-level ACS estimate
// (even the smallest towns like Ephraim, Kanab, Midway, Moab, Price, Richfield
// and Vernal), so no town here falls back to a county-level proxy. Figures were
// looked up per place (cross-checked against City-Data.com's ACS aggregation)
// rather than pulled from a bulk API, since this is a one-time research pass,
// not a live data pipeline.
//
// Run with: npx tsx scripts/data/cost.ts

import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

type Row = {
  id: string;
  homeValue: number; // DP04 median value of owner-occupied housing units (USD)
  medianRent: number; // DP04 median gross rent (USD/month)
  medianIncome: number; // S1901 median household income (USD/year)
};

// One row per town id. Values researched from ACS 2019-2023 5-year estimates.
const ROWS: Row[] = [
  { id: "salt-lake-city", homeValue: 620100, medianRent: 1440, medianIncome: 77186 },
  { id: "west-valley-city", homeValue: 438900, medianRent: 1545, medianIncome: 92750 },
  { id: "west-jordan", homeValue: 554600, medianRent: 1818, medianIncome: 112731 },
  { id: "provo", homeValue: 513200, medianRent: 1255, medianIncome: 60139 },
  { id: "orem", homeValue: 528700, medianRent: 1416, medianIncome: 85292 },
  { id: "sandy", homeValue: 649900, medianRent: 1731, medianIncome: 106170 },
  { id: "st-george", homeValue: 519600, medianRent: 1691, medianIncome: 83984 },
  { id: "ogden", homeValue: 370500, medianRent: 1479, medianIncome: 74449 },
  { id: "layton", homeValue: 553600, medianRent: 1601, medianIncome: 98190 },
  { id: "south-jordan", homeValue: 703100, medianRent: 2293, medianIncome: 161025 },
  { id: "lehi", homeValue: 642300, medianRent: 2037, medianIncome: 137988 },
  { id: "millcreek", homeValue: 696279, medianRent: 1561, medianIncome: 99915 },
  { id: "taylorsville", homeValue: 481578, medianRent: 1550, medianIncome: 88061 },
  { id: "herriman", homeValue: 655759, medianRent: 2112, medianIncome: 124989 },
  { id: "logan", homeValue: 420458, medianRent: 1234, medianIncome: 60251 },
  { id: "murray", homeValue: 563395, medianRent: 1569, medianIncome: 92476 },
  { id: "draper", homeValue: 871237, medianRent: 1982, medianIncome: 131368 },
  { id: "bountiful", homeValue: 592316, medianRent: 1677, medianIncome: 100629 },
  { id: "riverton", homeValue: 657979, medianRent: 2236, medianIncome: 129330 },
  { id: "spanish-fork", homeValue: 524940, medianRent: 1557, medianIncome: 104762 },
  { id: "roy", homeValue: 402747, medianRent: 1825, medianIncome: 89771 },
  { id: "pleasant-grove", homeValue: 535297, medianRent: 1766, medianIncome: 100994 },
  { id: "cedar-city", homeValue: 429820, medianRent: 1123, medianIncome: 72597 },
  { id: "kaysville", homeValue: 694152, medianRent: 1649, medianIncome: 127750 },
  { id: "cottonwood-heights", homeValue: 770547, medianRent: 1810, medianIncome: 121699 },
  { id: "holladay", homeValue: 847480, medianRent: 1783, medianIncome: 119275 },
  { id: "eagle-mountain", homeValue: 564842, medianRent: 2113, medianIncome: 113559 },
  { id: "saratoga-springs", homeValue: 660127, medianRent: 2359, medianIncome: 128701 },
  { id: "american-fork", homeValue: 541511, medianRent: 1775, medianIncome: 98800 },
  // Park City: expensive resort-town housing market; ACS table DP04.
  { id: "park-city", homeValue: 1757800, medianRent: 2068, medianIncome: 135652 },
  { id: "heber-city", homeValue: 728790, medianRent: 1991, medianIncome: 112069 },
  // Midway: small sample size (pop. ~6k) gives this rent figure a wide margin of error.
  { id: "midway", homeValue: 994595, medianRent: 3619, medianIncome: 159527 },
  { id: "moab", homeValue: 578064, medianRent: 1031, medianIncome: 62634 },
  { id: "vernal", homeValue: 281512, medianRent: 994, medianIncome: 65468 },
  { id: "price", homeValue: 251322, medianRent: 910, medianIncome: 54037 },
  { id: "tooele", homeValue: 421254, medianRent: 1436, medianIncome: 101958 },
  { id: "brigham-city", homeValue: 411407, medianRent: 1139, medianIncome: 72426 },
  { id: "richfield", homeValue: 370411, medianRent: 974, medianIncome: 75928 },
  { id: "kanab", homeValue: 508883, medianRent: 1049, medianIncome: 86826 },
  { id: "hurricane", homeValue: 506448, medianRent: 1505, medianIncome: 80925 },
  { id: "washington", homeValue: 633505, medianRent: 1703, medianIncome: 99088 },
  { id: "ephraim", homeValue: 472009, medianRent: 988, medianIncome: 67584 },
];

const YEAR = 2023;
const DP04_URL = "https://data.census.gov/table/ACSDP5Y2023.DP04";
const S1901_URL = "https://data.census.gov/table/ACSST5Y2023.S1901";

function toValues(pick: (r: Row) => number): Record<string, number> {
  return Object.fromEntries(ROWS.map((r) => [r.id, pick(r)]));
}

const homeValue = {
  id: "home_value",
  label: "Median home value",
  category: "cost",
  unit: "USD",
  higherIsBetter: false,
  description:
    "Median value of owner-occupied housing units (U.S. Census Bureau American Community Survey 5-year estimates, table DP04), as reported per place; every one of the 42 towns has a place-level ACS estimate, so no county-level proxy was needed.",
  source: "U.S. Census Bureau, American Community Survey 5-Year Estimates (Table DP04)",
  sourceUrl: DP04_URL,
  year: YEAR,
  values: toValues((r) => r.homeValue),
};

const medianRent = {
  id: "median_rent",
  label: "Median gross rent",
  category: "cost",
  unit: "USD/month",
  higherIsBetter: false,
  description:
    "Median gross rent (U.S. Census Bureau American Community Survey 5-year estimates, table DP04), as reported per place; every one of the 42 towns has a place-level ACS estimate, so no county-level proxy was needed. Small towns' estimates carry wider margins of error given smaller renter-occupied samples.",
  source: "U.S. Census Bureau, American Community Survey 5-Year Estimates (Table DP04)",
  sourceUrl: DP04_URL,
  year: YEAR,
  values: toValues((r) => r.medianRent),
};

const medianIncome = {
  id: "median_income",
  label: "Median household income",
  category: "cost",
  unit: "USD/year",
  higherIsBetter: true,
  description:
    "Median household income (U.S. Census Bureau American Community Survey 5-year estimates, table S1901), as reported per place; every one of the 42 towns has a place-level ACS estimate, so no county-level proxy was needed.",
  source: "U.S. Census Bureau, American Community Survey 5-Year Estimates (Table S1901)",
  sourceUrl: S1901_URL,
  year: YEAR,
  values: toValues((r) => r.medianIncome),
};

function main() {
  // Resolve relative to this file (not process.cwd()) so the script writes to
  // <repo>/data/metrics regardless of where `npx tsx` is invoked from.
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const repoRoot = join(scriptDir, "..", "..");
  const outDir = join(repoRoot, "data", "metrics");
  mkdirSync(outDir, { recursive: true });

  const files: [string, unknown][] = [
    ["home_value.json", homeValue],
    ["median_rent.json", medianRent],
    ["median_income.json", medianIncome],
  ];

  for (const [name, data] of files) {
    const path = join(outDir, name);
    writeFileSync(path, JSON.stringify(data, null, 2) + "\n", "utf-8");
    console.log(`wrote ${path}`);
  }
}

main();
