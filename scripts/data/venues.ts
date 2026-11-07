import { loadTowns } from "./townpop.ts";
import { overpass, writeMetric } from "./osmlib.ts";
const main = async () => {
  const towns = await loadTowns();
  const values: Record<string, number> = {};
  for (const t of towns) {
    const q = `[out:json][timeout:60];(nwr["amenity"~"^(theatre|arts_centre|music_venue)$"](around:15000,${t.lat},${t.lng});nwr["tourism"~"^(gallery|museum)$"](around:15000,${t.lat},${t.lng}););out count;`;
    const j = await overpass(q, `data/raw/venues_${t.id}.json`);
    values[t.id] = Number(j.elements[0].tags.total);
    console.log(t.id, values[t.id]);
  }
  writeMetric("data/metrics/venues.json", {
    id: "venues", label: "Arts & culture venues nearby", category: "culture", unit: "venues within 15 km", higherIsBetter: true,
    description: "Count of theatres, music venues, arts centres, galleries and museums mapped in OpenStreetMap within 15 km of the town center (reflects OSM mapping completeness).",
    source: "OpenStreetMap via Overpass API", sourceUrl: "https://overpass-api.de/api/interpreter", year: new Date().getFullYear(), values,
  });
};
main();
