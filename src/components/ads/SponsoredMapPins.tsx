import * as maplibregl from 'maplibre-gl';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { nearestTown } from '../../../convex/lib/adLocation';
import type { CampaignRecord } from '../../data/adsHooks';
import type { City } from '../../types';
import { useActivePins, useRecordClick, useRecordImpression } from '../../data/adsHooks';
import { FOCUS } from '../homes/ui';
import { REDO_IT, adLink, declutter, listingAction } from './placement';

// A collapsed marker is a 32px circle; two never overlap and phone targets stay apart.
const PIN_SIZE = 32;
const PIN_WIDTH = 40;
const PIN_HEIGHT = 40;
// Room the open card needs above the point, so it is not clipped by the top of the map.
const CARD_ROOM = 150;
// Matches w-60 on the card.
const CARD_WIDTH = 240;
// Half the circle, so the circle sits over the point.
const CIRCLE_CENTER = PIN_SIZE / 2;
// Where the map starts naming towns, so it reads as looking at one.
// Ads and town lookups wait for this zoom, so the statewide map stays about homes.
const TOWN_ZOOM = 9;

// REDO is not a campaign row, so it counts no impressions or clicks.
const REDO_PIN = { _id: 'redo-it', kind: 'job', title: REDO_IT.title, body: REDO_IT.body, url: REDO_IT.url, lat: REDO_IT.lat, lng: REDO_IT.lng } as CampaignRecord;

type Located = CampaignRecord & { lat: number; lng: number };
const isShowable = (c: CampaignRecord): c is Located => c.lat !== undefined && c.lng !== undefined && !!adLink(c);

/** A small accent marker; hover, focus or tap opens a card above it. The whole ad is one link. `flip` aligns the card to the marker's right edge; `below` puts it under the marker when there is no room above. */
export function MapAd({ pin, flip, below, onClick }: { pin: CampaignRecord; flip?: boolean; below?: boolean; onClick?: () => void }) {
  // The one main advertiser stands out on the map: bigger than a sample pin, and a mark instead of a star.
  // Scaled from the bottom so it grows in place rather than drifting off the marker's anchored point.
  const redo = pin.url === REDO_IT.url;
  return (
    <a
      {...adLink(pin)} draggable={false} onClick={onClick}
      aria-label={`Sponsored: ${pin.title}`}
      className={`group relative block size-8 rounded-pill ${FOCUS}`}
    >
      <span aria-hidden className={`flex size-8 origin-bottom items-center justify-center rounded-pill border-2 border-white text-[13px] font-bold leading-none text-white shadow-raised ${redo ? 'scale-150 bg-black' : 'bg-rock-800'}`}>{redo ? 'R' : '★'}</span>
      <span className={`pointer-events-none invisible absolute z-10 w-60 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:visible group-hover:opacity-100 group-focus-visible:visible group-focus-visible:opacity-100 ${below ? 'top-full pt-2' : 'bottom-full pb-2'} ${flip ? 'right-0' : 'left-0'}`}>
        <span className="flex flex-col gap-1 rounded-card bg-surface-raised p-3 text-left shadow-raised">
          <span className="flex items-center gap-1 text-[10px] font-medium uppercase leading-4 tracking-wide text-text-muted">
            <span>{pin.kind === 'job' ? 'Sponsored job' : 'Sponsored'}</span>
            {pin.isSample && <span>· Sample</span>}
          </span>
          <span className="break-words text-small font-semibold leading-snug text-text">{pin.title}</span>
          {pin.body && pin.body !== pin.title && <span className="line-clamp-2 break-words text-caption leading-snug text-text-muted">{pin.body}</span>}
          {(pin.listingId || pin.url) && <span className="text-caption font-semibold text-text underline">{pin.listingId ? listingAction(pin.listingId) : 'Learn more'}</span>}
        </span>
      </span>
      {!pin.listingId && <span className="sr-only">(opens in a new tab)</span>}
    </a>
  );
}

type Props = { map: maplibregl.Map; cities: City[]; selectedTown?: string | null };

