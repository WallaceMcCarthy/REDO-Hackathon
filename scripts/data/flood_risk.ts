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
    description: `FEMA National Risk Index score for inland flooding, from 0 to 100 against all U.S. areas, where higher is riskier. It combines expected losses with how vulnerable and resilient the community is, averaged over the town's census tracts by population.${centerFallback.length ? " A few small towns have no census tract centered inside them and use the tract around the town center instead." : ""}`,
    source: "FEMA National Risk Index, census tract layer (Inland Flooding, IFLD_RISKS)",
    sourceUrl: NRI_LAYER,
    year: 2025,
    values,
  });
  console.log(`flood_risk: ${Object.keys(values).length}/42, center fallback: ${centerFallback.join(",") || "none"}`);
}
