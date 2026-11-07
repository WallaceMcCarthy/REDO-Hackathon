import * as maplibregl from 'maplibre-gl';
// Bundle MapLibre's module worker (and the shared chunk it imports) as one file so production builds can load it.
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

maplibregl.setWorkerUrl(maplibreWorkerUrl);
import type { FeatureCollection, Point } from 'geojson';
import 'maplibre-gl/dist/maplibre-gl.css';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import type { City, Metric } from '../../types';
import SponsoredMapPins from '../ads/SponsoredMapPins';
import SafeSectionBoundary from '../SafeSectionBoundary';
import { BOUNDS, UTAH, computeGrid, gridToDataUrl } from './heatmap';
import LayerPicker from './LayerPicker';
import PoiLayer, { type PoiKind } from './PoiLayer';
import PoiToggle from './PoiToggle';
import type { MapPin } from '../../data/mapPoints';
import type { Row } from './types';

declare global {
  interface Window { __utahMap?: maplibregl.Map }
}

const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';
const UTAH_RING: [number, number][] = [...UTAH, UTAH[0]].map(([lat, lng]) => [lng, lat]);
const UTAH_LINE: GeoJSON.Feature<GeoJSON.LineString> = { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: UTAH_RING } };
const UTAH_MASK: GeoJSON.Feature<GeoJSON.Polygon> = {
  type: 'Feature', properties: {},
  geometry: { type: 'Polygon', coordinates: [[[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]], [...UTAH_RING].reverse()] },
};

const UTAH_BOUNDS: [[number, number], [number, number]] = [[-114, 37], [-109, 42]];
// Homes first: listings are the primary layer, towns are small muted dots underneath.
// Tailwind palette (tailwind.config.js).
const ROCK_500 = '#c4623a', ALPINE_700 = '#1d544f', ALPINE_500 = '#2f7f76', SAND = '#f7f1e8', INK = '#231a15';
const HOME_COLOR = '#0d9488', APARTMENT_COLOR = '#7c3aed';
const NUMBERED_PINS = 10;
const PIN_LAYERS = ['towns-circle', 'towns-dots'];
const GROUPED_LAYERS = ['listings-clusters', 'listings-cluster-count', 'listings-circle', 'listings-selected', 'listings-price'];
// Ungrouped: one unclustered source, every listing a plain circle layer (no DOM markers).
const FLAT_LAYERS = ['flat-circle', 'flat-selected', 'flat-price'];
const GROUP_KEY = 'results-map-group-pins';
const readGrouped = () => { try { return localStorage.getItem(GROUP_KEY) === 'on'; } catch { return false; } };
const ALPINE_500_DOT = ALPINE_500;
// Topmost first, so a listing wins over the town dot beneath it.
const HIT_LAYERS = ['listings-clusters', 'listings-circle', 'flat-circle', 'towns-circle', 'towns-dots'];
const TOWN_MUTED = '#6e625a';
export const AREA_MAP_LABEL_LAYOUT = {
  townNamesVisibility: 'none',
  ranksAllowOverlap: false,
  ranksIgnorePlacement: false,
} as const;

function priceLabel(l: MapPin): string {
  if (l.kind === 'home') {
    const v = l.value;
    return v == null ? '' : v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : `$${Math.round(v / 1000)}k`;
  }
  const r = l.rent;
  return r == null ? '' : r >= 1000 ? `$${(r / 1000).toFixed(1)}k/mo` : `$${r}/mo`;
}
const HEAT_OPACITY = 0.65;

type Props = {
  rows: Row[]; cities: City[]; metrics: Metric[]; hovered: string | null;
  onHover: (id: string | null) => void; onOpen: (id: string) => void;
  listings?: MapPin[]; onSelectListing?: (l: MapPin) => void; selectedListingId?: string;
  /** Which pins are primary. 'listings' (default): homes with prices and clusters, towns as muted dots. 'towns': numbered town pins, listings hidden. */
  focus?: 'listings' | 'towns';
  /** The town the list is narrowed to, so sponsored pins can follow it. */
  selectedTown?: string | null;
};

