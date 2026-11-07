// Health-based SDWA violations in the last 5 years per town's public water system (EPA SDWIS via Envirofacts).
// Run: npx -y tsx scripts/data/water_quality.ts
import { writeFileSync } from "node:fs";
import { townList, writeMethodology } from "./lib.ts";
import { cached } from "./towns.ts";

const PWS: Record<string, [string, string]> = {
  "salt-lake-city": ["UTAH18026", "Salt Lake City Water System"], "west-valley-city": ["UTAH18007", "Granger-Hunter Improvement District"],
  "west-jordan": ["UTAH18020", "West Jordan City Water System"], provo: ["UTAH25006", "Provo City"], orem: ["UTAH25020", "Orem City Water System"],
  sandy: ["UTAH18028", "Sandy City Water System"], "st-george": ["UTAH27015", "St George City Water System"], ogden: ["UTAH29011", "Ogden City Water System"],
  layton: ["UTAH06018", "Layton City Water System"], "south-jordan": ["UTAH18023", "South Jordan City"], lehi: ["UTAH25015", "Lehi City"],
  millcreek: ["UTAH18026", "Salt Lake City Water System"], taylorsville: ["UTAH18021", "Taylorsville-Bennion ID"], herriman: ["UTAH18157", "Herriman City Municipal Water Department"],
  logan: ["UTAH03010", "Logan City Water System"], murray: ["UTAH18024", "Murray City Water System"], draper: ["UTAH18133", "Draper City Water System"],
  bountiful: ["UTAH06015", "Bountiful City Water System"], riverton: ["UTAH18025", "Riverton City Water System"], "spanish-fork": ["UTAH25003", "Spanish Fork City"],
  roy: ["UTAH29016", "Roy City Water System"], "pleasant-grove": ["UTAH25022", "Pleasant Grove City"], "cedar-city": ["UTAH11002", "Cedar City Waterworks"],
  kaysville: ["UTAH06006", "Kaysville City Water System"], "cottonwood-heights": ["UTAH18027", "Jordan Valley WCD"], holladay: ["UTAH18010", "Holliday Water Company"],
  "eagle-mountain": ["UTAH25142", "Eagle Mountain City"], "saratoga-springs": ["UTAH25138", "Saratoga Springs City"], "american-fork": ["UTAH25008", "American Fork City"],
  "park-city": ["UTAH22011", "Park City Water System"], "heber-city": ["UTAH26006", "Heber City Water System"], midway: ["UTAH26008", "Midway City Water System"],
  moab: ["UTAH10003", "Moab City"], vernal: ["UTAH24012", "Vernal City Water System"], price: ["UTAH04007", "Price Municipal Corporation"], tooele: ["UTAH23004", "Tooele City Water System"],
  "brigham-city": ["UTAH02004", "Brigham City Water System"], richfield: ["UTAH21013", "Richfield City"], kanab: ["UTAH13005", "Kanab City"], hurricane: ["UTAH27007", "Hurricane City"],
  washington: ["UTAH27021", "Washington City"], ephraim: ["UTAH20011", "Ephraim City"],
};
const cutoff = new Date(); cutoff.setFullYear(cutoff.getFullYear() - 5);
const values: Record<string, number> = {}; const approx: string[] = []; const detail: string[] = [];
const cache = new Map<string, number>();
for (const [id, [pwsid, name]] of Object.entries(PWS)) {
  if (!cache.has(pwsid)) {
    const url = `https://data.epa.gov/efservice/VIOLATION/PWSID/${pwsid}/JSON`;
    const rows: any[] = JSON.parse((await cached(`data/raw/sdwis_viol_${pwsid}.json`, url)).toString());
    const n = rows.filter((r) => r.is_health_based_ind === "Y" && r.compl_per_begin_date && new Date(r.compl_per_begin_date.replace(" ", "T")) >= cutoff).length;
    cache.set(pwsid, n);
  }
  values[id] = cache.get(pwsid)!; detail.push(`${id}=${pwsid}`);
  if (["west-valley-city", "millcreek", "cottonwood-heights", "holladay"].includes(id)) approx.push(`${id}->${name}`);
}
console.log(values);
writeFileSync("data/metrics/water_quality.json", JSON.stringify({
  id: "water_quality", label: "Drinking water quality", category: "environment", unit: "health-based violations, last 5 years", higherIsBetter: false,
  description: `Number of health-based drinking water violations in the last five years for the town's main community water system, from EPA records. Counts are per system and not adjusted for size. ${townList(approx.map((p) => p.split("->")[0]))} are matched to a nearby supplier that only partly serves them.`,
  source: "EPA SDWIS via Envirofacts (data.epa.gov/efservice VIOLATION table)", sourceUrl: "https://www.epa.gov/enviro/sdwis-model", year: new Date().getFullYear(), values,
}, null, 2));
writeMethodology("water_quality", `Count of EPA SDWIS health-based violations (MCL, treatment technique, etc.; is_health_based_ind=Y) whose compliance period began on/after ${cutoff.toISOString().slice(0, 10)} for the town's primary community water system. Systems used (town=PWSID): ${detail.join(", ")}. Approximate matches (town served partly by this wholesale/neighbor system): ${approx.join("; ")}. Counts are per system, not normalised by size.`);
