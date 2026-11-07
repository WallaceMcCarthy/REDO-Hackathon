import * as maplibregl from 'maplibre-gl';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { nearestTown } from '../../../convex/lib/adLocation';
import type { CampaignRecord } from '../../data/adsHooks';
import type { City } from '../../types';
import { useActivePins, useRecordClick, useRecordImpression } from '../../data/adsHooks';
import { FOCUS } from '../homes/ui';
import { Badge } from '../ui';
import AdImage from './AdImage';
import { declutter } from './placement';
import { safeHttpsHref } from './safeHttpsHref';

// One ad's footprint, so two never overlap and phone targets stay apart.
const PIN_WIDTH = 216;
// Matches w-52 on the link.
const AD_WIDTH = 208;
const PIN_HEIGHT = 64;
// Half the circle, so the circle rather than the message sits over the point.
const CIRCLE_CENTER = 26;
// Where the map starts naming towns, so it reads as looking at one.
const TOWN_ZOOM = 9;

type Located = CampaignRecord & { lat: number; lng: number };
const isShowable = (c: CampaignRecord): c is Located => c.lat !== undefined && c.lng !== undefined && !!safeHttpsHref(c.url);

/** The whole ad is one link: image in a circle, the Sponsored label, and the message beside them. `flip` puts the message on the left. */
export function MapAd({ pin, flip, onClick }: { pin: CampaignRecord; flip?: boolean; onClick?: () => void }) {
  return (
    <a
      href={safeHttpsHref(pin.url)} target="_blank" rel="noopener noreferrer" draggable={false} title={pin.body} onClick={onClick}
      className={`flex w-52 items-center gap-2 rounded-pill bg-surface-raised p-1.5 text-left shadow-raised ${flip ? '-translate-x-[156px] flex-row-reverse pl-3' : 'pr-3'} ${FOCUS}`}
    >
      <AdImage campaign={pin} box="size-10 shrink-0 rounded-pill" />
      <span className="min-w-0">
        <span className="flex gap-1">
          <Badge tone="sponsored" className="!px-1.5 !py-0">{pin.kind === 'job' ? 'Sponsored job' : 'Sponsored'}</Badge>
          {pin.isSample && <Badge tone="sample" className="!px-1.5 !py-0" />}
        </span>
        <span className="line-clamp-2 break-words text-caption leading-tight text-text">{pin.body}</span>
      </span>
      <span className="sr-only">(opens in a new tab)</span>
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
  const [shown, setShown] = useState<{ pin: Located; flip: boolean }[]>([]);
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
    const located = pins.filter(isShowable);
    const sync = () => {
      const bounds = map.getBounds();
      const inView = declutter(located, p => map.project([p.lng, p.lat]), PIN_WIDTH, PIN_HEIGHT)
        // Near the top edge an ad would lose its Sponsored label, so it waits until the map moves.
        .filter(p => bounds.contains([p.lng, p.lat]) && map.project([p.lng, p.lat]).y >= PIN_HEIGHT);
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
          void recordImpression(pin._id);
        }
      }
      const mapWidth = map.getContainer().clientWidth;
      setShown(inView.map(pin => ({ pin, flip: map.project([pin.lng, pin.lat]).x + AD_WIDTH - CIRCLE_CENTER > mapWidth })));
    };
    sync();
    map.on('moveend', sync);
    return () => { map.off('moveend', sync); };
  }, [map, pins, recordImpression]);

  useEffect(() => () => {
    for (const marker of markers.current.values()) marker.remove();
    markers.current.clear();
  }, [map]);

  return shown.map(({ pin, flip }) => {
    const element = markers.current.get(pin._id)?.getElement();
    return element ? createPortal(<MapAd pin={pin} flip={flip} onClick={() => void recordClick(pin._id)} />, element, pin._id) : null;
  });
}
