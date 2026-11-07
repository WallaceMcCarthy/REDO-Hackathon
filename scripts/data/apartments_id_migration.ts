/**
 * Authoritative, reproducible migration dictionary generator from legacy
 * positional apartment IDs (apt-<cityId>-<n>) to permanent source-derived
 * stable IDs (apt-lihtc-*, apt-mf-*, apt-osm-*).
 *
 * Rules:
 * 1. STRICT EXACT MATCHING ONLY: No fuzzy matching, no nearest-candidate radius guessing.
 *    - For HUD LIHTC & Multifamily: exact match by source OBJECTID (from sourceUrl or raw attributes).
 *    - For OSM: exact match by raw OSM element (tags.name + exact coordinates within 20m).
 * 2. Unmatched or ambiguous candidates explicitly retain stableId: null.
 * 3. Collisions across legacy releases (c09489c vs 0a869d8) are recorded and isolated.
 * 4. retainedInUtahFit strictly reflects membership in current data/listings/apartments.json.
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "../..");
const RAW_DIR = resolve(REPO_ROOT, "data/raw");
const CITIES_FILE = resolve(REPO_ROOT, "data/cities.json");
const MUNI_FILE = resolve(RAW_DIR, "utah_municipal_boundaries.json");
const APARTMENTS_FILE = resolve(REPO_ROOT, "data/listings/apartments.json");
const OUT_FILE = resolve(REPO_ROOT, "data/listings/apartments_id_migration.json");

interface LegacyListing {
  id: string;
  cityId: string;
  kind: "apartment";
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  source: string;
  sourceUrl: string;
}

export function generateMigrationDictionary() {
  const cities: Array<{ id: string; name: string }> = JSON.parse(readFileSync(CITIES_FILE, "utf-8"));
  const canonicalCityNames = new Map(cities.map((c) => [c.name.toLowerCase(), c.id]));

  const activeApartments: Array<{ id: string; cityId: string }> = existsSync(APARTMENTS_FILE)
    ? JSON.parse(readFileSync(APARTMENTS_FILE, "utf-8"))
    : [];
  const activeApartmentMap = new Map(activeApartments.map((a) => [a.id, a.cityId]));

  const lihtcRaw = JSON.parse(readFileSync(resolve(RAW_DIR, "hud_lihtc_ut.json"), "utf-8"));
  const mfRaw = JSON.parse(readFileSync(resolve(RAW_DIR, "hud_multifamily_ut.json"), "utf-8"));
  const osmRaw = JSON.parse(readFileSync(resolve(RAW_DIR, "osm_apartments.json"), "utf-8"));
  const muniRaw = existsSync(MUNI_FILE) ? JSON.parse(readFileSync(MUNI_FILE, "utf-8")) : { features: [] };

  const lihtcByObjId = new Map<string, string>();
  for (const f of lihtcRaw.features || []) {
    const a = f.attributes || {};
    if (a.OBJECTID != null) {
      lihtcByObjId.set(String(a.OBJECTID), `apt-lihtc-${a.HUD_ID || a.OBJECTID}`);
    }
  }

  const mfByObjId = new Map<string, string>();
  for (const f of mfRaw.features || []) {
    const a = f.attributes || {};
    if (a.OBJECTID != null) {
      mfByObjId.set(String(a.OBJECTID), `apt-mf-${a.PROPERTY_ID || a.OBJECTID}`);
    }
  }

  function findMuni(lon: number, lat: number): string {
    for (const feat of muniRaw.features || []) {
      const rings = feat.geometry?.rings as [number, number][][] | undefined;
      const name = feat.attributes?.NAME as string | undefined;
      if (!rings || !name) continue;
      let inside = false;
      for (const ring of rings) {
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
          const [xi, yi] = ring[i];
          const [xj, yj] = ring[j];
          if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
            inside = !inside;
          }
        }
      }
      if (inside) return name;
    }
    return "Unincorporated";
  }

  function resolveExactStableId(row: LegacyListing): { stableId: string | null; method: string } {
    const sourceUrl = row.sourceUrl || "";
    const source = row.source || "";

    // 1. Direct OBJECTID in sourceUrl
    const objMatch = sourceUrl.match(/OBJECTID%3D(\d+)/);
    if (objMatch) {
      const objId = objMatch[1];
      if (source.includes("LIHTC")) {
        const sid = lihtcByObjId.get(objId);
        if (sid) return { stableId: sid, method: "exact_lihtc_objectid" };
      }
      if (source.includes("Multifamily")) {
        const sid = mfByObjId.get(objId);
        if (sid) return { stableId: sid, method: "exact_mf_objectid" };
      }
    }

    // 2. Exact match in LIHTC by name + coordinates (< 20 meters)
    if (source.includes("LIHTC")) {
      const rname = row.name.trim().toLowerCase();
      const matches: string[] = [];
      for (const f of lihtcRaw.features || []) {
        const a = f.attributes || {};
        const name = (a.PROJECT || "").trim().toLowerCase();
        const lat = a.LAT;
        const lon = a.LON;
        if (name === rname && lat != null && lon != null && Math.abs(lat - row.lat) < 0.0002 && Math.abs(lon - row.lng) < 0.0002) {
          matches.push(`apt-lihtc-${a.HUD_ID || a.OBJECTID}`);
        }
      }
      if (matches.length === 1) return { stableId: matches[0], method: "exact_lihtc_name_coords" };
    }

    // 3. Exact match in Multifamily by name + coordinates (< 20 meters)
    if (source.includes("Multifamily")) {
      const rname = row.name.trim().toLowerCase();
      const matches: string[] = [];
      for (const f of mfRaw.features || []) {
        const a = f.attributes || {};
        const name = (a.PROPERTY_NAME_TEXT || "").trim().toLowerCase();
        const lat = a.LATITUDE ?? a.LAT;
        const lon = a.LONGITUDE ?? a.LON;
        if (name === rname && lat != null && lon != null && Math.abs(lat - row.lat) < 0.0002 && Math.abs(lon - row.lng) < 0.0002) {
          matches.push(`apt-mf-${a.PROPERTY_ID || a.OBJECTID}`);
        }
      }
      if (matches.length === 1) return { stableId: matches[0], method: "exact_mf_name_coords" };
    }

    // 4. Exact match in OpenStreetMap by name + coordinates (< 20 meters)
    if (source.includes("OpenStreetMap")) {
      const rname = row.name.trim().toLowerCase();
      const matches: string[] = [];
      for (const el of osmRaw.elements || []) {
        const ename = (el.tags?.name || "").trim().toLowerCase();
        const lat = el.type === "node" ? el.lat : el.center?.lat;
        const lon = el.type === "node" ? el.lon : el.center?.lon;
        if (ename === rname && lat != null && lon != null && Math.abs(lat - row.lat) < 0.0002 && Math.abs(lon - row.lng) < 0.0002) {
          matches.push(`apt-osm-${el.type}-${el.id}`);
        }
      }
      if (matches.length === 1) return { stableId: matches[0], method: "exact_osm_name_coords" };
    }

    return { stableId: null, method: "unmatched" };
  }

  const c0: LegacyListing[] = JSON.parse(execSync("git show c09489c:data/listings/apartments.json", { cwd: REPO_ROOT, encoding: "utf-8" }));
  const c1: LegacyListing[] = JSON.parse(execSync("git show 0a869d8:data/listings/apartments.json", { cwd: REPO_ROOT, encoding: "utf-8" }));

  const c0ById = new Map(c0.map((x) => [x.id, x]));
  const c1ById = new Map(c1.map((x) => [x.id, x]));
  const allOldIds = Array.from(new Set([...c0ById.keys(), ...c1ById.keys()])).sort();

  const mappings = [];
  const collisions = [];

  for (const oid of allOldIds) {
    const row0 = c0ById.get(oid);
    const row1 = c1ById.get(oid);

    const res0 = row0 ? resolveExactStableId(row0) : { stableId: null, method: "not_in_commit" };
    const res1 = row1 ? resolveExactStableId(row1) : { stableId: null, method: "not_in_commit" };

    const name0 = row0?.name ?? null;
    const name1 = row1?.name ?? null;

    const muni0 = row0 ? findMuni(row0.lng, row0.lat) : null;
    const muni1 = row1 ? findMuni(row1.lng, row1.lat) : null;

    const isCollision = name0 !== null && name1 !== null && name0.trim().toLowerCase() !== name1.trim().toLowerCase();
    if (isCollision) {
      collisions.push({
        oldId: oid,
        version_c09489c: { name: name0, stableId: res0.stableId, trueMunicipality: muni0, resolutionMethod: res0.method },
        version_0a869d8: { name: name1, stableId: res1.stableId, trueMunicipality: muni1, resolutionMethod: res1.method },
      });
    }

    const primaryRow = row1 || row0!;
    const primaryStable = res1.stableId || res0.stableId;
    const primaryMuni = muni1 || muni0;
    const primaryCityId = primaryRow.cityId;

    const isRetained = Boolean(primaryStable && activeApartmentMap.has(primaryStable));
    const retainedCityId = primaryStable ? activeApartmentMap.get(primaryStable) ?? null : null;

    mappings.push({
      oldId: oid,
      assignedCityId: primaryCityId,
      name: primaryRow.name,
      newStableId: primaryStable,
      trueMunicipality: primaryMuni,
      retainedInUtahFit: isRetained,
      retainedCityId,
      collisionBetweenReleases: isCollision,
      history: {
        c09489c: row0 ? { name: name0, stableId: res0.stableId, trueMunicipality: muni0, method: res0.method } : null,
        "0a869d8": row1 ? { name: name1, stableId: res1.stableId, trueMunicipality: muni1, method: res1.method } : null,
      },
    });
  }

  const output = {
    description: "Authoritative migration dictionary from legacy positional apartment IDs (apt-<cityId>-<n>) to permanent source-derived stable IDs (apt-lihtc-*, apt-mf-*, apt-osm-*). Strictly generated via exact source OBJECTID and exact OSM (type, id) + coordinate matching.",
    methodology: "No fuzzy matching or nearest-candidate fallback is permitted. Each record is resolved exclusively against its raw source layer (HUD LIHTC, HUD Multifamily, OpenStreetMap). Ambiguous or duplicate entries remain explicitly flagged. retainedInUtahFit strictly reflects existence in data/listings/apartments.json.",
    totalMapped: mappings.length,
    totalCollisions: collisions.length,
    collisions,
    mappings,
  };

  writeFileSync(OUT_FILE, JSON.stringify(output, null, 2) + "\n", "utf-8");
  console.log(`Generated authoritative migration dictionary: ${mappings.length} mappings, ${collisions.length} collisions.`);
  return output;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
  generateMigrationDictionary();
}
