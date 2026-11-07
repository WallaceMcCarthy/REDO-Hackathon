// PM2.5 annual mean per town from nearest EPA AQS monitor. Run: npx -y tsx scripts/data/air_quality.ts
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { loadTowns, haversineKm, cached } from "./towns.ts";

const YEAR = Number(process.env.YEAR ?? 2025);
const url = `https://aqs.epa.gov/aqsweb/airdata/annual_conc_by_monitor_${YEAR}.zip`;
await cached(`data/raw/annual_conc_by_monitor_${YEAR}.zip`, url);
const csv = execFileSync("unzip", ["-p", `data/raw/annual_conc_by_monitor_${YEAR}.zip`], { maxBuffer: 1 << 30 }).toString();
const lines = csv.split(/\r?\n/).filter(Boolean);
const parse = (l: string) => { const o: string[] = []; let c = "", q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === "," && !q) { o.push(c); c = ""; } else c += ch; } o.push(c); return o; };
const hdr = parse(lines[0]);
const ix = (n: string) => hdr.indexOf(n);
const sites = new Map<string, { lat: number; lng: number; vals: number[] }>();
for (const l of lines.slice(1)) {
  const f = parse(l);
  if (f[ix("State Code")] !== "49" || f[ix("Parameter Code")] !== "88101") continue;
  if (f[ix("Pollutant Standard")] !== "PM25 Annual 2024") continue; // official annual NAAQS metric
  if (f[ix("Metric Used")] !== "Quarterly Means of Daily Means") continue;
  if (f[ix("Completeness Indicator")] !== "Y") continue;
  const k = f[ix("County Code")] + "-" + f[ix("Site Num")];
  const s = sites.get(k) ?? { lat: +f[ix("Latitude")], lng: +f[ix("Longitude")], vals: [] };
  s.vals.push(+f[ix("Arithmetic Mean")]); sites.set(k, s);
}
const mons = [...sites.entries()].map(([k, s]) => ({ k, ...s, mean: s.vals.reduce((a, b) => a + b) / s.vals.length }));
if (!mons.length) throw new Error("no Utah monitors found");
const values: Record<string, number> = {}; const notes: string[] = [];
for (const t of loadTowns()) {
  let best = mons[0], bd = 1e9;
  for (const m of mons) { const d = haversineKm(t.lat, t.lng, m.lat, m.lng); if (d < bd) { bd = d; best = m; } }
  values[t.id] = Math.round(best.mean * 100) / 100;
  notes.push(`${t.id}:${Math.round(bd)}km`);
}
console.log(mons.length, "monitors;", notes.join(" "));
writeFileSync("data/metrics/air_quality.json", JSON.stringify({
  id: "air_quality", label: "Air quality", category: "environment", unit: "µg/m³ PM2.5 (annual mean)", higherIsBetter: false,
  description: `Annual mean PM2.5 (${YEAR}) at the nearest EPA AQS regulatory monitor in Utah (${mons.length} monitors; straight-line distance, mean across monitors' POCs). Towns have no monitor of their own, so distance to assigned monitor in km: ${notes.join(", ")}.`,
  source: "EPA Air Quality System (AQS) annual concentration by monitor", sourceUrl: "https://aqs.epa.gov/aqsweb/airdata/download_files.html#Annual", year: YEAR, values,
}, null, 2));
