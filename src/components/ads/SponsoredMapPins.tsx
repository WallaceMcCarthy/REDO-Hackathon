import * as maplibregl from 'maplibre-gl';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AD_CATEGORIES } from '../../../convex/lib/adCategories';
import type { CampaignRecord } from '../../data/adsHooks';
import type { City } from '../../types';
import { useActivePins, useRecordClick, useRecordImpression } from '../../data/adsHooks';
import { FOCUS } from '../homes/ui';
import { Badge, Button } from '../ui';
import AdImage from './AdImage';
import { declutter, nearestTown } from './placement';
import { safeHttpsHref } from './safeHttpsHref';

// Room for the widest label, and tall enough that 44px phone targets never overlap.
const PIN_WIDTH = 112;
const PIN_HEIGHT = 48;
// Where the map starts naming towns, so it reads as looking at one.
const TOWN_ZOOM = 9;

type Located = CampaignRecord & { lat: number; lng: number };
const isLocated = (c: CampaignRecord): c is Located => c.lat !== undefined && c.lng !== undefined;

function pinElement(pin: Located) {
  const el = document.createElement('div');
  el.setAttribute('role', 'button');
  el.setAttribute('tabindex', '0');
  el.setAttribute('aria-label', `Sponsored: ${pin.title}`);
  el.className = `flex min-h-11 cursor-pointer items-center rounded-pill lg:min-h-0 ${FOCUS}`;
  const label = document.createElement('span');
  const tone = pin.kind === 'job' ? 'border-ink bg-ink text-white' : 'border-rock-800 bg-rock-100 text-rock-800';
  label.className = `whitespace-nowrap rounded-pill border px-2 py-0.5 text-caption font-semibold shadow-raised ${tone}`;
  label.textContent = pin.kind === 'job' ? 'Sponsored job' : 'Sponsored';
  el.append(label);
  return el;
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
  const [open, setOpen] = useState<{ pin: Located; node: HTMLElement; popup: maplibregl.Popup } | null>(null);
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

  // Every impression patches a campaign, so `pins` changes often: diff the markers or an open popup would close.
  useEffect(() => {
    const located = pins.filter(isLocated);
    const addMarker = (pin: Located) => {
      const element = pinElement(pin);
      const node = document.createElement('div');
      const popup = new maplibregl.Popup({ closeButton: false, offset: 36, maxWidth: '280px' }).setDOMContent(node);
      popup.on('open', () => setOpen({ pin, node, popup }));
      popup.on('close', () => {
        setOpen(current => (current?.node === node ? null : current));
        element.focus({ preventScroll: true });
      });
      // Anchored above the point so the pill does not sit on the organic cluster at the same spot.
      const marker = new maplibregl.Marker({ element, anchor: 'bottom' }).setLngLat([pin.lng, pin.lat]).setPopup(popup).addTo(map);
      element.addEventListener('keydown', e => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        e.stopPropagation();
        marker.togglePopup();
      });
      return marker;
    };
    const sync = () => {
      const bounds = map.getBounds();
      const shown = declutter(located, p => map.project([p.lng, p.lat]), PIN_WIDTH, PIN_HEIGHT)
        .filter(p => bounds.contains([p.lng, p.lat]));
      const ids = new Set(shown.map(p => p._id));
      for (const [id, marker] of markers.current) {
        if (ids.has(id) || marker.getPopup()?.isOpen()) continue;
        marker.remove();
        markers.current.delete(id);
      }
      for (const pin of shown) {
        if (!markers.current.has(pin._id)) markers.current.set(pin._id, addMarker(pin));
        if (!seen.current.has(pin._id)) {
          seen.current.add(pin._id);
          void recordImpression(pin._id);
        }
      }
    };
    sync();
    map.on('moveend', sync);
    return () => { map.off('moveend', sync); };
  }, [map, pins, recordImpression]);

  useEffect(() => () => {
    for (const marker of markers.current.values()) marker.remove();
    markers.current.clear();
  }, [map]);

  // The popup chose its anchor while still empty, so place it again now the content has a height.
  useLayoutEffect(() => {
    if (open) open.popup.setLngLat(open.popup.getLngLat());
  }, [open]);

  if (!open) return null;
  const { pin, node, popup } = open;
  const href = safeHttpsHref(pin.url);
  return createPortal(
    <div key={pin._id} className="relative text-text">
      <button
        type="button" aria-label="Close sponsored pin" autoFocus onClick={() => popup.remove()}
        className={`absolute -right-3 -top-2 size-11 cursor-pointer rounded-control text-title text-text-muted ${FOCUS}`}
      >
        <span aria-hidden="true">×</span>
      </button>
      <div className="flex flex-wrap items-center gap-1 pr-8">
        <Badge tone="sponsored" />
        {pin.isSample && <Badge tone="sample" />}
        <span className="text-caption text-text-muted">{AD_CATEGORIES[pin.category ?? 'other'].label}</span>
      </div>
      <div className="mt-2 flex min-w-0 gap-3">
        <AdImage campaign={pin} />
        <div className="min-w-0">
          <h3 className="break-words font-display text-body font-semibold">{pin.title}</h3>
          <p className="mt-1 break-words text-small text-text-muted">{pin.body}</p>
        </div>
      </div>
      {href && (
        <Button
          href={href} target="_blank" rel="noopener noreferrer" variant="secondary" size="sm" className="mt-2"
          onClick={() => recordClick(pin._id)}
        >
          {pin.kind === 'job' ? 'See the job' : 'Visit business'} <span aria-hidden="true">↗</span>
        </Button>
      )}
    </div>,
    node,
  );
}
