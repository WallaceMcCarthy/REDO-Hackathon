// FEMA National Risk Index (census-tract layer, FEMA-hosted ArcGIS service), rolled up to the 42 towns.
// Town value = population-weighted mean of the NRI hazard-type risk index score over the census tracts
// whose centroid lies inside the town's official UGRC outline. A town with no tract centroid inside takes
// the single tract containing its center point; the scripts report how many towns that applies to.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

export const NRI_LAYER = "https://services.arcgis.com/XG15cJAlne2vxtgt/arcgis/rest/services/National_Risk_Index_Census_Tracts/FeatureServer/0";
export const NRI_PAGE = "https://hazards.fema.gov/nri/";

type Ring = [number, number][];
export type Geometry = { type: "Polygon"; coordinates: Ring[] } | { type: "MultiPolygon"; coordinates: Ring[][] };
type Feature = { properties: Record<string, any>; geometry: Geometry };
export type TractScore = { tract: string; population: number; score: number };

const polys = (g: Geometry): Ring[][] => (g.type === "Polygon" ? [g.coordinates] : g.coordinates);

export function inRing(pt: [number, number], ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
/** Inside an outer ring and not inside any of its holes. */
export const inGeometry = (pt: [number, number], g: Geometry) => polys(g).some(([outer, ...holes]) => inRing(pt, outer) && !holes.some(h => inRing(pt, h)));

/** Area-weighted centroid of the largest part of a polygon; good enough to assign a tract to a town. */
export function centroid(g: Geometry): [number, number] {
  let best = { area: -1, c: [0, 0] as [number, number] };
  for (const [ring] of polys(g)) {
    let a = 0, cx = 0, cy = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const f = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
      a += f; cx += (ring[j][0] + ring[i][0]) * f; cy += (ring[j][1] + ring[i][1]) * f;
    }
    if (Math.abs(a) > best.area && a !== 0) best = { area: Math.abs(a), c: [cx / (3 * a), cy / (3 * a)] };
  }
  return best.c;
}

export function rollUp(
  townGeoms: { id: string; center: [number, number]; geometry: Geometry }[],
  tractGeoms: { tract: string; geometry: Geometry }[],
  scores: Map<string, TractScore>,
): { values: Record<string, number>; centerFallback: string[] } {
  const values: Record<string, number> = {};
  const centerFallback: string[] = [];
  const cents = tractGeoms.map(t => ({ ...t, c: centroid(t.geometry) }));
  for (const town of townGeoms) {
    let picks = cents.filter(t => inGeometry(t.c, town.geometry));
    if (!picks.length) {
      picks = cents.filter(t => inGeometry(town.center, t.geometry));
      if (picks.length) centerFallback.push(town.id);
    }
    const rows = picks.map(t => scores.get(t.tract)).filter((r): r is TractScore => !!r);
    if (!rows.length) continue;
    const pop = rows.reduce((s, r) => s + r.population, 0);
    const mean = pop > 0 ? rows.reduce((s, r) => s + r.score * r.population, 0) / pop : rows.reduce((s, r) => s + r.score, 0) / rows.length;
    values[town.id] = Math.round(mean * 10) / 10;
  }
  return { values, centerFallback };
}

/** All Utah tracts' score for one NRI hazard prefix ("IFLD", "WFIR"); one request, cached under data/raw/nri. */
export async function nriScores(prefix: string): Promise<Map<string, TractScore>> {
  const file = `data/raw/nri/utah-${prefix}.json`;
  if (!existsSync(file)) {
    const q = new URLSearchParams({ where: "STATEFIPS='49'", outFields: `TRACTFIPS,POPULATION,${prefix}_RISKS`, returnGeometry: "false", resultRecordCount: "2000", f: "json" });
    const res = await fetch(`${NRI_LAYER}/query?${q}`, { signal: AbortSignal.timeout(120000) });
    const body: any = await res.json();
    if (!res.ok || body.error || body.exceededTransferLimit) throw new Error(`NRI ${prefix}: ${JSON.stringify(body.error ?? res.status)}`);
    mkdirSync("data/raw/nri", { recursive: true });
    writeFileSync(file, JSON.stringify(body));
  }
  const out = new Map<string, TractScore>();
  for (const f of JSON.parse(readFileSync(file, "utf8")).features) {
    const a = f.attributes;
    if (typeof a[`${prefix}_RISKS`] === "number") out.set(a.TRACTFIPS, { tract: a.TRACTFIPS, population: a.POPULATION ?? 0, score: a[`${prefix}_RISKS`] });
  }
  return out;
}

export async function townNriValues(prefix: string) {
  const tractGeoms = (JSON.parse(readFileSync("public/data/utah-tracts.geojson", "utf8")).features as Feature[]).map(f => ({ tract: f.properties.geoid as string, geometry: f.geometry }));
  const townShapes = new Map((JSON.parse(readFileSync("public/data/utah-towns.geojson", "utf8")).features as Feature[]).map(f => [f.properties.cityId as string, f.geometry]));
  const cities = JSON.parse(readFileSync("data/cities.json", "utf8")) as { id: string; lat: number; lng: number }[];
  const geoms = cities.map(c => ({ id: c.id, center: [c.lng, c.lat] as [number, number], geometry: townShapes.get(c.id)! }));
  return rollUp(geoms, tractGeoms, await nriScores(prefix));
}
