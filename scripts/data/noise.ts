// Noise PROXY: distance (km) from town center to the nearest interstate (OSM highway=motorway, ref "I ...")
// or commercial/military airport with an IATA code (OSM aeroway=aerodrome). NOT measured decibels.
// Run: npx -y tsx scripts/data/noise.ts
import { writeFileSync, existsSync, readFileSync, mkdirSync } from "node:fs";
import { loadTowns } from "./towns.ts";

const Q = '[out:json][timeout:90];area["ISO3166-2"="US-UT"]->.a;(way(area.a)["highway"="motorway"]["ref"~"^I "];nwr(area.a)["aeroway"="aerodrome"]["iata"];);out geom;';
const F = "data/raw/osm_noise.json"; mkdirSync("data/raw", { recursive: true });
if (!existsSync(F)) {
  const r = await fetch("https://overpass-api.de/api/interpreter", { method: "POST", headers: { "User-Agent": "utah-fit-hackathon/1.0 (data script)", Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" }, body: "data=" + encodeURIComponent(Q) });
  if (!r.ok) throw new Error("overpass " + r.status);
  writeFileSync(F, Buffer.from(await r.arrayBuffer()));
}
const els: any[] = JSON.parse(readFileSync(F, "utf8")).elements;
type Pt = [number, number];
const roads: Pt[][] = []; const airports: { name: string; pts: Pt[] }[] = [];
for (const e of els) {
  const g: Pt[] = e.geometry ? e.geometry.map((p: any) => [p.lat, p.lon]) : e.lat !== undefined ? [[e.lat, e.lon]] : e.bounds ? [[(e.bounds.minlat + e.bounds.maxlat) / 2, (e.bounds.minlon + e.bounds.maxlon) / 2]] : [];
  if (!g.length) continue;
  if (e.tags?.highway === "motorway") roads.push(g); else airports.push({ name: e.tags?.name ?? "?", pts: g });
}
// planar km distance from point to segment (equirectangular around the point; fine at these scales)
function dSeg(lat: number, lng: number, a: Pt, b: Pt) {
  const kx = 111.32 * Math.cos((lat * Math.PI) / 180), ky = 110.57;
  const ax = (a[1] - lng) * kx, ay = (a[0] - lat) * ky, bx = (b[1] - lng) * kx, by = (b[0] - lat) * ky;
  const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy; let t = L ? -(ax * dx + ay * dy) / L : 0; t = Math.max(0, Math.min(1, t));
  return Math.hypot(ax + t * dx, ay + t * dy);
}
const minDist = (lat: number, lng: number, lines: Pt[][]) => { let m = 1e9; for (const l of lines) { if (l.length === 1) m = Math.min(m, dSeg(lat, lng, l[0], l[0])); for (let i = 0; i + 1 < l.length; i++) m = Math.min(m, dSeg(lat, lng, l[i], l[i + 1])); } return m; };
const values: Record<string, number> = {}; const info: string[] = [];
for (const t of loadTowns()) {
  const dr = minDist(t.lat, t.lng, roads), da = minDist(t.lat, t.lng, airports.map((a) => a.pts));
  values[t.id] = Math.round(Math.min(dr, da) * 10) / 10; info.push(`${t.id}:I=${dr.toFixed(1)},A=${da.toFixed(1)}`);
}
console.log(roads.length, "interstate ways;", airports.length, "airports\n", values);
writeFileSync("data/metrics/noise.json", JSON.stringify({
  id: "noise", label: "Quiet (distance from highway/airport noise)", category: "environment", unit: "km to nearest interstate or airport", higherIsBetter: true,
  description: `PROXY, not measured noise: straight-line distance from the town center point to the nearest interstate highway (OSM highway=motorway with ref 'I-') or airport with an IATA code (OSM aeroway=aerodrome), whichever is closer. Larger = farther from major transport noise sources. Measured at a single city-center point, so large towns that span highways are understated. Components (km, interstate/airport): ${info.join(" ")}.`,
  source: "OpenStreetMap contributors via Overpass API (derived distances)", sourceUrl: "https://www.openstreetmap.org/copyright", year: new Date().getFullYear(), values,
}, null, 2));
