// owner_occupancy: share of occupied housing units that are owner-occupied, per town.
// Source: ACS 2020-2024 5-year, table B25003 (Tenure), place level.
// Run: npx tsx scripts/data/owner_occupancy.ts
import { ACS_BASE, acsPlaceLines, pickPlaces, placeFips } from "./acs_places";
import { requireAllTowns } from "./town_lookup";
import { writeMetric } from "./lib";

export const ownerShare = (owner: number | null, total: number | null) =>
  owner === null || !total ? NaN : Math.round((owner / total) * 1000) / 1000;

if (process.argv[1]?.endsWith("owner_occupancy.ts")) {
  const rows = pickPlaces(await acsPlaceLines("B25003"), await placeFips(), ["B25003_E001", "B25003_E002"]);
  const values = requireAllTowns(Object.fromEntries(Object.entries(rows).map(([id, r]) => [id, ownerShare(r.B25003_E002, r.B25003_E001)])));
  writeMetric("data/metrics/owner_occupancy.json", {
    id: "owner_occupancy",
    label: "Owner-occupied homes",
    category: "community",
    unit: "share of occupied housing units that are owner-occupied",
    higherIsBetter: true,
    description: "Owner-occupied housing units divided by all occupied housing units (ACS table B25003, place level, all 42 towns measured directly). A higher share means more long-term residents with a stake in the neighborhood.",
    source: "U.S. Census Bureau, 2020-2024 ACS 5-year estimates (B25003)",
    sourceUrl: `${ACS_BASE}acsdt5y2024-b25003.dat`,
    year: 2024,
    values,
  });
  console.log(`owner_occupancy: ${Object.keys(values).length}/42`);
}
