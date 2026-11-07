// Apartment complexes across Utah towns from HUD LIHTC, HUD Multifamily, and OpenStreetMap.
// Rents are HUD FY2025 Fair Market Rent (2-Bedroom) by county/metro area.
// Schema conforms to CONTRACT.md Phase 2 and agent-board coordination msgs #91, #95, #99.

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "../..");
const CITIES_FILE = resolve(REPO_ROOT, "data/cities.json");
const RAW_DIR = resolve(REPO_ROOT, "data/raw");
const OUT_FILE = resolve(REPO_ROOT, "data/listings/apartments.json");

const RAW_LIHTC = resolve(RAW_DIR, "hud_lihtc_ut.json");
const RAW_MULTIFAMILY = resolve(RAW_DIR, "hud_multifamily_ut.json");
const RAW_OSM = resolve(RAW_DIR, "osm_apartments.json");

export interface ListingRecord {
  id: string;
  cityId: string;
  kind: "apartment";
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  value: null;
  rent: number;
  beds: number;
  sqft: null;
  yearBuilt: number | null;
  year: number;
  units: number | null;
  propertyType: "Apartment complex";
  source: string;
  sourceUrl: string;
}

interface RawCandidate {
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  units: number | null;
  yearBuilt: number | null;
  source: string;
  sourceUrl: string;
  priority: number;
}

// HUD FY2025 Fair Market Rent (2-Bedroom) by County / Metro Area.
// Source: https://www.huduser.gov/portal/datasets/fmr.html (huduser.gov's own
// FMR documentation pages return a bot-check response to scripted fetches, so
// these values were cross-checked against the "2 BR FMR" column of the
// National Low Income Housing Coalition's "Out of Reach 2025" Utah report,
// https://nlihc.org/sites/default/files/oor/2025_OOR-Utah.pdf, which states
// on each table page "2: FMR = Fiscal Year 2025 Fair Market Rent" and is
// itself built directly from HUD's official FY2025 FMR release. Several
// entries below differed from the prior hand-typed values (Summit, Wasatch,
// Tooele, Grand, Kane especially) and were corrected to match.
export const COUNTY_FMR_2BR_2025: Record<string, number> = {
  "Salt Lake": 1748,
  "Utah": 1355,
  "Davis": 1532,
  "Weber": 1532,
  "Washington": 1485,
  "Cache": 1169,
  "Summit": 1808,
  "Wasatch": 1457,
  "Tooele": 1203,
  "Box Elder": 1012,
  "Iron": 1098,
  "Grand": 1409,
  "Uintah": 933,
  "Carbon": 933,
  "Sevier": 933,
  "Sanpete": 999,
  "Kane": 1401,
};

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371.0;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function fetchIfMissing(url: string, path: string): Promise<string> {
  if (existsSync(path)) {
    return readFileSync(path, "utf-8");
  }
  if (!existsSync(RAW_DIR)) {
    mkdirSync(RAW_DIR, { recursive: true });
  }
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.statusText}`);
  }
  const text = await res.text();
  writeFileSync(path, text, "utf-8");
  return text;
}

export async function generateApartments(): Promise<ListingRecord[]> {
  const citiesRaw = readFileSync(CITIES_FILE, "utf-8");
  const cities: Array<{ id: string; name: string; county: string; lat: number; lng: number }> =
    JSON.parse(citiesRaw);

  // Fetch or load raw data
  const lihtcJsonStr = await fetchIfMissing(
    "https://services.arcgis.com/VTyQ9soqVukalItT/arcgis/rest/services/LIHTC/FeatureServer/0/query?where=PROJ_ST%3D'UT'&outFields=*&f=json",
    RAW_LIHTC
  );
  const mfJsonStr = await fetchIfMissing(
    "https://services.arcgis.com/VTyQ9soqVukalItT/arcgis/rest/services/Multifamily_Properties_Assisted/FeatureServer/0/query?where=STD_ST%3D'UT'&outFields=*&f=json",
    RAW_MULTIFAMILY
  );
  let osmJsonStr = "";
  if (existsSync(RAW_OSM)) {
    osmJsonStr = readFileSync(RAW_OSM, "utf-8");
  } else {
    const overpassQuery = `[out:json][timeout:90];
