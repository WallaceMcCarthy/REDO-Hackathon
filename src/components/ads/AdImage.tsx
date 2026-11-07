import { useState } from 'react';
import type { CampaignRecord } from '../../data/adsHooks';
import { safeImageSrc } from './safeHttpsHref';

/** Thumbnail, square unless `box` says otherwise. A missing or broken image falls back to the initial, so a dead URL never leaves a broken icon. */
export default function AdImage({ campaign, box = 'size-16 shrink-0 rounded-control' }: { campaign: Pick<CampaignRecord, 'imageUrl' | 'title'>; box?: string }) {
  const [failed, setFailed] = useState(false);
  const src = safeImageSrc(campaign.imageUrl);

  if (!src || failed) {
    return <span aria-hidden="true" data-testid="ad-image-fallback" className={`${box} flex items-center justify-center bg-surface-sunken font-display text-title text-text-muted`}>{campaign.title.charAt(0)}</span>;
  }
  return <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} className={`${box} object-cover`} />;
}
