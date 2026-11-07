import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export type Town = {
  id: string;
  name: string;
  county: string;
  lat: number;
  lng: number;
  population?: number;
  blurb?: string;
};

const CITIES_PATH = resolve(process.cwd(), "data/cities.json");

function loadFromCitiesJson(): Town[] {
  if (existsSync(CITIES_PATH)) {
    const raw = JSON.parse(readFileSync(CITIES_PATH, "utf8"));
    return raw.map((c: any) => ({
      id: c.id,
      name: c.name,
      county: c.county,
      lat: Number(c.lat),
      lng: Number(c.lng),
      population: Number(c.population),
      blurb: c.blurb,
    }));
  }
  return [];
}

export const T: Town[] = loadFromCitiesJson();

export function loadTowns(): Town[] {
  if (T.length > 0) return T;
  return loadFromCitiesJson();
}

export function haversineKm(a: number, b: number, c: number, d: number): number {
  const r = (x: number) => (x * Math.PI) / 180;
  const h =
    Math.sin(r(c - a) / 2) ** 2 +
    Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(r(d - b) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

export async function cached(path: string, url: string, init?: RequestInit): Promise<Buffer> {
  const { existsSync, readFileSync, writeFileSync, mkdirSync } = await import("node:fs");
  mkdirSync("data/raw", { recursive: true });
  if (existsSync(path)) return readFileSync(path);
  const r = await fetch(url, init);
  if (!r.ok) throw new Error(r.status + " " + url);
  const b = Buffer.from(await r.arrayBuffer());
  writeFileSync(path, b);
  return b;
}
