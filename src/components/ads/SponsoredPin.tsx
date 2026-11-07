import L from 'leaflet';
import React, { memo, useEffect, useRef } from 'react';
import { Marker, Popup } from 'react-leaflet';
import type { CampaignRecord } from '../../data/adsHooks';
import { useRecordClick, useRecordImpression } from '../../data/adsHooks';
import { Badge, Button } from '../ui';

interface SponsoredPinProps {
  campaign: CampaignRecord;
}

const pinCache = new Map<string, L.DivIcon>();

function getSponsoredIcon(kind: 'pin' | 'featured' | 'job'): L.DivIcon {
  let icon = pinCache.get(kind);
  if (!icon) {
    const label = kind === 'job' ? 'Job' : 'Ad';
    icon = L.divIcon({
      className: 'sponsored-pin-container',
      iconSize: [32, 32],
      iconAnchor: [16, 16],
      popupAnchor: [0, -16],
      html: `<div class="flex size-8 cursor-pointer items-center justify-center rounded-pill border-2 border-surface-raised bg-primary text-caption font-semibold text-on-primary shadow-overlay transition-transform duration-150 hover:scale-125">${label}</div>`,
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
        <div className="space-y-2 p-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="sponsored" />
            {campaign.isSample && <Badge tone="sample" />}
            {campaign.kind === 'job' && <Badge>Job opening</Badge>}
          </div>
          <div>
            <h4 className="break-words font-display text-body font-bold text-text">{campaign.title}</h4>
            <p className="mt-1 break-words text-small text-text-muted">{campaign.body}</p>
          </div>
          {href && (
            <Button
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => recordClick(campaign._id)}
              size="sm"
              fullWidth
            >
              Visit website
            </Button>
          )}
        </div>
      </Popup>
    </Marker>
  );
});

export default SponsoredPin;
