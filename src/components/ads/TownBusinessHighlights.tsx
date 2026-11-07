import { useEffect, useRef } from 'react';
import type { CampaignRecord } from '../../data/adsHooks';
import { useActiveFeatured, useActivePins, useRecordClick, useRecordImpression } from '../../data/adsHooks';
import { Badge, Button, Card } from '../ui';
import { safeHttpsHref } from './safeHttpsHref';

interface Props {
  cityId: string;
  cityName: string;
}

function BusinessCard({ campaign }: { campaign: CampaignRecord }) {
  const recordImpression = useRecordImpression();
  const recordClick = useRecordClick();
  const recorded = useRef(false);

  useEffect(() => {
    if (!recorded.current) {
      recorded.current = true;
      recordImpression(campaign._id);
    }
  }, [campaign._id, recordImpression]);

  const href = safeHttpsHref(campaign.url);
  const kindLabel = campaign.kind === 'job' ? 'Hiring in town' : campaign.kind === 'featured' ? 'Featured partner' : 'Local business';

  return (
    <Card as="article" className="flex flex-col justify-between border-border bg-surface-raised p-5">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="sponsored">Sponsored</Badge>
          {campaign.isSample && <Badge tone="sample">Sample</Badge>}
          <span className="text-caption font-medium text-text-muted">{kindLabel}</span>
        </div>
        <h4 className="mt-2.5 font-display text-title text-text">{campaign.title}</h4>
        <p className="mt-1 text-small leading-relaxed text-text-muted">{campaign.body}</p>
      </div>
      <div className="mt-4 flex items-center justify-between pt-3 border-t border-border">
        {href ? (
          <Button
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            variant="secondary"
            size="sm"
            onClick={() => recordClick(campaign._id)}
          >
            Visit business <span aria-hidden="true">↗</span>
          </Button>
        ) : (
          <span className="text-caption text-text-muted">Local listing</span>
        )}
      </div>
    </Card>
  );
}

export default function TownBusinessHighlights({ cityId, cityName }: Props) {
  const pins = useActivePins(cityId) ?? [];
  const featured = useActiveFeatured(cityId) ?? [];

  // Combine and deduplicate campaigns for this town
  const campaignsMap = new Map<string, CampaignRecord>();
  for (const c of [...featured, ...pins]) {
    campaignsMap.set(c._id, c);
  }
  const campaigns = Array.from(campaignsMap.values());

  return (
    <section className="mt-section" aria-labelledby="town-business-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border-strong pb-2">
        <h3 id="town-business-heading" className="font-display text-heading text-text">
          Local Businesses & Opportunities in {cityName}
        </h3>
        <Button href="#/advertise" variant="ghost" size="sm">
          Promote your business in {cityName} →
        </Button>
      </div>

      {campaigns.length > 0 ? (
        <div className="mt-stack grid gap-4 sm:grid-cols-2">
          {campaigns.map(c => (
            <BusinessCard key={c._id} campaign={c} />
          ))}
        </div>
      ) : (
        <Card className="mt-stack border-dashed border-border-strong bg-surface-sunken p-6 text-center">
          <h4 className="font-display text-title text-text">Own a local business or service in {cityName}?</h4>
          <p className="mx-auto mt-1 max-w-lg text-small text-text-muted">
            Connect directly with newcomers and movers researching {cityName}. Feature your restaurant, outdoor shop, tech company, or local service.
          </p>
          <div className="mt-4 flex justify-center">
            <Button href="#/advertise" size="md">
              Create a local campaign in {cityName}
            </Button>
          </div>
        </Card>
      )}
    </section>
  );
}
