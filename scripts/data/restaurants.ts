import { loadTowns } from "./townpop.ts";
import { overpass, writeMetric } from "./osmlib.ts";
const NAMES: Record<string, string> = { "st-george": "St. George", "washington": "Washington" };
const main = async () => {
  const towns = await loadTowns();
  const values: Record<string, number> = {};
  const fallback: string[] = [];
  for (const t of towns) {
    const name = NAMES[t.id] ?? t.id.split("-").map(w => w[0].toUpperCase() + w.slice(1)).join(" ");
    const q = `[out:json][timeout:90];area["name"="Utah"]["admin_level"="4"]->.ut;area["name"="${name}"]["boundary"="administrative"](area.ut)->.t;nwr["amenity"~"^(restaurant|cafe)$"](area.t);out count;`;
    let j = await overpass(q, `data/raw/restaurants_${t.id}.json`);
    let n = Number(j.elements[0].tags.total);
    let area = true;
    if (n === 0) { // boundary not found: fall back to 3 km radius
      const q2 = `[out:json][timeout:60];nwr["amenity"~"^(restaurant|cafe)$"](around:3000,${t.lat},${t.lng});out count;`;
      j = await overpass(q2, `data/raw/restaurants_r3km_${t.id}.json`);
      n = Number(j.elements[0].tags.total); area = false; fallback.push(t.id);
    }
    values[t.id] = Math.round((n / (t.population / 1000)) * 100) / 100;
    console.log(t.id, n, t.population, values[t.id], area ? "" : "(3km fallback)");
  }
  writeMetric("data/metrics/restaurants.json", {
    id: "restaurants", label: "Restaurants & cafes", category: "culture", unit: "per 1,000 residents", higherIsBetter: true,
    description: `OpenStreetMap restaurants + cafes inside the town boundary divided by population (Wikidata). Towns with no matching boundary or zero results used a 3 km radius around the center: ${fallback.join(", ") || "none"}.`,
    source: "OpenStreetMap via Overpass API; population from Wikidata", sourceUrl: "https://overpass-api.de/api/interpreter", year: new Date().getFullYear(), values,
  });
};
main();
