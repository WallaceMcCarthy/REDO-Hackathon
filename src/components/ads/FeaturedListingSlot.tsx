import React, { useEffect, useRef } from 'react';
import { AD_CATEGORIES } from '../../../convex/lib/adCategories';
import type { CampaignRecord } from '../../data/adsHooks';
import { useRecordClick, useRecordImpression } from '../../data/adsHooks';
import { Badge, Button, Card } from '../ui';
import AdImage from './AdImage';
import { safeHttpsHref } from './safeHttpsHref';

interface FeaturedListingSlotProps {
  campaign: CampaignRecord;
  pageTownId?: string;
  className?: string;
}

export default function FeaturedListingSlot({
  campaign,
  pageTownId,
  className = '',
}: FeaturedListingSlotProps) {
  const recordImpression = useRecordImpression();
  const recordClick = useRecordClick();
  const recorded = useRef(false);

  useEffect(() => {
    if (!recorded.current) {
      recorded.current = true;
      recordImpression(campaign._id, 'results_featured', pageTownId);
    }
  }, [campaign._id, pageTownId, recordImpression]);

  const href = safeHttpsHref(campaign.url);

  return (
    <Card as="article" raised className={`flex flex-col justify-between ${className}`}>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="sponsored" />
          {campaign.isSample && <Badge tone="sample" />}
          <span className="text-caption text-text-muted">{AD_CATEGORIES[campaign.category ?? 'other'].label}</span>
        </div>
        <div className="mt-2 flex min-w-0 gap-3">
          <AdImage campaign={campaign} />
          <div className="min-w-0">
            <h3 className="break-words font-display text-title text-text">{campaign.title}</h3>
            <p className="mt-1 break-words text-small text-text-muted">{campaign.body}</p>
          </div>
        </div>
      </div>

      <div className="mt-stack border-t border-border pt-3">
        {href ? (
          <Button
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => recordClick(campaign._id, 'results_featured', pageTownId)}
            variant="secondary"
            size="sm"
            fullWidth
          >
            Learn more
          </Button>
        ) : (
          <span className="text-small text-text-muted">Website link unavailable</span>
        )}
      </div>
    </Card>
  );
}