/**
 * Sponsored pins as DOM markers, so they never join listing clusters and stay reachable by keyboard.
 * The public query is capped, so it asks for the town in view, then the selected town; statewide shows the newest few.
 */
export default function SponsoredMapPins({ map, cities, selectedTown }: Props) {
  const [nearbyTown, setNearbyTown] = useState<string>();
  const fetched = useActivePins(nearbyTown ?? selectedTown ?? undefined);
  // Keep the last pins while another town loads, so markers do not blink out.
  const lastPins = useRef<CampaignRecord[]>([]);
  if (fetched) lastPins.current = fetched;
  const pins = fetched ?? lastPins.current;
  const recordImpression = useRecordImpression();
  const recordClick = useRecordClick();
  const [shown, setShown] = useState<{ pin: Located; flip: boolean; below: boolean }[]>([]);
  const markers = useRef(new Map<string, maplibregl.Marker>());
  const seen = useRef(new Set<string>());

  useEffect(() => {
    const follow = () => {
      const { lat, lng } = map.getCenter();
      setNearbyTown(map.getZoom() >= TOWN_ZOOM ? nearestTown(cities, lat, lng)?.id : undefined);
    };
    follow();
    map.on('moveend', follow);
    return () => { map.off('moveend', follow); };
  }, [map, cities]);

  // Every impression patches a campaign, so `pins` changes often: diff the markers rather than rebuild them.
  useEffect(() => {
    // REDO is a normal sponsored pin; its fixed entry replaces any sample campaign for the same url.
    const located = [...pins.filter(p => p.url !== REDO_IT.url), REDO_PIN].filter(isShowable);
    const sync = () => {
      const bounds = map.getBounds();
      const inView = declutter(map.getZoom() >= TOWN_ZOOM ? located : [], p => map.project([p.lng, p.lat]), PIN_WIDTH, PIN_HEIGHT)
        // The marker always shows inside the viewport; only its card flips when there is no room above.
        .filter(p => bounds.contains([p.lng, p.lat]));
      const ids = new Set(inView.map(p => p._id));
      for (const [id, marker] of markers.current) {
        if (ids.has(id)) continue;
        marker.remove();
        markers.current.delete(id);
      }
      for (const pin of inView) {
        if (!markers.current.has(pin._id)) {
          // Anchored above the point so the ad does not sit on the organic cluster at the same spot.
          const marker = new maplibregl.Marker({ element: document.createElement('div'), anchor: 'bottom-left', offset: [-CIRCLE_CENTER, 0] });
          markers.current.set(pin._id, marker.setLngLat([pin.lng, pin.lat]).addTo(map));
        }
        if (!seen.current.has(pin._id)) {
          seen.current.add(pin._id);
          if (pin._id !== REDO_PIN._id) void recordImpression(pin._id);
        }
      }
      const mapWidth = map.getContainer().clientWidth;
      const next = inView.map(pin => {
        const { x, y } = map.project([pin.lng, pin.lat]);
        const flip = x + CARD_WIDTH - CIRCLE_CENTER > mapWidth && x + CIRCLE_CENTER - CARD_WIDTH >= 0;
        return { pin, flip, below: y < CARD_ROOM };
      });
      // Convex can return a fresh campaign array after an impression update. Do not publish an
      // equivalent marker layout: that render would retrigger this effect and form an update loop.
      setShown(previous => previous.length === next.length && previous.every((item, index) =>
        item.pin._id === next[index].pin._id && item.flip === next[index].flip && item.below === next[index].below
      ) ? previous : next);
    };
    sync();
    map.on('moveend', sync);
    return () => { map.off('moveend', sync); };
  }, [map, pins, recordImpression]);

  useEffect(() => () => {
    for (const marker of markers.current.values()) marker.remove();
    markers.current.clear();
  }, [map]);

  return shown.map(({ pin, flip, below }) => {
    const element = markers.current.get(pin._id)?.getElement();
    return element ? createPortal(<MapAd pin={pin} flip={flip} below={below} onClick={() => { if (pin._id !== REDO_PIN._id) void recordClick(pin._id); }} />, element, pin._id) : null;
  });
}
