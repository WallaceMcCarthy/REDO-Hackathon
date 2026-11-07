import * as maplibregl from 'maplibre-gl';
// Bundle MapLibre's module worker as one file so production builds can load it, as ResultsMap does.
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef, useState } from 'react';
import { isInUtah, nearestTown } from '../../../convex/lib/adLocation';
import type { City } from '../../types';
import { Field, Select } from '../ui';

maplibregl.setWorkerUrl(maplibreWorkerUrl);

const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';
const UTAH_VIEW: [[number, number], [number, number]] = [[-114, 37], [-109, 42]];
const TOWN_ZOOM = 10;

export type AdLocation = { lat: number; lng: number };

type Props = { cities: City[]; value: AdLocation | null; onChange: (location: AdLocation) => void };

/** Click or tap the map to set the pin. The town select does the same for keyboards, and is all that shows without WebGL. */
export default function AdLocationPicker({ cities, value, onChange }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const change = useRef(onChange);
  change.current = onChange;
  const [outside, setOutside] = useState(false);
  const [noMap, setNoMap] = useState(false);

  useEffect(() => {
    if (!container.current) return;
    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: container.current,
        style: STYLE_URL,
        bounds: UTAH_VIEW,
        // The attribution bar fills the bottom of so small a map, and southern Utah has to stay tappable.
        fitBoundsOptions: { padding: { top: 10, right: 10, left: 10, bottom: 48 } },
        minZoom: 5,
        // One finger scrolls the page past the map on a phone; a tap still sets the pin.
        cooperativeGestures: true,
        attributionControl: { compact: true },
      });
    } catch {
      setNoMap(true);
      return;
    }
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false, visualizePitch: false }), 'top-left');
    map.on('click', ({ lngLat: { lat, lng } }) => {
      const inside = isInUtah(lat, lng);
      setOutside(!inside);
      if (inside) change.current({ lat, lng });
    });
    return () => {
      markerRef.current = null;
      mapRef.current = null;
      map.remove();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!value) {
      markerRef.current?.remove();
      markerRef.current = null;
    } else if (markerRef.current) {
      markerRef.current.setLngLat(value);
    } else {
      markerRef.current = new maplibregl.Marker({ color: '#c4623a' }).setLngLat(value).addTo(map);
    }
  }, [value]);

  const chooseTown = (id: string) => {
    const town = cities.find(c => c.id === id);
    if (!town) return;
    setOutside(false);
    onChange({ lat: town.lat, lng: town.lng });
    mapRef.current?.flyTo({ center: [town.lng, town.lat], zoom: TOWN_ZOOM });
  };

  return (
    <div>
      <p className="mb-1.5 text-small font-semibold text-text">Location</p>
      {!noMap && (
        <>
          <div ref={container} role="region" aria-label="Map for placing your ad" className="h-56 w-full overflow-hidden rounded-control bg-alpine-50" />
          <p role="status" className={`mt-1.5 text-caption ${outside ? 'font-semibold text-danger' : 'text-text-muted'}`}>
            {outside ? 'Choose a spot inside Utah.' : 'Click or tap the map to set your pin.'}
          </p>
        </>
      )}
      <Field label={noMap ? 'Town' : 'Or choose a town'} className="mt-2">
        <Select required value={value ? nearestTown(cities, value.lat, value.lng)?.id ?? '' : ''} onChange={e => chooseTown(e.target.value)}>
          <option value="" disabled>Choose a town</option>
          {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
      </Field>
    </div>
  );
}