(
  node["building"="apartments"]["name"](36.9,-114.1,42.1,-109.0);
  way["building"="apartments"]["name"](36.9,-114.1,42.1,-109.0);
  relation["building"="apartments"]["name"](36.9,-114.1,42.1,-109.0);
);
out center tags;`;
    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: overpassQuery,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    if (res.ok) {
      osmJsonStr = await res.text();
      writeFileSync(RAW_OSM, osmJsonStr, "utf-8");
    }
  }

  const lihtcData = JSON.parse(lihtcJsonStr);
  const mfData = JSON.parse(mfJsonStr);
  const osmData = osmJsonStr ? JSON.parse(osmJsonStr) : { elements: [] };

  const candidates: RawCandidate[] = [];

  // 1. HUD LIHTC
  for (const f of lihtcData.features || []) {
    const attr = f.attributes || {};
    const lat = attr.LAT;
    const lon = attr.LON;
    const name = attr.PROJECT;
    if (!name || lat == null || lon == null) continue;

    const addrStr = attr.STD_ADDR || attr.PROJ_ADD || "";
    const cityStr = attr.STD_CITY || attr.PROJ_CTY || "";
    const zipStr = attr.STD_ZIP5 || attr.PROJ_ZIP || "";
    const address = addrStr ? `${addrStr.trim()}, ${cityStr.trim()}, UT ${zipStr.trim()}`.replace(/,\s*,/g, ",").trim() : null;

    let units: number | null = null;
    if (attr.N_UNITS) {
      const u = parseInt(attr.N_UNITS, 10);
      if (!isNaN(u) && u > 0) units = u;
    }

    let yearBuilt: number | null = null;
    if (attr.YR_PIS) {
      const y = parseInt(attr.YR_PIS, 10);
      if (!isNaN(y) && y >= 1850 && y <= 2026) yearBuilt = y;
    }

    const objectId = attr.OBJECTID;
    candidates.push({
      name: name.trim(),
      address,
      lat: Number(Number(lat).toFixed(6)),
      lng: Number(Number(lon).toFixed(6)),
      units,
      yearBuilt,
      source: "HUD LIHTC Database",
      sourceUrl: objectId != null
        ? `https://services.arcgis.com/VTyQ9soqVukalItT/arcgis/rest/services/LIHTC/FeatureServer/0/query?where=OBJECTID%3D${objectId}&outFields=*&f=json`
        : "https://lihtc.huduser.gov/",
      priority: 1,
    });
  }

  // 2. HUD Multifamily Assisted
  for (const f of mfData.features || []) {
    const attr = f.attributes || {};
    let lat = attr.LATITUDE ?? attr.LAT;
    let lon = attr.LONGITUDE ?? attr.LON;
    const geom = f.geometry || {};
    if ((lat == null || lon == null) && geom.x != null && geom.y != null) {
      lon = (geom.x / 20037508.34) * 180.0;
      lat = (180.0 / Math.PI) * (2.0 * Math.atan(Math.exp((geom.y / 20037508.34) * Math.PI)) - Math.PI / 2.0);
    }
    const name = attr.PROPERTY_NAME_TEXT;
    if (!name || lat == null || lon == null) continue;

    const addrStr = (attr.STD_ADDR || attr.ADDRESS_LINE1_TEXT || "").trim();
    const cityStr = (attr.STD_CITY || attr.PLACED_BASE_CITY_NAME_TEXT || "").trim();
    const zipStr = (attr.STD_ZIP5 || "").trim();
    const address = addrStr ? `${addrStr}, ${cityStr}, UT ${zipStr}`.replace(/,\s*,/g, ",").trim() : null;

    let units: number | null = null;
    if (attr.TOTAL_UNIT_COUNT) {
      const u = parseInt(attr.TOTAL_UNIT_COUNT, 10);
      if (!isNaN(u) && u > 0) units = u;
    }

    const objectId = attr.OBJECTID;
    candidates.push({
      name: name.trim(),
      address,
      lat: Number(Number(lat).toFixed(6)),
      lng: Number(Number(lon).toFixed(6)),
      units,
      yearBuilt: null,
      source: "HUD Multifamily Properties Assisted",
      sourceUrl: objectId != null
        ? `https://services.arcgis.com/VTyQ9soqVukalItT/arcgis/rest/services/Multifamily_Properties_Assisted/FeatureServer/0/query?where=OBJECTID%3D${objectId}&outFields=*&f=json`
        : "https://hudgis-hud.opendata.arcgis.com/datasets/multifamily-properties-assisted",
      priority: 2,
    });
  }

  // 3. OpenStreetMap apartments
  for (const el of osmData.elements || []) {
    const lat = el.type === "node" ? el.lat : el.center?.lat;
    const lon = el.type === "node" ? el.lon : el.center?.lon;
    if (lat == null || lon == null) continue;

    const tags = el.tags || {};
    const name = tags.name;
    if (!name || !name.trim()) continue;

    const addrParts: string[] = [];
    if (tags["addr:housenumber"] && tags["addr:street"]) {
      addrParts.push(`${tags["addr:housenumber"]} ${tags["addr:street"]}`);
    }
    if (tags["addr:city"]) addrParts.push(tags["addr:city"]);
    if (tags["addr:postcode"]) addrParts.push(`UT ${tags["addr:postcode"]}`);
    const address = addrParts.length > 0 ? addrParts.join(", ") : null;

    let units: number | null = null;
    for (const k of ["units", "building:units", "flats"]) {
      if (tags[k]) {
        const u = parseInt(tags[k], 10);
        if (!isNaN(u) && u > 0) {
          units = u;
          break;
        }
      }
    }

    let yearBuilt: number | null = null;
    if (tags.start_date) {
      const y = parseInt(String(tags.start_date).slice(0, 4), 10);
      if (!isNaN(y) && y >= 1850 && y <= 2026) yearBuilt = y;
    }

    candidates.push({
      name: name.trim(),
      address,
      lat: Number(Number(lat).toFixed(6)),
      lng: Number(Number(lon).toFixed(6)),
      units,
      yearBuilt,
      source: "OpenStreetMap contributors (building=apartments)",
      sourceUrl: el.type && el.id != null
        ? `https://www.openstreetmap.org/${el.type}/${el.id}`
        : "https://www.openstreetmap.org/copyright",
      priority: 3,
    });
  }

  // Map candidates to cities
  const cityCandidates: Record<string, Array<{ dist: number; priority: number; item: RawCandidate }>> = {};
  for (const c of cities) {
    cityCandidates[c.id] = [];
  }

  // Towns whose municipal area is spread thin across a large or sparsely-built
  // county: allow a wider catchment radius than the dense Wasatch Front default.
  const ruralCities = new Set([
    "moab", "vernal", "price", "richfield", "kanab", "ephraim",
    "cedar-city", "tooele", "brigham-city", "heber-city", "hurricane",
    "herriman", "spanish-fork",
  ]);

  // "Ambiguous far pin" guard: a candidate whose nearest canonical town is only
  // reachable at a rural-radius distance (>12 km, i.e. beyond what any normal
  // town's own catchment would allow), AND whose second-nearest town is almost
  // exactly as far away (<2.5 km gap), is more likely sitting in a real but
  // untracked third town between the two (e.g. Kamas, between Heber City and
  // Park City) than genuinely inside either one's catchment. Verified against
  // the full candidate set: this fires on exactly the one confirmed
  // misattribution (two LIHTC records in Kamas, UT wrongly claimed by
  // heber-city) and nothing else, so it's safe to exclude rather than guess.
  for (const cand of candidates) {
    const sorted = cities
      .map((c) => ({ city: c, dist: haversineKm(cand.lat, cand.lng, c.lat, c.lng) }))
      .sort((a, b) => a.dist - b.dist);
    const [best, second] = sorted;

    if (best.dist > 12.0 && second.dist - best.dist < 2.5) {
      continue; // Ambiguous between two distant towns; likely a third, untracked town. Drop it.
    }

    const maxRadius = ruralCities.has(best.city.id) ? 25.0 : 12.0;
    if (best.dist <= maxRadius) {
      cityCandidates[best.city.id].push({
        dist: best.dist,
        priority: cand.priority,
        item: cand,
      });
    }
  }

  // There used to be a "fallback" here that filled Eagle Mountain and Midway
  // by raw distance alone (within 14km, later tried at 25km) whenever the
  // normal nearest-city loop above found nothing for them, ignoring whether
  // some other town was actually closer. That's what put six real Heber
  // City/Park City apartment complexes on Midway's page and ten real
  // Saratoga Springs complexes on Eagle Mountain's: duplicated listings
  // (identical name+address+coords) under the wrong town, not real records
  // for that town. Checked with a nearest-city-respecting search out to
  // 30km: zero LIHTC/HUD-Multifamily/OSM-tagged complexes are ever actually
  // closer to Eagle Mountain's or Midway's center than to some other
  // canonical town, so there's no fallback radius that would find real,
  // correctly-attributed candidates for them. Removed rather than kept at a
  // radius that would just relabel someone else's complexes again.

  const listings: ListingRecord[] = [];
  const townCounts: Record<string, number> = {};

  for (const c of cities) {
    const cid = c.id;
    const county = c.county;
    const rent = COUNTY_FMR_2BR_2025[county] ?? 1350;

    const list = cityCandidates[cid].sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.dist - b.dist;
    });

    const seenNames = new Set<string>();
    const townApts: ListingRecord[] = [];

    for (const { item } of list) {
      const norm = item.name
        .toLowerCase()
        .replace(/apartments/g, "")
        .replace(/apartment/g, "")
        .replace(/apts/g, "")
        .trim();

      if (!norm || seenNames.has(norm)) continue;
      seenNames.add(norm);

      const listingId = `apt-${cid}-${townApts.length + 1}`;
      townApts.push({
        id: listingId,
        cityId: cid,
        kind: "apartment",
        name: item.name,
        address: item.address,
        lat: item.lat,
        lng: item.lng,
        value: null,
        rent,
        beds: 2,
        sqft: null,
        yearBuilt: item.yearBuilt,
        year: 2025,
        units: item.units,
        propertyType: "Apartment complex",
        source: `${item.source} + HUD FY2025 FMR`,
        sourceUrl: item.sourceUrl,
      });

      if (townApts.length >= 40) break;
    }

    townCounts[cid] = townApts.length;
    listings.push(...townApts);
  }

  // Ensure listings output directory exists
  const outDir = resolve(REPO_ROOT, "data/listings");
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }

  writeFileSync(OUT_FILE, JSON.stringify(listings, null, 2) + "\n", "utf-8");
  const sizeKb = statSync(OUT_FILE).size / 1024;

  console.log(`Generated ${listings.length} apartment listings across ${cities.length} towns.`);
  console.log(`Output: ${OUT_FILE} (${sizeKb.toFixed(1)} KB)`);

  return listings;
}

// Execute directly if run as main script
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
  generateApartments().catch((err) => {
    console.error("Error generating apartments:", err);
    process.exit(1);
  });
}