/** Switch paint, filters and visibility between the two modes. The map and its sources are never recreated. */
function applyFocus(map: maplibregl.Map, focus: 'listings' | 'towns', grouped: boolean) {
  const towns = focus === 'towns';
  for (const id of GROUPED_LAYERS) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', !towns && grouped ? 'visible' : 'none');
  for (const id of FLAT_LAYERS) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', !towns && !grouped ? 'visible' : 'none');
  map.setLayoutProperty('towns-circle', 'visibility', towns ? 'visible' : 'none');
  map.setLayoutProperty('towns-rank', 'visibility', towns ? 'visible' : 'none');
  // Towns focus: ranks 1-10 are the numbered circles, the rest are alpine dots. Listings focus: every town is a small muted dot.
  map.setFilter('towns-dots', towns ? ['>', ['get', 'rank'], NUMBERED_PINS] : null);
  map.setPaintProperty('towns-dots', 'circle-color', towns ? ALPINE_500_DOT : TOWN_MUTED);
  map.setPaintProperty('towns-dots', 'circle-opacity', towns ? 1 : 0.8);
  map.setPaintProperty('towns-dots', 'circle-radius', hoverCase(towns ? 9 : 7, towns ? 6 : 4.5));
  // Positron already labels towns. Hiding our copy in Areas mode avoids doubled names when zoomed in.
  map.setLayoutProperty('towns-label', 'visibility', towns ? AREA_MAP_LABEL_LAYOUT.townNamesVisibility : 'visible');
  map.setPaintProperty('towns-label', 'text-color', towns ? INK : TOWN_MUTED);
}

const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] };
const hoverCase = (on: unknown, off: unknown) => ['case', ['boolean', ['feature-state', 'hover'], false], on, off] as maplibregl.ExpressionSpecification;
// MapLibre allows one zoom curve per paint value, and only at the top, so hover scales each stop.
const hoverScale = hoverCase(1.25, 1);
const townPinRadius: maplibregl.ExpressionSpecification = [
  'interpolate', ['linear'], ['zoom'],
  5, ['*', hoverScale, ['case', ['<=', ['get', 'rank'], 3], 4.5, 3.5]],
  8, ['*', hoverScale, ['case', ['<=', ['get', 'rank'], 3], 14, 10]],
  10, ['*', hoverScale, ['get', 'r']],
];

