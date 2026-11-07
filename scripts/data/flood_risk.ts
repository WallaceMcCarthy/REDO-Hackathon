// flood_risk: FEMA National Risk Index inland-flooding hazard risk index score (0-100), town roll-up.
// Run: npx tsx scripts/data/flood_risk.ts
import { NRI_LAYER, townNriValues } from "./nri";
import { requireAllTowns } from "./town_lookup";
import { writeMetric } from "./lib";

if (process.argv[1]?.endsWith("flood_risk.ts")) {
  const { values, centerFallback } = await townNriValues("IFLD");
  requireAllTowns(values);
  writeMetric("data/metrics/flood_risk.json", {
    id: "flood_risk",
    label: "Flood risk",
    category: "environment",
    unit: "FEMA NRI inland-flooding risk index score (0-100, higher is riskier)",
    higherIsBetter: false,
    description: `FEMA National Risk Index inland-flooding Risk Index score (expected annual loss scaled by social vulnerability and community resilience, national percentile 0-100), averaged over the census tracts inside the town weighted by population. Tracts are assigned to a town when the tract centroid is inside the UGRC municipal outline${centerFallback.length ? `; ${centerFallback.join(", ")} had no tract centroid inside and take the tract containing the town center` : ""}. Measured, not estimated, for all 42 towns.`,
    source: "FEMA National Risk Index, census tract layer (Inland Flooding, IFLD_RISKS)",
    sourceUrl: NRI_LAYER,
    year: 2025,
    values,
  });
  console.log(`flood_risk: ${Object.keys(values).length}/42, center fallback: ${centerFallback.join(",") || "none"}`);
}
