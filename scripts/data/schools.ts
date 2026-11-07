// Public school quality metric: 4-year cohort graduation rate by school district.
// Source: Utah State Board of Education (USBE) 2025 Graduation Rates Report.
// URL: https://www.schools.utah.gov/datastatistics/_datastatisticsfiles_/_reports_/_graduationdropoutrates_/2025GraduationRates.pdf
import { writeFileSync, existsSync, readFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadTowns } from "./towns.ts";

const REPO_ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "../..");
const REPORT_URL = "https://www.schools.utah.gov/datastatistics/_datastatisticsfiles_/_reports_/_graduationdropoutrates_/2025GraduationRates.pdf";
const RAW_PDF = resolve(REPO_ROOT, "data/raw/usbe_graduation_2025.pdf");
const RAW_RATES = resolve(REPO_ROOT, "data/raw/usbe_district_graduation_rates.json");
const OUT_FILE = resolve(REPO_ROOT, "data/metrics/schools.json");

// Mapping from canonical town ID to USBE school district
export const TOWN_TO_DISTRICT: Record<string, string> = {
  "salt-lake-city": "Salt Lake District",
  "west-valley-city": "Granite District",
  "west-jordan": "Jordan District",
  "provo": "Provo District",
  "orem": "Alpine District",
  "sandy": "Canyons District",
  "st-george": "Washington District",
  "ogden": "Ogden City District",
  "layton": "Davis District",
  "south-jordan": "Jordan District",
  "lehi": "Alpine District",
  "millcreek": "Granite District",
  "taylorsville": "Granite District",
  "herriman": "Jordan District",
  "logan": "Logan City District",
  "murray": "Murray District",
  "draper": "Canyons District",
  "bountiful": "Davis District",
  "riverton": "Jordan District",
  "spanish-fork": "Nebo District",
  "roy": "Weber District",
  "pleasant-grove": "Alpine District",
  "cedar-city": "Iron District",
  "kaysville": "Davis District",
  "cottonwood-heights": "Canyons District",
  "holladay": "Granite District",
  "eagle-mountain": "Alpine District",
  "saratoga-springs": "Alpine District",
  "american-fork": "Alpine District",
  "park-city": "Park City District",
  "heber-city": "Wasatch District",
  "midway": "Wasatch District",
  "moab": "Grand District",
  "vernal": "Uintah District",
  "price": "Carbon District",
  "tooele": "Tooele District",
  "brigham-city": "Box Elder District",
  "richfield": "Sevier District",
  "kanab": "Kane District",
  "hurricane": "Washington District",
  "washington": "Washington District",
  "ephraim": "South Sanpete District",
};

async function ensureRawPdf() {
  if (existsSync(RAW_PDF)) return;
  mkdirSync(resolve(REPO_ROOT, "data/raw"), { recursive: true });
  console.log(`Downloading USBE graduation report from ${REPORT_URL}...`);
  const res = await fetch(REPORT_URL, { headers: { "User-Agent": "utahfit-hackathon/1.0" } });
  if (!res.ok) throw new Error(`Failed to download USBE report: ${res.status} ${res.statusText}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(RAW_PDF, buf);
  console.log(`Saved ${buf.length} bytes to ${RAW_PDF}`);
}

async function main() {
  await ensureRawPdf();

  if (!existsSync(RAW_RATES)) {
    throw new Error(`District rates file missing: ${RAW_RATES}`);
  }

  const districtData = JSON.parse(readFileSync(RAW_RATES, "utf8")) as Record<string, { rate_2025: number; rate_2024: number; rate_2023: number; dropout_2025?: number }>;

  const towns = await loadTowns();
  const values: Record<string, number> = {};

  for (const town of towns) {
    const districtName = TOWN_TO_DISTRICT[town.id];
    if (!districtName) {
      throw new Error(`No school district mapped for town ${town.id}`);
    }

    const d = districtData[districtName];
    if (!d || d.rate_2025 === undefined) {
      throw new Error(`No USBE graduation rate found for district '${districtName}' (town: ${town.id})`);
    }

    values[town.id] = d.rate_2025;
    console.log(`  ${town.id.padEnd(20)} -> ${districtName.padEnd(24)}: ${d.rate_2025}%`);
  }

  const metric = {
    id: "schools",
    label: "High school graduation rate",
    category: "education",
    unit: "% graduation rate",
    higherIsBetter: true,
    description: "Four-year cohort graduation rate from the Utah State Board of Education (USBE) 2025 Graduation Rates Report, mapped to each town's public school district.",
    source: "Utah State Board of Education (USBE) 2025 Graduation Report",
    sourceUrl: "https://www.schools.utah.gov/datastatistics/_datastatisticsfiles_/_reports_/_graduationdropoutrates_/2025GraduationRates.pdf",
    year: 2025,
    values,
  };

  mkdirSync(resolve(REPO_ROOT, "data/metrics"), { recursive: true });
  writeFileSync(OUT_FILE, JSON.stringify(metric, null, 2) + "\n");
  console.log(`\nWrote ${Object.keys(values).length} town school metrics to ${OUT_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
