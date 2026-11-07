import L from 'leaflet';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, Marker, TileLayer, Tooltip, useMapEvents } from 'react-leaflet';
import type { City, Metric } from '../../types';
import HeatmapLayer from './HeatmapLayer';
import LayerPicker from './LayerPicker';
import ListingMarker from '../listings/ListingMarker';
import SponsoredPin from '../ads/SponsoredPin';
import { useActivePins } from '../../data/adsHooks';
import type { Listing } from '../listings/types';
import type { Row } from './types';

const UTAH_BOUNDS: L.LatLngBoundsExpression = [[37, -114], [42, -109]];
// Most towns sit on the Wasatch Front, so numbering all 42 pins buries the top results. The rest are dots with a touch-sized target.
const NUMBERED_PINS = 10;

// Cached per rank so hover never replaces a marker's DOM; highlight is the `active` class on the icon root, styled via group-[.active].
const icons = new Map<number, L.DivIcon>();
function pinIcon(rank: number) {
  let icon = icons.get(rank);
  if (!icon) {
    const top = rank <= 3;
    const numbered = rank <= NUMBERED_PINS;
    const size = top ? 40 : numbered ? 30 : 24;
    icon = L.divIcon({
      className: 'group',
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      html: numbered
        ? `<div class="flex size-full items-center justify-center rounded-full border-2 border-sand font-bold transition-transform duration-200 group-[.active]:scale-125 group-[.active]:border-ink ${
          top ? 'bg-rock-500 text-base text-white' : 'bg-alpine-700 text-xs text-white'
        }">${rank}</div>`
        : '<div class="flex size-full items-center justify-center"><div class="size-3 rounded-full border border-sand bg-alpine-500 transition-transform duration-200 group-[.active]:scale-150 group-[.active]:border-ink"></div></div>',
    });
    icons.set(rank, icon);
  }
  return icon;
}

type Props = { rows: Row[]; cities: City[]; metrics: Metric[]; hovered: string | null; onHover: (id: string | null) => void; onOpen: (id: string) => void; listings?: Listing[]; onSelectListing?: (l: Listing) => void };

/** Tracks whether a zoom is in flight so pins sliding under a still cursor do not fire hover. */
function ZoomGate({ zooming }: { zooming: { current: boolean } }) {
  const map = useMapEvents({
    zoomstart: () => { zooming.current = true; },
    zoomend: () => { zooming.current = false; },
  });
  // The opening fit stays fractional so Utah fills the frame. After that a pinch moves whole levels: at 0.25 steps the same pinch took 6x longer.
  useEffect(() => { map.options.zoomSnap = 1; }, [map]);
  return null;
}

type PinProps = {
  id: string; name: string; lat: number; lng: number; rank: number; active: boolean;
  zooming: { current: boolean }; onHover: (id: string | null) => void; onOpen: (id: string) => void;
};

const Pin = memo(function Pin({ id, name, lat, lng, rank, active, zooming, onHover, onOpen }: PinProps) {
  const marker = useRef<L.Marker | null>(null);
  const title = `${rank}. ${name}`;

  useEffect(() => {
    // react-leaflet does not refresh a marker's title when it changes, so keep the accessible name in step with the rank.
    marker.current?.getElement()?.setAttribute('title', title);
  }, [title]);

  useEffect(() => {
    marker.current?.getElement()?.classList.toggle('active', active);
  }, [active]);

  const handlers = useMemo(() => ({
    mouseover: () => { if (!zooming.current) onHover(id); },
    mouseout: () => { if (!zooming.current) onHover(null); },
    click: () => onOpen(id),
  }), [id, zooming, onHover, onOpen]);

  const position = useMemo<L.LatLngTuple>(() => [lat, lng], [lat, lng]);

  return (
    <Marker ref={marker} position={position} icon={pinIcon(rank)} title={title} zIndexOffset={active ? 1000 : 100 - rank} eventHandlers={handlers}>
      <Tooltip direction="top" offset={TOOLTIP_OFFSET}>{name}</Tooltip>
    </Marker>
  );
});

const TOOLTIP_OFFSET: L.PointTuple = [0, -14];
const BOUNDS_OPTIONS = { padding: [10, 10] } as L.FitBoundsOptions;

export default memo(function ResultsMap({ rows, cities, metrics, hovered, onHover, onOpen, listings, onSelectListing }: Props) {
  const [layerId, setLayerId] = useState('');
  const sponsoredPins = useActivePins();
  const layer = metrics.find(m => m.id === layerId);
  const zooming = useRef(false);
  const open = useCallback((id: string) => onOpen(id), [onOpen]);

  return (
    <div className="relative size-full">
    <MapContainer
      bounds={UTAH_BOUNDS} boundsOptions={BOUNDS_OPTIONS} minZoom={5}
      zoomSnap={0.25} zoomDelta={1}
      className="size-full bg-alpine-50" scrollWheelZoom
    >
      <ZoomGate zooming={zooming} />
      {/* Esri light gray canvas: keyless and fast. CARTO basemaps now require an API key. */}
      <TileLayer
        attribution="Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors"
        url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}"
        maxNativeZoom={16}
      />
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}"
        maxNativeZoom={16}
      />
      {layer && <HeatmapLayer metric={layer} cities={cities} />}
      {rows.map(({ city, rank }) => (
        <Pin
          key={city.id} id={city.id} name={city.name} lat={city.lat} lng={city.lng} rank={rank}
          active={city.id === hovered} zooming={zooming} onHover={onHover} onOpen={open}
        />
      ))}
      {listings?.map((listing) => (
        <ListingMarker
          key={listing.id}
          listing={listing}
          onSelect={onSelectListing}
        />
      ))}
      {sponsoredPins?.map((pin) => (
        <SponsoredPin key={pin._id} campaign={pin} />
      ))}
    </MapContainer>
    <LayerPicker metrics={metrics} selected={layer} onSelect={setLayerId} />
    </div>
  );
});
