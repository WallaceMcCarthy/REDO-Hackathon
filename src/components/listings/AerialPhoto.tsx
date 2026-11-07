import { useState } from 'react';
import type { Listing } from './types';

/** Esri World Imagery keyless export, centered on the listing. */
export function aerialUrl(l: Pick<Listing, 'lat' | 'lng' | 'kind'>, size: [number, number] = [640, 400]): string {
  const d = l.kind === 'apartment' ? 0.0018 : 0.0009;
  const bbox = [l.lng - d, l.lat - d * 0.75, l.lng + d, l.lat + d * 0.75].map(n => n.toFixed(6)).join(',');
  return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${bbox}&bboxSR=4326&imageSR=3857&size=${size[0]},${size[1]}&format=jpg&f=image`;
}

function HouseIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10v9.5h13V10" /><path d="M10 19.5v-5h4v5" />
    </svg>
  );
}

function MapPinIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 30" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M12 0.75C6.89 0.75 2.75 4.89 2.75 10c0 6.5 8.25 17.5 9.25 18.8a0.5 0.5 0 0 0 .8 0c1-1.3 9.25-12.3 9.25-18.8 0-5.11-4.14-9.25-9.25-9.25Z"
        className="fill-rock-700 stroke-white stroke-[1.5]"
      />
      <circle cx="12" cy="10" r="3.2" className="fill-white" />
    </svg>
  );
}

export default function AerialPhoto({ listing, className = '', rounded = 'rounded-t-xl' }: { listing: Listing; className?: string; rounded?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={`relative aspect-[16/10] w-full overflow-hidden bg-rock-100 ${rounded} ${className}`}>
      {failed ? (
        <div className="flex size-full items-center justify-center bg-rock-100 text-rock-300" role="img" aria-label="Aerial photo unavailable">
          <HouseIcon className="size-12" />
        </div>
      ) : (
        <>
          <img
            src={aerialUrl(listing)} alt={`Aerial view of ${listing.address || listing.name || 'the property'}`}
            loading="lazy" draggable={false} onError={() => setFailed(true)} className="size-full object-cover"
          />
          <span aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full">
            <MapPinIcon className="h-7 w-[22px] drop-shadow-[0_2px_5px_rgba(0,0,0,0.5)]" />
          </span>
          <span className="absolute left-2 top-2 rounded-full bg-black/45 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">Aerial view</span>
          <span className="absolute bottom-1 right-1.5 text-[9px] leading-none text-white/90 [text-shadow:0_1px_2px_rgba(0,0,0,0.8)]">
            Imagery © Esri, Maxar, Earthstar Geographics
          </span>
        </>
      )}
    </div>
  );
}
