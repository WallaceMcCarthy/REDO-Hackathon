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
    description: `FEMA National Risk Index score for wildfire, from 0 to 100 against all U.S. areas, where higher is riskier. It combines expected losses with how vulnerable and resilient the community is, averaged over the town's census tracts by population.${centerFallback.length ? " A few small towns have no census tract centered inside them and use the tract around the town center instead." : ""}`,
    source: "FEMA National Risk Index, census tract layer (Wildfire, WFIR_RISKS)",
    sourceUrl: NRI_LAYER,
    year: 2025,
    values,
  });
  console.log(`wildfire_risk: ${Object.keys(values).length}/42, center fallback: ${centerFallback.join(",") || "none"}`);
}
