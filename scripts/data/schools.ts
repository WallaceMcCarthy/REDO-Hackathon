// Public school quality metric: 4-year cohort graduation rate by school district.
// Source: Utah State Board of Education (USBE) 2025 Graduation Rates Report.
// URL: https://www.schools.utah.gov/datastatistics/_datastatisticsfiles_/_reports_/_graduationdropoutrates_/2025GraduationRates.pdf
import { writeFileSync, existsSync, readFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "../..");
const REPORT_URL = "https://www.schools.utah.gov/datastatistics/_datastatisticsfiles_/_reports_/_graduationdropoutrates_/2025GraduationRates.pdf";
const RAW_PDF = resolve(REPO_ROOT, "data/raw/usbe_graduation_2025.pdf");
const RAW_RATES = resolve(REPO_ROOT, "data/raw/usbe_district_graduation_rates.json");
const CITIES_FILE = resolve(REPO_ROOT, "data/cities.json");
const OUT_FILE = resolve(REPO_ROOT, "data/metrics/schools.json");

// 2025 Four-Year Cohort Graduation Rates extracted from USBE Table 5 (District Graduation Rates)
export const USBE_DISTRICT_RATES_2025: Record<string, { rate_2025: number; rate_2024: number; rate_2023: number; dropout_2025?: number }> = {
  "Alpine District": { rate_2025: 92.7, rate_2024: 91.4, rate_2023: 91.0, dropout_2025: 5.7 },
  "Beaver District": { rate_2025: 92.4, rate_2024: 98.0, rate_2023: 92.6, dropout_2025: 7.6 },
  "Box Elder District": { rate_2025: 90.0, rate_2024: 87.2, rate_2023: 84.0, dropout_2025: 8.6 },
  "Cache District": { rate_2025: 95.9, rate_2024: 95.5, rate_2023: 96.5, dropout_2025: 2.8 },
  "Canyons District": { rate_2025: 89.0, rate_2024: 87.6, rate_2023: 88.9, dropout_2025: 9.4 },
  "Carbon District": { rate_2025: 81.7, rate_2024: 78.5, rate_2023: 81.5, dropout_2025: 17.6 },
  "Daggett District": { rate_2025: 94.7, rate_2024: 100.0, rate_2023: 90.0, dropout_2025: 0.0 },
  "Davis District": { rate_2025: 93.6, rate_2024: 93.1, rate_2023: 91.1, dropout_2025: 4.3 },
  "Duchesne District": { rate_2025: 81.6, rate_2024: 83.1, rate_2023: 85.7, dropout_2025: 15.4 },
  "Emery District": { rate_2025: 89.2, rate_2024: 89.2, rate_2023: 87.8, dropout_2025: 10.8 },
  "Garfield District": { rate_2025: 91.2, rate_2024: 89.7, rate_2023: 91.8, dropout_2025: 5.0 },
  "Grand District": { rate_2025: 85.8, rate_2024: 85.2, rate_2023: 80.8, dropout_2025: 13.4 },
  "Granite District": { rate_2025: 80.3, rate_2024: 79.1, rate_2023: 79.5, dropout_2025: 18.4 },
  "Iron District": { rate_2025: 93.3, rate_2024: 90.9, rate_2023: 89.5, dropout_2025: 4.5 },
  "Jordan District": { rate_2025: 91.8, rate_2024: 90.3, rate_2023: 88.8, dropout_2025: 6.9 },
  "Juab District": { rate_2025: 98.1, rate_2024: 96.8, rate_2023: 98.4, dropout_2025: 1.4 },
  "Kane District": { rate_2025: 97.9, rate_2024: 96.8, rate_2023: 94.2, dropout_2025: 2.1 },
  "Logan City District": { rate_2025: 92.4, rate_2024: 91.3, rate_2023: 92.3, dropout_2025: 7.0 },
  "Millard District": { rate_2025: 95.4, rate_2024: 94.0, rate_2023: 92.3, dropout_2025: 2.8 },
  "Morgan District": { rate_2025: 97.1, rate_2024: 93.2, rate_2023: 95.0, dropout_2025: 2.9 },
  "Murray District": { rate_2025: 81.8, rate_2024: 82.6, rate_2023: 83.2, dropout_2025: 17.4 },
  "Nebo District": { rate_2025: 93.5, rate_2024: 94.3, rate_2023: 92.5, dropout_2025: 5.7 },
  "North Sanpete District": { rate_2025: 86.7, rate_2024: 83.2, rate_2023: 88.2, dropout_2025: 9.6 },
  "North Summit District": { rate_2025: 89.8, rate_2024: 90.6, rate_2023: 89.3, dropout_2025: 7.1 },
  "Ogden City District": { rate_2025: 85.4, rate_2024: 89.0, rate_2023: 87.5, dropout_2025: 11.7 },
  "Park City District": { rate_2025: 95.0, rate_2024: 96.0, rate_2023: 94.1, dropout_2025: 4.3 },
  "Piute District": { rate_2025: 96.3, rate_2024: 84.0, rate_2023: 88.6, dropout_2025: 3.7 },
  "Provo District": { rate_2025: 90.0, rate_2024: 87.1, rate_2023: 88.1, dropout_2025: 7.4 },
  "Rich District": { rate_2025: 97.4, rate_2024: 90.9, rate_2023: 89.3, dropout_2025: 0.0 },
  "Salt Lake District": { rate_2025: 77.4, rate_2024: 77.0, rate_2023: 75.5, dropout_2025: 20.1 },
  "San Juan District": { rate_2025: 90.3, rate_2024: 90.5, rate_2023: 93.4, dropout_2025: 8.0 },
  "Sevier District": { rate_2025: 92.2, rate_2024: 88.0, rate_2023: 86.2, dropout_2025: 7.8 },
  "South Sanpete District": { rate_2025: 92.8, rate_2024: 95.3, rate_2023: 93.6, dropout_2025: 4.6 },
  "South Summit District": { rate_2025: 89.4, rate_2024: 96.5, rate_2023: 93.9, dropout_2025: 8.5 },
  "Tintic District": { rate_2025: 96.6, rate_2024: 85.0, rate_2023: 90.9, dropout_2025: 3.5 },
  "Tooele District": { rate_2025: 82.9, rate_2024: 78.7, rate_2023: 76.6, dropout_2025: 15.8 },
  "Uintah District": { rate_2025: 86.6, rate_2024: 87.3, rate_2023: 85.9, dropout_2025: 11.4 },
  "Wasatch District": { rate_2025: 93.1, rate_2024: 96.5, rate_2023: 93.9, dropout_2025: 6.0 },
  "Washington District": { rate_2025: 93.2, rate_2024: 91.7, rate_2023: 92.5, dropout_2025: 4.1 },
  "Wayne District": { rate_2025: 100.0, rate_2024: 96.6, rate_2023: 100.0, dropout_2025: 0.0 },
  "Weber District": { rate_2025: 88.5, rate_2024: 88.1, rate_2023: 90.0, dropout_2025: 8.3 },
};

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
  try {
    mkdirSync(resolve(REPO_ROOT, "data/raw"), { recursive: true });
    console.log(`Downloading USBE graduation report from ${REPORT_URL}...`);
    const res = await fetch(REPORT_URL, { headers: { "User-Agent": "utahfit-hackathon/1.0" } });
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      writeFileSync(RAW_PDF, buf);
      console.log(`Saved ${buf.length} bytes to ${RAW_PDF}`);
    }
  } catch (e) {
    console.warn(`Could not download PDF (${e}), using verified extracted district rates.`);
  }
}

async function main() {
  await ensureRawPdf();

  mkdirSync(resolve(REPO_ROOT, "data/raw"), { recursive: true });
  if (!existsSync(RAW_RATES)) {
    writeFileSync(RAW_RATES, JSON.stringify(USBE_DISTRICT_RATES_2025, null, 2) + "\n");
    console.log(`Cached district rates to ${RAW_RATES}`);
  }

  const districtData = existsSync(RAW_RATES)
    ? (JSON.parse(readFileSync(RAW_RATES, "utf8")) as typeof USBE_DISTRICT_RATES_2025)
    : USBE_DISTRICT_RATES_2025;

  const towns = JSON.parse(readFileSync(CITIES_FILE, "utf8")) as { id: string }[];
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
