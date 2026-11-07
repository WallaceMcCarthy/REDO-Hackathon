/** Official UGRC municipal outlines for highlighting the selected town on a map. */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const ROOT = new URL("../../", import.meta.url);
const LAYER = "https://services1.arcgis.com/99lidPhWCzftIe9K/ArcGIS/rest/services/UtahMunicipalBoundaries/FeatureServer/0";
type Polygon = [number, number][][];
type Geometry = { type: "Polygon"; coordinates: Polygon } | { type: "MultiPolygon"; coordinates: Polygon[] };
type SourceFeature = { properties: { NAME?: string }; geometry: Geometry | null };

/** Preserve every annex and hole instead of replacing a town with a centroid/buffer. */
export function municipalFeatures(cities: { id: string; name: string }[], source: SourceFeature[]) {
  return cities.map(city => {
    const parts: Polygon[] = [];
    for (const feature of source) {
      if (feature.properties.NAME?.trim().toLowerCase() !== city.name.trim().toLowerCase() || !feature.geometry) continue;
      if (feature.geometry.type === "Polygon") parts.push(feature.geometry.coordinates);
      else if (feature.geometry.type === "MultiPolygon") parts.push(...feature.geometry.coordinates);
    }
    if (!parts.length) throw new Error(`Missing official municipal geometry: ${city.name}`);
    const geometry: Geometry = parts.length === 1 ? { type: "Polygon", coordinates: parts[0] } : { type: "MultiPolygon", coordinates: parts };
    return { type: "Feature" as const, id: city.id, properties: { cityId: city.id, name: city.name }, geometry };
  });
}

async function main() {
  const url = new URL(`${LAYER}/query`);
  url.search = new URLSearchParams({ where: "1=1", outFields: "NAME", outSR: "4326", returnGeometry: "true", geometryPrecision: "5", maxAllowableOffset: "0.0002", resultRecordCount: "2000", f: "geojson" }).toString();
  const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`Municipal retrieval failed ${response.status}`);
  const data = await response.json();
  if (data.error || data.type !== "FeatureCollection" || data.exceededTransferLimit) throw new Error(`Incomplete municipal response: ${JSON.stringify(data.error ?? data.type)}`);
  const cities = JSON.parse(await readFile(new URL("data/cities.json", ROOT), "utf8"));
  const features = municipalFeatures(cities, data.features);
  const output = JSON.stringify({ type: "FeatureCollection", features }) + "\n";
  if (Buffer.byteLength(output) > 2000000) throw new Error("Municipal outlines exceed2MB");
  await mkdir(new URL("data/raw/", ROOT), { recursive: true });
  await mkdir(new URL("public/data/", ROOT), { recursive: true });
  await writeFile(new URL("data/raw/municipal-outlines.geojson", ROOT), JSON.stringify(data));
  await writeFile(new URL("public/data/utah-towns.geojson", ROOT), output);
  const provenance = { retrievedAt: new Date().toISOString(), source: "Utah Geospatial Resource Center municipal boundaries", sourceUrl: LAYER, queryUrl: url.href,
    method: "Official municipal polygons exported as WGS84 GeoJSON, display-generalized by ArcGIS maxAllowableOffset0.0002 degrees and5decimal precision. Preserves annexes and holes. Town center points and distance buffers are not used. Intended for map outlines, not parcel or legal boundary decisions.",
    featureCount: features.length, bytes: Buffer.byteLength(output), cityIds: features.map(feature => feature.id) };
  await writeFile(new URL("data/town-boundaries-provenance.json", ROOT), JSON.stringify(provenance, null, 2) + "\n");
  console.log(JSON.stringify(provenance, null, 2));
}
if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error); process.exitCode = 1; });
