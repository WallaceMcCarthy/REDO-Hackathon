/** Run from repo root: npx tsx scripts/data/restaurants.ts [--refresh] */
import { writeMethodology } from "./lib.ts";
import { countNearby, loadCulture, SOURCE_URL, writeCultureMetric } from "./culture.ts";

async function main() {
  const { towns, osm } = await loadCulture();
  const values: Record<string, number> = {};
  for (const town of towns) {
    const count = countNearby(town, osm.elements, 5, (tags) => tags.amenity === "restaurant" || tags.amenity === "cafe");
    values[town.id] = Math.round(count / town.population * 100_000) / 100;
    console.log(`${town.id}: ${count} mapped restaurants/cafes within 5 km; ${values[town.id]} per 1k town residents`);
  }
  writeMethodology("restaurants_per_1k", `OSM restaurant/cafe features within a 5 km straight-line radius of the town center, divided by the full town population from data/cities.json. This is nearby access per resident, not an administrative-boundary business density. Neighboring towns can share venues. Mapping completeness varies; ways/relations use bounding-box centers. OSM snapshot ${osm.osm3s.timestamp_osm_base}.`);
  await writeCultureMetric("restaurants_per_1k", {
    id: "restaurants_per_1k", label: "Restaurants & cafes nearby", category: "culture", unit: "within 5 km per 1,000 town residents", higherIsBetter: true,
    description: "Mapped restaurants and cafes within 5 km of the town center, per 1,000 residents of the town. It measures nearby access, so neighboring towns can share restaurants. OpenStreetMap coverage varies from place to place.",
    source: "OpenStreetMap contributors via Overpass; canonical town population from ACS", sourceUrl: SOURCE_URL,
    year: Number(osm.osm3s.timestamp_osm_base.slice(0, 4)), values,
  });
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
