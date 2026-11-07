// wildfire_risk: FEMA National Risk Index wildfire hazard risk index score (0-100), town roll-up.
// Run: npx tsx scripts/data/wildfire_risk.ts
import { NRI_LAYER, townNriValues } from "./nri";
import { requireAllTowns } from "./town_lookup";
import { writeMetric } from "./lib";

if (process.argv[1]?.endsWith("wildfire_risk.ts")) {
  const { values, centerFallback } = await townNriValues("WFIR");
  requireAllTowns(values);
  writeMetric("data/metrics/wildfire_risk.json", {
    id: "wildfire_risk",
    label: "Wildfire risk",
    category: "environment",
    unit: "FEMA NRI wildfire risk index score (0-100, higher is riskier)",
    higherIsBetter: false,
    description: `FEMA National Risk Index wildfire Risk Index score (expected annual loss scaled by social vulnerability and community resilience, national percentile 0-100), averaged over the census tracts inside the town weighted by population. Tracts are assigned to a town when the tract centroid is inside the UGRC municipal outline${centerFallback.length ? `; ${centerFallback.join(", ")} had no tract centroid inside and take the tract containing the town center` : ""}. Measured, not estimated, for all 42 towns.`,
    source: "FEMA National Risk Index, census tract layer (Wildfire, WFIR_RISKS)",
    sourceUrl: NRI_LAYER,
    year: 2025,
    values,
  });
  console.log(`wildfire_risk: ${Object.keys(values).length}/42, center fallback: ${centerFallback.join(",") || "none"}`);
}
