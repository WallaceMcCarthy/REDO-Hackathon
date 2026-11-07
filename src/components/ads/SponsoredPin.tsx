import L from 'leaflet';
import React, { memo, useEffect, useRef } from 'react';
import { Marker, Popup } from 'react-leaflet';
import type { CampaignRecord } from '../../data/adsHooks';
import { useRecordClick, useRecordImpression } from '../../data/adsHooks';

interface SponsoredPinProps {
  campaign: CampaignRecord;
}

const pinCache = new Map<string, L.DivIcon>();

function getSponsoredIcon(kind: 'pin' | 'featured' | 'job'): L.DivIcon {
  let icon = pinCache.get(kind);
  if (!icon) {
    const isJob = kind === 'job';
    const bg = isJob ? 'bg-amber-600' : 'bg-purple-700';
    const label = isJob ? '💼' : '⭐';

    icon = L.divIcon({
      className: 'sponsored-pin-container',
      iconSize: [32, 32],
      iconAnchor: [16, 16],
      popupAnchor: [0, -16],
      html: `
        <div class="flex size-8 items-center justify-center rounded-full border-2 border-amber-300 ${bg} shadow-lg text-xs cursor-pointer transition-transform duration-150 hover:scale-125">
          <span>${label}</span>
        </div>
      `,
    });
    pinCache.set(kind, icon);
  }
  return icon;
}

/** Defense-in-depth: only allow https URLs to be rendered into href */
function safeHttpsHref(rawUrl?: string): string | undefined {
  if (!rawUrl) return undefined;
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol === 'https:') {
      return parsed.toString();
    }
  } catch {}
  return undefined;
}

export const SponsoredPin = memo(function SponsoredPin({ campaign }: SponsoredPinProps) {
  const recordImpression = useRecordImpression();
  const recordClick = useRecordClick();
  const recorded = useRef(false);

  useEffect(() => {
    if (!recorded.current) {
      recorded.current = true;
      recordImpression(campaign._id);
    }
  }, [campaign._id, recordImpression]);

  if (campaign.lat == null || campaign.lng == null) return null;

  const position: L.LatLngTuple = [campaign.lat, campaign.lng];
  const icon = getSponsoredIcon(campaign.kind);
  const href = safeHttpsHref(campaign.url);

  return (
    <Marker position={position} icon={icon} zIndexOffset={1500}>
      <Popup className="sponsored-pin-popup" maxWidth={300} minWidth={240}>
        <div className="p-2 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="rounded-full bg-purple-100 px-2 py-0.5 font-semibold text-purple-900">
              Sponsored {campaign.isSample && '(sample)'}
            </span>
            {campaign.kind === 'job' && (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                Job Opening
              </span>
            )}
          </div>

          <div>
            <h4 className="font-display text-sm font-bold text-ink">{campaign.title}</h4>
            <p className="mt-1 text-xs text-rock-600">{campaign.body}</p>
          </div>

          {href && (
            <div className="pt-2 border-t border-rock-100">
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => recordClick(campaign._id)}
                className="inline-flex w-full items-center justify-center rounded-full bg-purple-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-purple-800"
              >
                Visit website ↗
              </a>
            </div>
          )}
        </div>
      </Popup>
    </Marker>
  );
});

export default SponsoredPin;
