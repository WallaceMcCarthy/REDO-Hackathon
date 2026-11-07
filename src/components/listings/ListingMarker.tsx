import L from 'leaflet';
import React, { memo, useMemo } from 'react';
import { Marker, Popup } from 'react-leaflet';
import type { Listing } from '../../../convex/lib/listings';
import ListingCard from './ListingCard';

interface ListingMarkerProps {
  listing: Listing;
  isSelected?: boolean;
  onSelect?: (listing: Listing) => void;
  cityName?: string;
}

const listingIconCache = new Map<string, L.DivIcon>();

function getListingIcon(kind: 'home' | 'apartment', isSelected: boolean): L.DivIcon {
  const key = `${kind}-${isSelected ? 'selected' : 'normal'}`;
  let icon = listingIconCache.get(key);
  if (!icon) {
    const isApt = kind === 'apartment';
    const bgClass = isSelected
      ? isApt
        ? 'bg-sky-700 ring-4 ring-sky-300'
        : 'bg-emerald-700 ring-4 ring-emerald-300'
      : isApt
      ? 'bg-sky-600 hover:bg-sky-700'
      : 'bg-emerald-600 hover:bg-emerald-700';

    const label = isApt ? '🏢' : '🏠';

    icon = L.divIcon({
      className: 'listing-pin-container',
      iconSize: [28, 28],
      iconAnchor: [14, 14],
      popupAnchor: [0, -14],
      html: `
        <div class="flex size-7 items-center justify-center rounded-full border-2 border-white shadow-md text-xs cursor-pointer transition-transform duration-150 ${bgClass} ${
          isSelected ? 'scale-125' : 'hover:scale-110'
        }">
          <span>${label}</span>
        </div>
      `,
    });
    listingIconCache.set(key, icon);
  }
  return icon;
}

export const ListingMarker = memo(function ListingMarker({
  listing,
  isSelected = false,
  onSelect,
  cityName,
}: ListingMarkerProps) {
  const icon = useMemo(
    () => getListingIcon(listing.kind, isSelected),
    [listing.kind, isSelected]
  );

  const position: L.LatLngTuple = useMemo(
    () => [listing.lat, listing.lng],
    [listing.lat, listing.lng]
  );

  const handlers = useMemo(
    () => ({
      click: () => onSelect?.(listing),
    }),
    [listing, onSelect]
  );

  return (
    <Marker
      position={position}
      icon={icon}
      zIndexOffset={isSelected ? 1200 : 200}
      eventHandlers={handlers}
    >
      <Popup className="listing-marker-popup" maxWidth={340} minWidth={280}>
        <div className="p-1">
          <ListingCard
            item={listing}
            cityName={cityName}
            className="border-none p-2 shadow-none"
          />
        </div>
      </Popup>
    </Marker>
  );
});

export default ListingMarker;