export default memo(function ResultsMap({ rows, cities, metrics, hovered, onHover, onOpen, listings, onSelectListing, selectedListingId, focus = 'listings', selectedTown }: Props) {
  const [layerId, setLayerId] = useState('');
  const [ready, setReady] = useState(false);
  const [pois, setPois] = useState<Set<PoiKind>>(() => new Set<PoiKind>(['restaurant', 'trail', 'ski', 'school']));
  const [grouped, setGrouped] = useState(readGrouped);
  const [threeD, setThreeD] = useState(false);
  const groupedRef = useRef(grouped);
  groupedRef.current = grouped;
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);
  const layer = metrics.find(m => m.id === layerId);

  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const hoveredRef = useRef<string | null>(null);
  const focusRef = useRef(focus);
  focusRef.current = focus;
  const listingsRef = useRef<MapPin[]>([]);
  const viewBeforeListing = useRef<{ center: maplibregl.LngLat; zoom: number } | null>(null);
  const handlers = useRef({ onHover, onOpen, onSelectListing });
  handlers.current = { onHover, onOpen, onSelectListing };

  const townData = useMemo<FeatureCollection>(() => ({
    type: 'FeatureCollection',
    features: rows.map(({ city, rank }) => ({
      type: 'Feature',
      id: city.id,
      geometry: { type: 'Point', coordinates: [city.lng, city.lat] },
      properties: { id: city.id, name: city.name, rank, r: rank <= 3 ? 20 : 15 },
    })),
  }), [rows]);

  const listingData = useMemo<FeatureCollection>(() => {
    listingsRef.current = listings ?? [];
    return {
      type: 'FeatureCollection',
      features: (listings ?? []).map(l => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [l.lng, l.lat] },
        properties: { id: l.id, kind: l.kind, price: priceLabel(l) },
      })),
    };
  }, [listings]);

  // Create the map once.
  useEffect(() => {
    const el = container.current;
    if (!el) return;
    const map = new maplibregl.Map({
      container: el,
      style: STYLE_URL,
      maxPitch: 75,
      bounds: UTAH_BOUNDS,
      fitBoundsOptions: { padding: 10 },
      minZoom: 5,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    if (import.meta.env.DEV || import.meta.env.VITE_EXPOSE_MAP) window.__utahMap = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false, visualizePitch: false }), 'top-left');

    map.on('load', () => {
      map.addSource('dem', { type: 'raster-dem', tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'], encoding: 'terrarium', tileSize: 256, maxzoom: 13 });
      map.addSource('satellite-3d', { type: 'raster', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], tileSize: 256, maxzoom: 19, attribution: 'Esri' });
      map.addLayer({ id: 'satellite-3d', type: 'raster', source: 'satellite-3d', layout: { visibility: 'none' } }, map.getStyle().layers.find(l => l.type === 'symbol')?.id);
      map.addSource('listings', { type: 'geojson', data: EMPTY, promoteId: 'id', cluster: true, clusterRadius: 50, clusterMaxZoom: 13 });
      map.addSource('listings-flat', { type: 'geojson', data: EMPTY, promoteId: 'id', cluster: false });
      map.addSource('towns', { type: 'geojson', data: EMPTY, promoteId: 'id' });
      const kindColor: maplibregl.ExpressionSpecification = ['match', ['get', 'kind'], 'apartment', APARTMENT_COLOR, HOME_COLOR];
      // Utah border and faint outside mask: above the basemap, beneath all data layers.
      map.addSource('utah-border', { type: 'geojson', data: UTAH_LINE });
      map.addSource('utah-mask', { type: 'geojson', data: UTAH_MASK });
      map.addLayer({ id: 'utah-mask', type: 'fill', source: 'utah-mask', paint: { 'fill-color': '#1e293b', 'fill-opacity': 0.08 } });
      map.addLayer({
        id: 'utah-border', type: 'line', source: 'utah-border',
        layout: { 'line-join': 'round' },
        paint: { 'line-color': ['interpolate', ['linear'], ['zoom'], 5, '#334155', 10, '#1e293b'], 'line-opacity': 0.7, 'line-width': 2 },
      });
      // Towns: small muted dots, beneath everything else.
      map.addLayer({
        id: 'towns-dots', type: 'circle', source: 'towns',
        paint: {
          'circle-radius': hoverCase(7, 4.5), 'circle-color': TOWN_MUTED, 'circle-opacity': 0.8,
          'circle-stroke-color': hoverCase(INK, SAND), 'circle-stroke-width': hoverCase(2, 1),
        },
      });
      map.addLayer({
        id: 'towns-circle', type: 'circle', source: 'towns', filter: ['<=', ['get', 'rank'], NUMBERED_PINS],
        layout: { 'circle-sort-key': ['-', 100, ['get', 'rank']], visibility: 'none' },
        paint: {
          // At the Utah-wide zoom the Wasatch Front towns are only pixels apart. Start compact,
          // then grow to the full pin size as geographic separation becomes visible.
          'circle-radius': townPinRadius,
          'circle-color': ['case', ['<=', ['get', 'rank'], 3], ROCK_500, ALPINE_700],
          'circle-stroke-color': hoverCase(INK, SAND), 'circle-stroke-width': hoverCase(3, 2),
        },
      });
      map.addLayer({
        id: 'towns-rank', type: 'symbol', source: 'towns', filter: ['<=', ['get', 'rank'], NUMBERED_PINS],
        layout: {
          'text-field': ['to-string', ['get', 'rank']], 'text-font': ['Noto Sans Bold'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 5, 9, 8, ['case', ['<=', ['get', 'rank'], 3], 16, 12]],
          // Let MapLibre suppress a rank when two pins truly cannot be separated. Forced overlap
          // produced unreadable strings such as "9 1 2" over Salt Lake County.
          'text-allow-overlap': AREA_MAP_LABEL_LAYOUT.ranksAllowOverlap,
          'text-ignore-placement': AREA_MAP_LABEL_LAYOUT.ranksIgnorePlacement,
          'symbol-sort-key': ['-', 100, ['get', 'rank']], visibility: 'none',
        },
        paint: { 'text-color': '#ffffff' },
      });
      map.addLayer({
        id: 'towns-label', type: 'symbol', source: 'towns', minzoom: 9,
        layout: {
          'text-field': ['get', 'name'], 'text-font': ['Noto Sans Bold'], 'text-size': 11,
          'text-offset': [0, 0.9], 'text-anchor': 'top', 'text-optional': true,
        },
        paint: { 'text-color': TOWN_MUTED, 'text-halo-color': '#ffffff', 'text-halo-width': 1.5 },
      });
      // Listings: the primary layer.
      map.addLayer({
        id: 'listings-clusters', type: 'circle', source: 'listings', filter: ['has', 'point_count'],
        paint: {
          'circle-radius': ['step', ['get', 'point_count'], 16, 10, 20, 50, 26],
          'circle-color': ALPINE_700, 'circle-opacity': 0.92,
          'circle-stroke-color': '#ffffff', 'circle-stroke-width': 3,
        },
      });
      map.addLayer({
        id: 'listings-cluster-count', type: 'symbol', source: 'listings', filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'], 'text-font': ['Noto Sans Bold'], 'text-size': 13,
          'text-allow-overlap': true, 'text-ignore-placement': true,
        },
        paint: { 'text-color': '#ffffff' },
      });
      map.addLayer({
        id: 'listings-circle', type: 'circle', source: 'listings', filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 8, 12, 11],
          'circle-color': kindColor, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2.5,
        },
      });
      map.addLayer({
        id: 'listings-selected', type: 'circle', source: 'listings', filter: ['==', ['get', 'id'], ''],
        paint: {
          'circle-radius': 16, 'circle-color': 'rgba(0,0,0,0)',
          'circle-stroke-color': INK, 'circle-stroke-width': 3,
        },
      });
      map.addLayer({
        id: 'listings-price', type: 'symbol', source: 'listings', minzoom: 10, filter: ['all', ['!', ['has', 'point_count']], ['!=', ['get', 'price'], '']],
        layout: {
          'text-field': ['get', 'price'], 'text-font': ['Noto Sans Bold'], 'text-size': 12,
          'text-offset': [0, 1.2], 'text-anchor': 'top', 'text-optional': true,
        },
        paint: { 'text-color': INK, 'text-halo-color': '#ffffff', 'text-halo-width': 2 },
      });
      map.addLayer({
        id: 'flat-circle', type: 'circle', source: 'listings-flat',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 4, 10, 6, 14, 10],
          'circle-color': kindColor, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1.5,
        },
      });
      map.addLayer({
        id: 'flat-selected', type: 'circle', source: 'listings-flat', filter: ['==', ['get', 'id'], ''],
        paint: { 'circle-radius': 14, 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': INK, 'circle-stroke-width': 3 },
      });
      map.addLayer({
        id: 'flat-price', type: 'symbol', source: 'listings-flat', minzoom: 11, filter: ['!=', ['get', 'price'], ''],
        layout: {
          'text-field': ['get', 'price'], 'text-font': ['Noto Sans Bold'], 'text-size': 12,
          'text-offset': [0, 1], 'text-anchor': 'top', 'text-optional': true,
        },
        paint: { 'text-color': INK, 'text-halo-color': '#ffffff', 'text-halo-width': 2 },
      });
      applyFocus(map, focusRef.current, groupedRef.current);
      setReady(true);
    });

    const tip = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 14, className: 'town-tip' });
    let overId: string | null = null;
    const hit = (p: maplibregl.Point) =>
      map.queryRenderedFeatures([[p.x - 8, p.y - 8], [p.x + 8, p.y + 8]], { layers: HIT_LAYERS })[0];

    // A sponsored pin or its popup owns the pointer, not the listing or town underneath.
    const onSponsored = (e: maplibregl.MapMouseEvent) => (e.originalEvent.target as Element).closest('.maplibregl-marker, .maplibregl-popup');

    map.on('mousemove', e => {
      const f = onSponsored(e) ? undefined : hit(e.point);
      map.getCanvas().style.cursor = f ? 'pointer' : '';
      if (f && (f.layer.id === 'listings-circle' || f.layer.id === 'flat-circle')) {
        const l = listingsRef.current.find(x => x.id === f.properties.id);
        const price = f.properties.price as string;
        setTip({ x: e.point.x, y: e.point.y, text: [price, l?.address || l?.name].filter(Boolean).join(' · ') });
      } else setTip(null);
      const id = f && PIN_LAYERS.includes(f.layer.id) ? String(f.properties.id) : null;
      if (id === overId) return;
      overId = id;
      handlers.current.onHover(id);
      if (f && id) tip.setLngLat((f.geometry as Point).coordinates as [number, number]).setText(String(f.properties.name)).addTo(map);
      else tip.remove();
    });
    map.on('mouseout', () => {
      setTip(null);
      if (overId !== null) { overId = null; handlers.current.onHover(null); }
      tip.remove();
    });
    map.on('click', e => {
      if (onSponsored(e)) return;
      const f = hit(e.point);
      if (!f) return;
      if (f.layer.id === 'listings-clusters') {
        const src = map.getSource('listings') as maplibregl.GeoJSONSource;
        Promise.resolve(src.getClusterExpansionZoom(Number(f.properties.cluster_id)))
          .then(zoom => map.easeTo({ center: (f.geometry as Point).coordinates as [number, number], zoom: zoom + 0.5 }))
          .catch(() => undefined);
        return;
      }
      if (PIN_LAYERS.includes(f.layer.id)) { handlers.current.onOpen(String(f.properties.id)); return; }
      const listing = listingsRef.current.find(l => l.id === f.properties.id);
      if (!listing) return;
      handlers.current.onSelectListing?.(listing);
    });

    return () => {
      tip.remove();
      map.remove();
      mapRef.current = null;
      setReady(false);
      if (window.__utahMap === map) delete window.__utahMap;
    };
  }, []);

  // Data updates: only when the memoized GeoJSON actually changes.
  useEffect(() => {
    if (ready) (mapRef.current?.getSource('towns') as maplibregl.GeoJSONSource | undefined)?.setData(townData);
  }, [ready, townData]);
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || (!threeD && !map.getTerrain())) return;
    map.setLayoutProperty('satellite-3d', 'visibility', threeD ? 'visible' : 'none');
    map.setTerrain(threeD ? { source: 'dem', exaggeration: 1.8 } : null);
    // Terrain means little from statewide height, so start in the Wasatch.
    const closeUp = map.getZoom() < 9 ? { center: [-111.68, 40.6] as [number, number], zoom: 11, bearing: 95 } : {};
    map.easeTo(threeD ? { ...closeUp, pitch: 72, duration: 1200 } : { pitch: 0, bearing: 0, duration: 800 });
  }, [ready, threeD]);

  useEffect(() => {
    // Only the active source gets data, so the hidden one never re-clusters or re-indexes.
    if (ready) (mapRef.current?.getSource(grouped ? 'listings' : 'listings-flat') as maplibregl.GeoJSONSource | undefined)?.setData(listingData);
    if (ready) (mapRef.current?.getSource(grouped ? 'listings-flat' : 'listings') as maplibregl.GeoJSONSource | undefined)?.setData(EMPTY);
  }, [ready, listingData, grouped]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    for (const id of ['listings-selected', 'flat-selected']) map.setFilter(id, ['==', ['get', 'id'], selectedListingId ?? '']);
    const l = selectedListingId ? listingsRef.current.find(x => x.id === selectedListingId) : undefined;
    if (l) {
      viewBeforeListing.current ??= { center: map.getCenter(), zoom: map.getZoom() };
      // The phone sheet covers the lower part of the map, so centre the pin in what stays visible.
      const sheet = window.matchMedia('(min-width: 1024px)').matches ? 0 : map.getContainer().clientHeight * 0.55;
      map.easeTo({ center: [l.lng, l.lat], zoom: Math.max(map.getZoom(), 14), padding: { top: 0, left: 0, right: 0, bottom: sheet }, duration: 800 });
    } else if (!selectedListingId && viewBeforeListing.current) {
      map.easeTo({ ...viewBeforeListing.current, padding: { top: 0, left: 0, right: 0, bottom: 0 }, duration: 800 });
      viewBeforeListing.current = null;
    }
  }, [ready, selectedListingId]);

  useEffect(() => {
    const map = mapRef.current;
    if (ready && map) applyFocus(map, focus, grouped);
  }, [ready, focus, grouped]);

  // Hover highlight via feature-state: no layer or source rebuild.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const prev = hoveredRef.current;
    if (prev) map.setFeatureState({ source: 'towns', id: prev }, { hover: false });
    if (hovered) map.setFeatureState({ source: 'towns', id: hovered }, { hover: true });
    hoveredRef.current = hovered;
  }, [ready, hovered]);

  // Heatmap: one image per metric, below the pins.
  const heatUrl = useMemo(() => {
    if (!layer) return '';
    const points = cities.flatMap(c => (layer.values[c.id] === undefined ? [] : [{ lat: c.lat, lng: c.lng, value: layer.values[c.id] }]));
    return gridToDataUrl(computeGrid(points), points.map(p => p.value), layer.higherIsBetter);
  }, [layer, cities]);
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    if (map.getLayer('heat')) map.removeLayer('heat');
    if (map.getSource('heat')) map.removeSource('heat');
    if (!heatUrl) return;
    map.addSource('heat', {
      type: 'image', url: heatUrl,
      coordinates: [[BOUNDS.west, BOUNDS.north], [BOUNDS.east, BOUNDS.north], [BOUNDS.east, BOUNDS.south], [BOUNDS.west, BOUNDS.south]],
    });
    map.addLayer({ id: 'heat', type: 'raster', source: 'heat', paint: { 'raster-opacity': HEAT_OPACITY, 'raster-fade-duration': 0 } }, 'towns-dots');
  }, [ready, heatUrl]);

  return (
    <div className="relative size-full">
      <div ref={container} role="region" aria-label="Map of Utah towns" className="size-full bg-alpine-50" />
      <ul className="sr-only" aria-label="Towns on the map">
        {rows.map(({ city, rank }) => <li key={city.id}>{`${rank}. ${city.name}`}</li>)}
      </ul>
      <button
        type="button" aria-pressed={threeD} onClick={() => setThreeD(on => !on)}
        className={`absolute left-12 top-2.5 z-[1000] min-h-9 cursor-pointer rounded-xl border border-rock-100 px-3 text-sm font-semibold shadow-sm ${threeD ? 'bg-alpine-700 text-white' : 'bg-sand-50 text-rock-800'}`}
      >
        3D
      </button>
      {focus === 'listings' && (
        <label className="absolute right-2 top-2 z-[1000] flex min-h-9 cursor-pointer items-center gap-2 rounded-xl border border-rock-100 bg-sand/95 px-2.5 text-xs font-semibold text-ink shadow-sm">
          <input
            type="checkbox" role="switch" checked={grouped}
            onChange={e => {
              const on = e.target.checked;
              setGrouped(on);
              try { localStorage.setItem(GROUP_KEY, on ? 'on' : 'off'); } catch { /* storage unavailable */ }
            }}
          />
          Group pins
        </label>
      )}
      <LayerPicker metrics={metrics} selected={layer} onSelect={setLayerId} />
      <SafeSectionBoundary>
        <PoiLayer map={ready ? mapRef.current : null} enabled={pois} />
        <PoiToggle enabled={pois} onToggle={kind => setPois(prev => {
          const next = new Set(prev);
          if (!next.delete(kind)) next.add(kind);
          return next;
        })} />
      </SafeSectionBoundary>
      {ready && mapRef.current && <SafeSectionBoundary><SponsoredMapPins map={mapRef.current} cities={cities} selectedTown={selectedTown} /></SafeSectionBoundary>}
      {tip && (
        <div
          role="tooltip"
          style={{ left: tip.x, top: tip.y - 16 }}
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md bg-ink px-2 py-1 text-xs font-semibold text-white shadow-md"
        >
          {tip.text}
        </div>
      )}
    </div>
  );
});
