// Tech establishments within ~25 km of each town from Census ZBP 2023 & ZCTA Gazetteer.
// NAICS 51 (Information sector proxy) + 5415 (Computer systems design and related services).
// Run: npx -y tsx scripts/data/tech_employers.ts

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { loadTowns, haversineKm, cached } from "./towns.ts";

const YEAR = 2023;
const GAZ_URL = "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2023_Gazetteer/2023_Gaz_zcta_national.zip";
const ZBP_URL = "https://www2.census.gov/programs-surveys/cbp/datasets/2023/zbp23detail.zip";

const GAZ_ZIP = "data/raw/2023_Gaz_zcta_national.zip";
const ZBP_ZIP = "data/raw/zbp23detail.zip";

const GAZ_TXT = "data/raw/2023_Gaz_zcta_national.txt";
const ZBP_TXT = "data/raw/zbp23detail.txt";

// 1. Ensure raw archives and text files are downloaded and extracted
await cached(GAZ_ZIP, GAZ_URL);
await cached(ZBP_ZIP, ZBP_URL);

if (!existsSync(GAZ_TXT)) {
  execFileSync("tar", ["-xf", GAZ_ZIP, "-C", "data/raw"]);
}
if (!existsSync(ZBP_TXT)) {
  execFileSync("tar", ["-xf", ZBP_ZIP, "-C", "data/raw"]);
}

// 2. Parse Utah ZCTAs (84xxx) from official Census Gazetteer
const gazContent = readFileSync(GAZ_TXT, "utf8");
const gazLines = gazContent.split(/\r?\n/).filter(Boolean);
const gazHdr = gazLines[0].split("\t").map((h) => h.trim());
const geoidIdx = gazHdr.indexOf("GEOID");
const latIdx = gazHdr.indexOf("INTPTLAT");
const lngIdx = gazHdr.indexOf("INTPTLONG");

const zctaCoords = new Map<string, [number, number]>();
for (let i = 1; i < gazLines.length; i++) {
  const parts = gazLines[i].split("\t");
  if (parts.length > lngIdx) {
    const zcta = parts[geoidIdx].trim();
    if (zcta.startsWith("84")) {
      const lat = parseFloat(parts[latIdx].trim());
      const lng = parseFloat(parts[lngIdx].trim());
      zctaCoords.set(zcta, [lat, lng]);
    }
  }
}

// 3. Parse Utah tech establishments from ZBP 2023
// NAICS 51---- is Information (industry proxy including software publishers, data hosting, internet publishing)
// NAICS 5415// is Computer Systems Design and Related Services
const zbpContent = readFileSync(ZBP_TXT, "utf8");
const zbpLines = zbpContent.split(/\r?\n/).filter(Boolean);

const parseCsvLine = (line: string): string[] => {
  const out: string[] = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuote = !inQuote;
    } else if (ch === "," && !inQuote) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
};

const zbpHdr = parseCsvLine(zbpLines[0]);
const zipCol = zbpHdr.indexOf("zip");
const naicsCol = zbpHdr.indexOf("naics");
const estCol = zbpHdr.indexOf("est");
const stabbrCol = zbpHdr.indexOf("stabbr");

const zipTech = new Map<string, number>();
let totalUtTech = 0;

for (let i = 1; i < zbpLines.length; i++) {
  const row = parseCsvLine(zbpLines[i]);
  if (row.length <= stabbrCol) continue;
  if (row[stabbrCol] !== "UT") continue;

  const naics = row[naicsCol];
  if (naics === "51----" || naics === "5415//") {
    const zip = row[zipCol];
    const est = parseInt(row[estCol], 10) || 0;
    zipTech.set(zip, (zipTech.get(zip) ?? 0) + est);
    totalUtTech += est;
  }
}

// Log coverage gaps: ZIP codes with establishments lacking an official ZCTA gazetteer centroid
const unmappedZips: string[] = [];
let unmappedEst = 0;
for (const [zip, est] of zipTech.entries()) {
  if (!zctaCoords.has(zip)) {
    unmappedZips.push(`${zip} (${est} est)`);
    unmappedEst += est;
  }
}
if (unmappedZips.length > 0) {
  console.log(`Coverage gap: omitted ${unmappedZips.length} PO-box ZIP(s) without official ZCTA centroid: ${unmappedZips.join(", ")} (${unmappedEst} est)`);
}

console.log(`Mapped ${zipTech.size - unmappedZips.length} Utah ZCTAs with ${totalUtTech - unmappedEst} tech establishments.`);

// 4. Calculate total establishments within straight-line 25 km for each town
const towns = loadTowns();
const values: Record<string, number> = {};

for (const town of towns) {
  let count = 0;
  for (const [zip, est] of zipTech.entries()) {
    const coords = zctaCoords.get(zip);
    if (!coords) continue; // Skip unmapped PO-box ZIPs; do not invent coordinates
    const dist = haversineKm(town.lat, town.lng, coords[0], coords[1]);
    if (dist <= 25.0) {
      count += est;
    }
  }
  values[town.id] = count;
}

// 5. Output data/metrics/tech_employers.json
const output = {
  id: "tech_employers",
  label: "Tech employers",
  category: "community",
  unit: "establishments within 25km",
  higherIsBetter: true,
  description:
    "Estimated count of tech establishments located within a straight-line 25 km radius of the town centroid, based on U.S. Census Bureau 2023 ZIP Code Business Patterns (ZBP) for NAICS 51 (Information sector proxy, including software publishers) and NAICS 5415 (Computer Systems Design and Related Services). Mapped strictly using official 2023 Census ZCTA Gazetteer centroid coordinates (unmatched PO-box ZIPs omitted as coverage gaps).",
  source: "U.S. Census Bureau, 2023 ZIP Code Business Patterns (ZBP) & 2023 ZCTA Gazetteer",
  sourceUrl: "https://www.census.gov/programs-surveys/cbp/data/datasets.html",
  year: YEAR,
  values,
};

writeFileSync("data/metrics/tech_employers.json", JSON.stringify(output, null, 2) + "\n");
console.log(`Wrote data/metrics/tech_employers.json with ${Object.keys(values).length} towns.`);
