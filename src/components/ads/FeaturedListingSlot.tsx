import React, { useEffect, useRef } from 'react';
import { AD_CATEGORIES } from '../../../convex/lib/adCategories';
import type { CampaignRecord } from '../../data/adsHooks';
import { useRecordClick, useRecordImpression } from '../../data/adsHooks';
import { Button, Card } from '../ui';
import AdImage from './AdImage';
import { adLink, listingAction } from './placement';

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

  const link = adLink(campaign);

  return (
    <Card as="article" raised className={`flex flex-col justify-between ${className}`}>
      <div>
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-caption font-medium uppercase tracking-wide text-text-muted">
          <span>Sponsored</span>
          {campaign.isSample && <span>· Sample</span>}
          <span className="normal-case tracking-normal">· {AD_CATEGORIES[campaign.category ?? 'other'].label}</span>
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
        {link ? (
          <Button
            {...link}
            onClick={() => recordClick(campaign._id, 'results_featured', pageTownId)}
            variant="secondary"
            size="sm"
            fullWidth
          >
            {campaign.listingId ? listingAction(campaign.listingId) : 'Learn more'}
          </Button>
        ) : (
          <span className="text-small text-text-muted">Website link unavailable</span>
        )}
      </div>
    </Card>
  );
}
