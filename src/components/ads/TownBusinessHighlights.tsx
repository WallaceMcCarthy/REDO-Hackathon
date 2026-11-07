import { useEffect, useRef } from 'react';
import { AD_CATEGORIES, AD_CATEGORY_IDS } from '../../../convex/lib/adCategories';
import type { CampaignRecord } from '../../data/adsHooks';
import { useRecordClick, useRecordImpression, useTownCampaigns } from '../../data/adsHooks';
import type { Metric } from '../../types';
import { Badge, Button, Card } from '../ui';
import AdImage from './AdImage';
import { titleRepeatsMessage } from './campaignPlacement';
import { safeHttpsHref } from './safeHttpsHref';

interface Props {
  cityId: string;
  cityName: string;
  metrics: Metric[];
}

function BusinessCard({ campaign, cityId }: { campaign: CampaignRecord; cityId: string }) {
  const recordImpression = useRecordImpression();
  const recordClick = useRecordClick();
  const recorded = useRef(false);

  useEffect(() => {
    if (!recorded.current) {
      recorded.current = true;
      recordImpression(campaign._id, 'town_highlights', cityId);
    }
  }, [campaign._id, cityId, recordImpression]);

  const href = safeHttpsHref(campaign.url);
  const messageOnly = titleRepeatsMessage(campaign);

  return (
    <Card as="article" className="flex min-w-0 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="sponsored" />
        {campaign.isSample && <Badge tone="sample" />}
        {campaign.kind === 'job' && <span className="text-caption text-text-muted">Hiring in town</span>}
      </div>
      <div className="flex min-w-0 gap-3">
        <AdImage campaign={campaign} />
        <div className="min-w-0">
          <h4 className="break-words font-semibold text-text">{messageOnly ? campaign.body : campaign.title}</h4>
          {!messageOnly && <p className="break-words text-small text-text-muted">{campaign.body}</p>}
        </div>
      </div>
      {href && (
        <Button href={href} target="_blank" rel="noopener noreferrer" variant="secondary" size="sm" className="mt-auto self-start" onClick={() => recordClick(campaign._id, 'town_highlights', cityId)}>
          Visit <span className="sr-only">{campaign.title}</span> <span aria-hidden="true">↗</span>
        </Button>
      )}
    </Card>
  );
}

export default function TownBusinessHighlights({ cityId, cityName, metrics }: Props) {
  const campaigns = useTownCampaigns(cityId);
  if (!campaigns) return null;

  const groups = AD_CATEGORY_IDS
    .map(id => ({ id, items: campaigns.filter(c => (c.category ?? 'other') === id) }))
    .filter(g => g.items.length);

  const townFact = (id: keyof typeof AD_CATEGORIES) => {
    const category = AD_CATEGORIES[id];
    const metric = 'metricId' in category ? metrics.find(m => m.id === category.metricId) : undefined;
    const value = metric?.values[cityId];
    return metric && value !== undefined ? `${metric.label}: ${value.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${metric.unit}` : undefined;
  };

  return (
    <section className="mt-section" aria-labelledby="town-business-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border-strong pb-2">
        <h2 id="town-business-heading" className="font-display text-heading text-text">Sponsored in {cityName}</h2>
        <Button href="#/advertise" variant="ghost" size="sm">Advertise here</Button>
      </div>
      <p className="mt-2 text-caption text-text-muted">Paid placements. They never affect a town’s fit score or ranking.</p>

      {groups.length > 0 ? groups.map(({ id, items }) => {
        const fact = townFact(id);
        return (
          <section key={id} className="mt-stack" aria-label={`Sponsored: ${AD_CATEGORIES[id].label}`}>
            <h3 className="font-display text-title text-text">{AD_CATEGORIES[id].label}</h3>
            {fact && <p className="text-caption text-text-muted">Town data, not an ad. {fact}</p>}
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              {items.map(c => <BusinessCard key={c._id} campaign={c} cityId={cityId} />)}
            </div>
          </section>
        );
      }) : (
        <p className="mt-stack text-small text-text-muted">No sponsors in {cityName} yet. Any local business can advertise here.</p>
      )}
    </section>
  );
}
