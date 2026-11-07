// Shared helpers for the public-data metric scripts: the 42 towns, a cached download, a CSV line parser.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export type Town = { id: string; name: string; county: string };
export const towns = (): Town[] => JSON.parse(readFileSync("data/cities.json", "utf8"));

/** Census place names carry a legal suffix ("Provo city", "Salt Lake City city"); strip every trailing " city". */
export const placeKey = (name: string) => name.trim().toLowerCase().replace(/(\s+city)+$/, "");

export async function cached(url: string, file: string): Promise<string> {
  if (existsSync(file)) return readFileSync(file, "utf8");
  const res = await fetch(url, { headers: { "User-Agent": "utahfit-hackathon/1.0" }, signal: AbortSignal.timeout(180000) });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  const text = await res.text();
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
  return text;
}

export function csvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "", quoted = false;
  for (const ch of line.replace(/\r$/, "")) {
    if (ch === '"') quoted = !quoted;
    else if (ch === "," && !quoted) { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

/** Every town must be covered or the metric is not written: no estimates, no gaps papered over. */
export function requireAllTowns(values: Record<string, number>): Record<string, number> {
  const missing = towns().filter(t => !Number.isFinite(values[t.id])).map(t => t.id);
  if (missing.length) throw new Error(`no source value for: ${missing.join(", ")}`);
  return values;
}
