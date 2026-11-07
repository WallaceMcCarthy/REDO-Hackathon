import * as maplibregl from 'maplibre-gl';
import type { Point } from 'geojson';
import { useEffect } from 'react';

export type PoiKind = 'restaurant' | 'trail' | 'ski' | 'school';
type PoiPoint = [kind: PoiKind, name: string, lat: number, lng: number];
type PoiFile = { version: 1; sources: Record<PoiKind, string>; points: PoiPoint[] };

const SOURCE_ID = 'nearby-pois';
const KINDS: PoiKind[] = ['restaurant', 'trail', 'ski', 'school'];
const SHAPES: Record<PoiKind, string> = { restaurant: '◆', trail: '▲', ski: '✦', school: '■' };
const COLORS: Record<PoiKind, string> = { restaurant: '#be4b32', trail: '#28786f', ski: '#3b62a3', school: '#76509b' };
const layerId = (kind: PoiKind) => `nearby-pois-${kind}`;

type Props = { map: maplibregl.Map | null; enabled: ReadonlySet<PoiKind> };

/** Adds one shared GeoJSON source and four cheap symbol layers. The map owns rendering, so React does not create a DOM marker per POI. */
export default function PoiLayer({ map, enabled }: Props) {
  useEffect(() => {
    if (!map) return;
    let cancelled = false;
    let popup: maplibregl.Popup | null = null;

    const onMove = (event: maplibregl.MapMouseEvent) => {
      const visible = KINDS.filter(kind => map.getLayer(layerId(kind))).map(layerId);
      const feature = visible.length ? map.queryRenderedFeatures(event.point, { layers: visible })[0] : undefined;
      map.getCanvas().style.cursor = feature ? 'pointer' : '';
      if (!feature) { popup?.remove(); popup = null; return; }
      const name = String(feature.properties?.name ?? 'Nearby place');
      const coordinates = (feature.geometry as Point).coordinates as [number, number];
      if (!popup) popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 12 });
      popup.setLngLat(coordinates).setText(name).addTo(map);
    };

    fetch('/data/poi-points.json')
      .then(response => {
        if (!response.ok) throw new Error(`POI data returned ${response.status}`);
        return response.json() as Promise<PoiFile>;
      })
      .then(file => {
        if (cancelled || map.getSource(SOURCE_ID)) return;
        map.addSource(SOURCE_ID, {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: file.points.map(([kind, name, lat, lng], id) => ({
              type: 'Feature', id, geometry: { type: 'Point', coordinates: [lng, lat] }, properties: { kind, name },
            })),
          },
        });
        for (const kind of KINDS) {
          map.addLayer({
            id: layerId(kind), type: 'symbol', source: SOURCE_ID, minzoom: kind === 'ski' ? 7 : 10,
            filter: ['==', ['get', 'kind'], kind],
            layout: {
              visibility: enabled.has(kind) ? 'visible' : 'none',
              'text-field': SHAPES[kind], 'text-font': ['Noto Sans Bold'],
              'text-size': ['interpolate', ['linear'], ['zoom'], 10, 15, 14, 21],
              'text-allow-overlap': false, 'text-padding': 3,
            },
            paint: { 'text-color': COLORS[kind], 'text-halo-color': '#ffffff', 'text-halo-width': 1.5 },
          });
        }
        map.on('mousemove', onMove);
      })
      .catch(error => console.warn('Nearby places unavailable', error));

    return () => {
      cancelled = true;
      map.off('mousemove', onMove);
      popup?.remove();
      for (const kind of KINDS) if (map.getLayer(layerId(kind))) map.removeLayer(layerId(kind));
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
    };
  // The source is installed once per map. Visibility changes are handled below without refetching.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  useEffect(() => {
    if (!map) return;
    for (const kind of KINDS) {
      if (map.getLayer(layerId(kind))) map.setLayoutProperty(layerId(kind), 'visibility', enabled.has(kind) ? 'visible' : 'none');
    }
  }, [map, enabled]);

  return null;
}
