import React, { useEffect, useRef } from 'react';
import type { CampaignRecord } from '../../data/adsHooks';
import { useRecordClick, useRecordImpression } from '../../data/adsHooks';

interface FeaturedListingSlotProps {
  campaign: CampaignRecord;
  className?: string;
}

export default function FeaturedListingSlot({
  campaign,
  className = '',
}: FeaturedListingSlotProps) {
  const recordImpression = useRecordImpression();
  const recordClick = useRecordClick();
  const recorded = useRef(false);

  useEffect(() => {
    if (!recorded.current) {
      recorded.current = true;
      recordImpression(campaign._id);
    }
  }, [campaign._id, recordImpression]);

  return (
    <article
      className={`group relative flex flex-col justify-between rounded-2xl border-2 border-purple-300 bg-gradient-to-br from-purple-50/50 to-white p-4 shadow-sm hover:border-purple-400 ${className}`}
    >
      <div>
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center rounded-full bg-purple-100 px-2.5 py-0.5 font-bold text-purple-900">
              Sponsored {campaign.isSample && '(sample)'}
            </span>
            <span className="text-[11px] font-medium text-purple-700">
              Featured placement
            </span>
          </div>
        </div>

        <div className="mt-2.5">
          <h3 className="font-display text-lg font-bold leading-snug text-ink group-hover:text-purple-950">
            {campaign.title}
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-rock-700">{campaign.body}</p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-purple-100 pt-2.5 text-xs">
        <span className="text-[10px] text-purple-600">Verified Sponsor via REDO Payments</span>
        <a
          href={campaign.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => recordClick(campaign._id)}
          className="inline-flex items-center gap-1 font-semibold text-purple-800 underline underline-offset-2 hover:text-purple-950"
        >
          Learn more ↗
        </a>
      </div>
    </article>
  );
}
