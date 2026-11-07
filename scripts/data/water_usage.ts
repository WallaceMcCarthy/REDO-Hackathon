// Residential potable GPCD per town's retail water system, Utah DWRe 2022 Municipal & Industrial Water Use.
// Run: npx -y tsx scripts/data/water_usage.ts
import { writeFileSync } from "node:fs";
import { townList, writeMethodology } from "./lib.ts";
import { cached } from "./towns.ts";

const SVC = "https://services.arcgis.com/ZzrwjTRez6FJiOq4/arcgis/rest/services/2022_MnIReport_Data_gdb/FeatureServer/0";
const url = `${SVC}/query?where=1%3D1&outFields=WRENAME,SYSTEMTYPE,WATERRESID,COUNTY,ResPotGPCD,Year&returnGeometry=false&f=json&resultRecordCount=3000`;
const data = JSON.parse((await cached("data/raw/mni2022.json", url)).toString());
const sys = new Map<string, number>(data.features.map((f: any) => [f.attributes.WRENAME, f.attributes.ResPotGPCD]));

// town -> water system name in the dataset. "~" marks approximations (town served by a neighbouring/district system).
const MAP: Record<string, string> = {
  "salt-lake-city": "Salt Lake City Water System", "west-valley-city": "Granger-Hunter Improvement District", "west-jordan": "West Jordan City Water System",
  provo: "Provo City", orem: "Orem City Water System", sandy: "Sandy City Water System", "st-george": "St. George City Water System", ogden: "Ogden City Water System",
  layton: "Layton City Water System", "south-jordan": "South Jordan City", lehi: "Lehi City", millcreek: "Salt Lake City Water System",
  taylorsville: "Taylorsville-Bennion Improvement District", herriman: "Herriman City Municipal Water Department", logan: "Logan City Water System",
  murray: "Murray City Water System", draper: "Draper City Water System", bountiful: "Bountiful City Water System", riverton: "Riverton City Water System",
  "spanish-fork": "Spanish Fork City", roy: "Roy City Water System", "pleasant-grove": "Pleasant Grove City", "cedar-city": "Cedar City Waterworks",
  kaysville: "Kaysville City Water System", "cottonwood-heights": "Jordan Valley Water Conservancy District (Retail)", holladay: "Holliday Water Co.",
  "eagle-mountain": "Eagle Mountain City", "saratoga-springs": "Saratoga Springs City", "american-fork": "American Fork City", "park-city": "Park City Water System",
  "heber-city": "Heber City Water System", midway: "Midway City Water System", moab: "Moab City", vernal: "Vernal City Water System", price: "Price Municipal Corp.",
  tooele: "Tooele City Water System", "brigham-city": "Brigham City Corp.", richfield: "Richfield City", kanab: "Kanab City", hurricane: "Hurricane City",
  washington: "Washington City", ephraim: "Ephraim City",
};
const values: Record<string, number> = {}; const proxies: string[] = [];
for (const [id, name] of Object.entries(MAP)) {
  const v = sys.get(name); if (v === undefined) throw new Error("missing system " + name + " for " + id);
  values[id] = v;
  if (["west-valley-city", "millcreek", "cottonwood-heights", "holladay"].includes(id)) proxies.push(`${id}->${name}`);
}
writeFileSync("data/metrics/water_usage.json", JSON.stringify({
  id: "water_usage", label: "Residential water use", category: "environment", unit: "gallons per capita per day (residential potable)", higherIsBetter: false,
  description: `Residential drinking-water use in gallons per person per day for the town's water system, 2022 data. Potable water only, so towns that also use a separate irrigation system (such as Lehi and Saratoga Springs) look lower than they are. ${townList(proxies.map((p) => p.split("->")[0]))} use a nearby system's figure.`,
  source: "Utah Division of Water Resources, Municipal & Industrial Water Use 2022", sourceUrl: "https://dwre-utahdnr.opendata.arcgis.com/pages/municipal-and-industrial", year: 2022, values,
}, null, 2));
console.log(values);
writeMethodology("water_usage", `System-level residential potable gallons per capita per day (GPCD) for the town's retail culinary water system, 2022 data. Potable only: towns with separate pressurized-irrigation (secondary) water (e.g. Lehi, Saratoga Springs) look low. Approximate system matches where the town has no own system: ${proxies.join("; ")}.`);
