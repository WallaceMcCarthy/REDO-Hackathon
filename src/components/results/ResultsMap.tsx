import L from 'leaflet';
import { useEffect, useRef } from 'react';
import { MapContainer, Marker, TileLayer, Tooltip } from 'react-leaflet';
import type { Row } from './types';

const UTAH_BOUNDS: L.LatLngBoundsExpression = [[37, -114], [42, -109]];

// Cached per rank so hover never replaces a marker's DOM; highlight is the `active` class on the icon root, styled via group-[.active].
const icons = new Map<number, L.DivIcon>();
function pinIcon(rank: number) {
  let icon = icons.get(rank);
  if (!icon) {
    const top = rank <= 3;
    const size = top ? 40 : 30;
    icon = L.divIcon({
      className: 'group',
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      html: `<div class="flex size-full items-center justify-center rounded-full border-2 border-sand font-bold shadow-md transition-transform duration-200 group-[.active]:scale-125 group-[.active]:border-ink ${
        top ? 'bg-rock-500 text-base text-white' : 'bg-alpine-700 text-xs text-white'
      }">${rank}</div>`,
    });
    icons.set(rank, icon);
  }
  return icon;
}

type Props = { rows: Row[]; hovered: string | null; onHover: (id: string | null) => void; onOpen: (id: string) => void };

export default function ResultsMap({ rows, hovered, onHover, onOpen }: Props) {
  const markers = useRef(new Map<string, L.Marker>());

  useEffect(() => {
    // react-leaflet does not refresh a marker's title when it changes, so keep the accessible name in step with the rank.
    rows.forEach(({ city, rank }) => {
      const el = markers.current.get(city.id)?.getElement();
      el?.classList.toggle('active', city.id === hovered);
      el?.setAttribute('title', `${rank}. ${city.name}`);
    });
  });

  return (
    <MapContainer bounds={UTAH_BOUNDS} boundsOptions={{ padding: [10, 10] }} minZoom={5} className="size-full bg-alpine-50" scrollWheelZoom>
      <TileLayer
        className="saturate-50"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {rows.map(({ city, rank }) => (
        <Marker
          key={city.id}
          ref={m => { if (m) markers.current.set(city.id, m); else markers.current.delete(city.id); }}
          position={[city.lat, city.lng]}
          icon={pinIcon(rank)}
          title={`${rank}. ${city.name}`}
          zIndexOffset={city.id === hovered ? 1000 : 100 - rank}
          eventHandlers={{ mouseover: () => onHover(city.id), mouseout: () => onHover(null), click: () => onOpen(city.id) }}
        >
          <Tooltip direction="top" offset={[0, -14]}>{city.name}</Tooltip>
        </Marker>
      ))}
    </MapContainer>
  );
}
