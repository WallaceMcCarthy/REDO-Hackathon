"""Extract Utah from official TIGER/Line states; requires pyshp and pyproj.

python utah_state_boundary.py /path/to/tl_2024_us_state.zip
"""
import json
import pathlib
import sys
import zipfile
import shapefile
from pyproj import Transformer

archive = zipfile.ZipFile(sys.argv[1])
stem = 'tl_2024_us_state'
reader = shapefile.Reader(**{ext: archive.open(f'{stem}.{ext}') for ext in ('shp', 'shx', 'dbf')})
transform = Transformer.from_crs(4269, 4326, always_xy=True)

def coordinates(value):
    if isinstance(value[0], (int, float)):
        return [round(n, 7) for n in transform.transform(*value)]
    return [coordinates(part) for part in value]

for row in reader.iterShapeRecords():
    if row.record.as_dict()['STUSPS'] != 'UT':
        continue
    geom = row.shape.__geo_interface__
    result = {
        'source': 'U.S. Census Bureau TIGER/Line 2024 state boundary, Utah FIPS 49',
        'sourceUrl': 'https://www2.census.gov/geo/tiger/TIGER2024/STATE/tl_2024_us_state.zip',
        'crs': 'EPSG:4326',
        'method': 'Full TIGER geometry, NAD83 to WGS84 via pyproj; seven decimal coordinates, no simplification.',
        'geometry': {'type': geom['type'], 'coordinates': coordinates(geom['coordinates'])},
    }
    target = pathlib.Path(__file__).resolve().parents[2] / 'data/utah-state-boundary.json'
    target.write_text(json.dumps(result, separators=(',', ':')) + '\n')
    print(f'Wrote {target.name}: {target.stat().st_size} bytes')
    break
else:
    raise RuntimeError('Utah not found in source archive')
