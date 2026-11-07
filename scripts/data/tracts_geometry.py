"""Convert official Census tract shapefiles to GeoJSON. Requires pyshp, pyproj.

Example setup: python3 -m venv /tmp/tracts-env && /tmp/tracts-env/bin/pip install pyshp pyproj
Then TRACTS_PYTHON=/tmp/tracts-env/bin/python npx tsx scripts/data/tracts.ts
"""
import io
import json
import sys
import zipfile

import shapefile
from pyproj import CRS, Transformer


def orient(ring, outer):
    area = sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(ring, ring[1:]))
    return ring if (area > 0) == outer else list(reversed(ring))


def main(archive, output):
    with zipfile.ZipFile(archive) as data:
        stem = next(name[:-4] for name in data.namelist() if name.endswith(".shp"))
        source_crs = CRS.from_wkt(data.read(stem + ".prj").decode())
        transform = Transformer.from_crs(source_crs, "EPSG:4326", always_xy=True)
        reader = shapefile.Reader(shp=io.BytesIO(data.read(stem + ".shp")), dbf=io.BytesIO(data.read(stem + ".dbf")), shx=io.BytesIO(data.read(stem + ".shx")))
        features = []
        for row in reader.iterShapeRecords():
            attributes = row.record.as_dict()
            geometry = row.shape.__geo_interface__
            if geometry["type"] not in ("Polygon", "MultiPolygon"):
                raise ValueError("Unexpected tract geometry")
            polygons = [geometry["coordinates"]] if geometry["type"] == "Polygon" else geometry["coordinates"]
            converted = []
            for polygon in polygons:
                rings = []
                for index, ring in enumerate(polygon):
                    coordinates = [[round(n, 5) for n in transform.transform(x, y)] for x, y in ring]
                    if coordinates[0] != coordinates[-1]:
                        raise ValueError("Unclosed tract ring")
                    rings.append(orient(coordinates, index == 0))
                converted.append(rings)
            coordinates = converted[0] if geometry["type"] == "Polygon" else converted
            features.append({"type": "Feature", "properties": {"GEOID": attributes["GEOID"], "NAMELSAD": attributes["NAMELSAD"]}, "geometry": {"type": geometry["type"], "coordinates": coordinates}})
    with open(output, "w") as result:
        json.dump({"type": "FeatureCollection", "features": features}, result, separators=(",", ":"))
    print(f"Converted {len(features)} official tract polygons to WGS84")


if __name__ == "__main__":
    main(*sys.argv[1:])
