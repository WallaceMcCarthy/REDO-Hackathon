import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
export const ENDPOINT = "https://overpass-api.de/api/interpreter";
export async function overpass(query: string, cacheFile: string): Promise<any> {
  if (existsSync(cacheFile)) return JSON.parse(readFileSync(cacheFile, "utf8"));
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(ENDPOINT, { method: "POST", headers: { "User-Agent": "utahfit-hackathon/1.0", "Content-Type": "application/x-www-form-urlencoded" }, body: "data=" + encodeURIComponent(query) });
    if (res.ok) {
      const j = await res.json();
      mkdirSync("data/raw", { recursive: true });
      writeFileSync(cacheFile, JSON.stringify(j));
      await sleep(3000);
      return j;
    }
    console.error("overpass", res.status, "retry");
    await sleep(15000 * (attempt + 1));
  }
  throw new Error("overpass failed");
}
export function haversineKm(a: [number, number], b: [number, number]) {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b[0] - a[0]) * rad, dLng = (b[1] - a[1]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
export function writeMetric(file: string, m: object) {
  mkdirSync("data/metrics", { recursive: true });
  writeFileSync(file, JSON.stringify(m, null, 2) + "\n");
}
/** Real coordinates from Wikipedia (GeoData API), cached in data/raw/wiki_coords.json */
export async function wikiCoords(titles: string[]): Promise<Record<string, [number, number]>> {
  const cache = "data/raw/wiki_coords.json";
  const have: Record<string, [number, number]> = existsSync(cache) ? JSON.parse(readFileSync(cache, "utf8")) : {};
  const need = titles.filter(t => !have[t]);
  for (let i = 0; i < need.length; i += 20) {
    const chunk = need.slice(i, i + 20);
    const r = await (await fetch("https://en.wikipedia.org/w/api.php?action=query&format=json&redirects=1&prop=coordinates&colimit=max&titles=" + encodeURIComponent(chunk.join("|")), { headers: { "User-Agent": "utahfit-hackathon/1.0" } })).json();
    const map: Record<string, string> = {};
    for (const n of r.query.normalized ?? []) map[n.from] = n.to;
    for (const n of r.query.redirects ?? []) map[n.from] = n.to;
    const pages: Record<string, [number, number]> = {};
    for (const p of Object.values<any>(r.query.pages)) if (p.coordinates) pages[p.title] = [p.coordinates[0].lat, p.coordinates[0].lon];
    for (const t of chunk) { let x = t; for (let k = 0; k < 3; k++) x = map[x] ?? x; if (pages[x]) have[t] = pages[x]; else console.error("NO COORDS", t); }
    await sleep(500);
  }
  mkdirSync("data/raw", { recursive: true });
  writeFileSync(cache, JSON.stringify(have, null, 1));
  return have;
}

const METHODOLOGY = "data/metrics-methodology.json";
export const readMethodology = (): Record<string, string> => (existsSync(METHODOLOGY) ? JSON.parse(readFileSync(METHODOLOGY, "utf8")) : {});
/** The technical record behind a metric's short user-facing description (queries, components, snapshots). */
export function writeMethodology(id: string, text: string) {
  const all = { ...readMethodology(), [id]: text };
  writeFileSync(METHODOLOGY, JSON.stringify(Object.fromEntries(Object.entries(all).sort(([a], [b]) => a.localeCompare(b))), null, 2) + "\n");
}
/** "west-valley-city", "millcreek" -> "West Valley City and Millcreek" */
export const townList = (ids: string[]) =>
  new Intl.ListFormat("en").format(ids.map((i) => i.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ")));
