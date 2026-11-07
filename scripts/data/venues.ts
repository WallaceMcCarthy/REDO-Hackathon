/** Run after restaurants.ts to reuse its cached regional response. */
import { writeMethodology } from "./lib.ts";
import { countNearby, loadCulture, SOURCE_URL, writeCultureMetric } from "./culture.ts";

async function main() {
  const { towns, osm } = await loadCulture();
  const values: Record<string, number> = {};
  const amenities = new Set(["theatre", "arts_centre", "music_venue"]);
  for (const town of towns) {
    values[town.id] = countNearby(town, osm.elements, 15, (tags) => amenities.has(tags.amenity) || tags.tourism === "gallery" || tags.tourism === "museum");
    console.log(`${town.id}: ${values[town.id]} mapped venues within 15 km`);
  }
  writeMethodology("venues", `OSM theatres, music venues, arts centres, galleries and museums within a 15 km straight-line radius of the canonical town center. Neighboring towns can share venues. Mapping completeness varies; ways/relations use bounding-box centers. OSM snapshot ${osm.osm3s.timestamp_osm_base}.`);
  await writeCultureMetric("venues", {
    id: "venues", label: "Arts & culture venues nearby", category: "culture", unit: "mapped venues within 15 km", higherIsBetter: true,
    description: "Mapped theatres, music venues, arts centres, galleries and museums within 15 km of the town center. Neighboring towns can share venues. OpenStreetMap coverage varies from place to place.",
    source: "OpenStreetMap contributors via Overpass", sourceUrl: SOURCE_URL,
    year: Number(osm.osm3s.timestamp_osm_base.slice(0, 4)), values,
  });
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
