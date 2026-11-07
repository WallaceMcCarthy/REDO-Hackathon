// Crime rate per 1,000 residents from Utah BCI "Crime in Utah" (NIBRS) per-agency tables.
// Run: npx -y tsx scripts/data/crime_rate.ts
import { writeFileSync } from "node:fs";
import { cached } from "./towns.ts";
import { pdfPages, pdfLines } from "./pdftext.ts";

const R24 = "https://bci.utah.gov/wp-content/uploads/2024-Crime-in-Utah-Report.pdf";
const R23 = "https://bci.utah.gov/wp-content/uploads/2023-Crime-in-Utah-Report.pdf";
type Row = { pop: number; persons: number; property: number };

async function parse(path: string, url: string): Promise<Map<string, Row>> {
  const pages = pdfPages(await cached(path, url));
  const out = new Map<string, Row>();
  for (const pg of pages) {
    if (!pg.some((i) => i.t.includes("Crime Rate Per 1,000"))) continue;
    const hy = Math.min(...pg.filter((i) => /Crimes Against|NIBRS Offenses Total|Crime Rate Per/.test(i.t)).map((i) => i.y));
    const labels = pg.filter((i) => i.x > 70 && i.x < 100 && i.y < hy - 3 && i.y > 60 && !/^[\d.]+$/.test(i.t));
    for (const l of labels) {
      const cells = pg.filter((i) => i.x > 270 && Math.abs(i.y - (l.y + 0.8)) < 1.5).sort((a, b) => a.x - b.x).map((i) => i.t);
      // columns: Population, Persons, Property, Society, Total, Rate
      if (cells.length === 6 && cells.every((c) => /^[\d.]+$/.test(c))) {
        out.set(l.t.trim(), { pop: +cells[0], persons: +cells[1], property: +cells[2] });
      }
    }
  }
  return out;
}

const y24 = await parse("data/raw/ciu2024.pdf", R24);
// 2023 report's table layout differs; only used as fallback via line-based parse (cols: pop, persons, property, society, total, rate).
const y23 = new Map<string, Row>();
for (const ln of pdfLines(await cached("data/raw/ciu2023.pdf", R23))) {
  const m = ln.match(/^([A-Za-z.' ]+ (?:PD|DPS|Sheriff))\t(\d+)\t(\d+)\t(\d+)\t(\d+)\t(\d+)\t[\d.]+$/);
  if (m && +m[3] + +m[4] + +m[5] === +m[6]) y23.set(m[1], { pop: +m[2], persons: +m[3], property: +m[4] }); // society at m[5]
}
console.log("agencies parsed:", y24.size, y23.size);

// town -> reporting agency (2024 report names). Shared-jurisdiction agencies noted.
const AG: Record<string, string> = {
  "salt-lake-city": "Salt Lake City PD", "west-valley-city": "West Valley PD", "west-jordan": "West Jordan PD", provo: "Provo PD", orem: "Orem DPS",
  sandy: "Sandy PD", "st-george": "St. George PD", ogden: "Ogden PD", layton: "Layton PD", "south-jordan": "South Jordan PD", lehi: "Lehi PD",
  millcreek: "Unified Police Dept. of Greater Salt Lake", taylorsville: "Taylorsville PD", herriman: "Herriman PD", logan: "Logan PD", murray: "Murray PD",
  draper: "Draper PD", bountiful: "Bountiful PD", riverton: "Riverton PD", "spanish-fork": "Spanish Fork PD", roy: "Roy PD", "pleasant-grove": "Pleasant Grove PD",
  "cedar-city": "Cedar City PD", kaysville: "Kaysville PD", "cottonwood-heights": "Cottonwood Heights PD", holladay: "Unified Police Dept. of Greater Salt Lake",
  "eagle-mountain": "Utah County Sheriff", "saratoga-springs": "Saratoga Springs PD", "american-fork": "American Fork PD", "park-city": "Park City PD",
  "heber-city": "Heber City PD", midway: "Wasatch County Sheriff", moab: "Moab PD", vernal: "Vernal PD", price: "Price PD", tooele: "Tooele PD",
  "brigham-city": "Brigham City PD", richfield: "Richfield PD", kanab: "Kanab PD", hurricane: "Hurricane PD", washington: "Washington City PD", ephraim: "Ephraim PD",
};
const values: Record<string, number> = {}; const notes: string[] = [];
for (const [id, a] of Object.entries(AG)) {
  let r = y24.get(a), yr = 2024;
  if (!r) { r = y23.get(a); yr = 2023; }
  if (!r) throw new Error("no data for " + id + " / " + a);
  values[id] = Math.round(((r.persons + r.property) / r.pop) * 1000 * 100) / 100;
  if (yr === 2023) notes.push(`${id} uses 2023 report (no 2024 data submitted)`);
  if (/Unified|County Sheriff/.test(a)) notes.push(`${id} uses ${a} (shared/county jurisdiction rate)`);
}
console.log(values, notes);
writeFileSync("data/metrics/crime_rate.json", JSON.stringify({
  id: "crime_rate", label: "Crime rate", category: "safety", unit: "NIBRS crimes against persons + property per 1,000 residents", higherIsBetter: false,
  description: `Reported NIBRS offenses against persons and against property (excludes crimes against society, e.g. drug offenses) divided by the reporting agency's stable resident population, x1000, from the Utah BCI Crime in Utah 2024 report. 'Persons' includes simple assault, so this is broader than UCR violent+index property. Notes: ${notes.join("; ")}.`,
  source: "Utah BCI (DPS) Crime in Utah 2024 report, NIBRS Crimes Against Totals", sourceUrl: R24, year: 2024, values,
}, null, 2));
