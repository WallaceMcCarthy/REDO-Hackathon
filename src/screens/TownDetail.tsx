import type { ReactNode } from 'react';
import MetricRow from '../components/detail/MetricRow';
import TownListings from '../components/listings/TownListings';
import { openSignIn } from '../components/auth/AccountMenu';
import TownFeed from '../components/feed/TownFeed';
import TownBusinessHighlights from '../components/ads/TownBusinessHighlights';
import CommentsThread from '../components/social/CommentsThread';
import SafeSectionBoundary from '../components/SafeSectionBoundary';
import { Badge, Button, Card, EmptyState, PageHeader, Skeleton } from '../components/ui';
import { useCities, useMetrics, useRank } from '../data/hooks';
import { CATEGORY_LABELS, isDefaultPrefs, toMetricWeights } from '../prefs';
import { CATEGORIES, type Prefs } from '../types';

const BackButton = ({ onBack }: { onBack: () => void }) => (
  <Button variant="secondary" size="sm" onClick={onBack}><span aria-hidden="true">←</span> Back to results</Button>
);

const Unavailable = ({ children }: { children: ReactNode }) => (
  <Card className="mt-section bg-surface-sunken text-small text-text-muted">{children}</Card>
);

export default function TownDetail({ id, prefs, onBack }: { id: string; prefs: Prefs; onBack: () => void }) {
  const cities = useCities();
  const metrics = useMetrics();
  const ranked = useRank(toMetricWeights(prefs.categories, metrics ?? []), prefs.filters);

  if (!cities || !metrics || !ranked) {
    return (
      <main className="mx-auto max-w-4xl space-y-stack px-gutter py-section" role="status" aria-busy="true">
        <p className="text-small text-text-muted">Loading town details</p>
        <Skeleton className="h-12 w-1/2" />
        <Skeleton className="h-5 w-3/4" />
        {[0, 1, 2].map(i => <Skeleton key={i} className="h-28 rounded-card" />)}
      </main>
    );
  }
  const town = cities.find(c => c.id === id);
  if (!town) {
    return (
      <main className="mx-auto max-w-4xl px-gutter py-section">
        <EmptyState
          title="We couldn’t find that town"
          description={`No town matches “${id}”. Head back to the results and pick another.`}
          action={<BackButton onBack={onBack} />}
        />
      </main>
    );
  }

  const idx = ranked.findIndex(r => r.cityId === id);
  const score = ranked[idx];
  const groups = CATEGORIES.map(category => ({ category, items: metrics.filter(m => m.category === category) })).filter(g => g.items.length);

  return (
    <main className="mx-auto min-w-0 max-w-4xl px-gutter pt-stack pb-section">
      <BackButton onBack={onBack} />

      <Card as="section" raised aria-label={`${town.name} overview`} className="mt-stack space-y-stack">
        <PageHeader
          title={town.name}
          description={`${town.county} County, population ${town.population.toLocaleString('en-US')}`}
          actions={<Button href={`#/results?town=${encodeURIComponent(town.id)}`} size="lg" fullWidth className="sm:w-auto">See homes in {town.name}</Button>}
        />
        <p className="max-w-prose break-words font-display text-body text-text sm:text-title">{town.blurb}</p>
        <div className="flex flex-col gap-4 border-t border-border pt-stack sm:flex-row sm:items-start sm:gap-8">
          {score ? (
            <>
              <div className="shrink-0">
                <p className="font-display text-display tabular-nums text-success">{Math.round(score.score)}<span className="font-sans text-body text-text-muted"> / 100</span></p>
                <p className="text-small text-text-muted">
                  {isDefaultPrefs(prefs) ? 'Fit for a balanced mix of priorities' : 'Fit for your priorities'}, ranked {idx + 1} of {ranked.length}
                </p>
                <a href="#/" className="text-small font-semibold text-primary-hover underline underline-offset-2">{isDefaultPrefs(prefs) ? 'Set your priorities' : 'Change your priorities'}</a>
              </div>
              {score.highlights.length > 0 && (
                <ul aria-label="Why it fits" className="flex min-w-0 flex-wrap gap-2">
                  {score.highlights.map(h => <li key={h}><Badge>{h}</Badge></li>)}
                </ul>
              )}
            </>
          ) : (
            <p className="max-w-prose text-small text-text-muted">Your filters hide this town, so it has no rank right now. Relax them on the results screen to see its score.</p>
          )}
        </div>
      </Card>

      <SafeSectionBoundary fallback={<Unavailable>Homes for {town.name} aren’t available right now. Try again in a moment.</Unavailable>}>
        <TownListings cityId={id} cityName={town.name} />
      </SafeSectionBoundary>

      <section className="mt-section" aria-labelledby="town-metrics-heading">
        <h2 id="town-metrics-heading" className="font-display text-heading text-text">The numbers</h2>
        <nav aria-label="Metric categories" className="mt-3 flex flex-wrap gap-2">
          {groups.map(({ category }) => (
            <Button key={category} href={`#cat-${category}`} variant="secondary" size="sm"
              onClick={e => { e.preventDefault(); document.getElementById(`cat-${category}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>
              {CATEGORY_LABELS[category]}
            </Button>
          ))}
        </nav>
        {groups.map(({ category, items }) => (
          <section key={category} className="mt-stack" aria-labelledby={`cat-${category}`}>
            <h3 id={`cat-${category}`} className="scroll-mt-4 border-b border-border-strong pb-2 font-display text-title text-text">
              {CATEGORY_LABELS[category]} <span className="font-sans text-caption font-normal text-text-muted">{items.length} measures</span>
            </h3>
            <ul className="divide-y divide-border">
              {items.map(m => <MetricRow key={m.id} metric={m} townId={id} />)}
            </ul>
          </section>
        ))}
      </section>

      <SafeSectionBoundary fallback={<Unavailable>Local businesses aren’t available right now. Try again in a moment.</Unavailable>}>
        <TownBusinessHighlights cityId={id} cityName={town.name} />
      </SafeSectionBoundary>

      <SafeSectionBoundary fallback={<Unavailable>The {town.name} feed couldn’t load right now. Try again in a moment.</Unavailable>}>
        <TownFeed
          cityId={town.id} cityName={town.name} onSignIn={openSignIn}
          renderComments={postId => (
            <SafeSectionBoundary fallback={<p className="text-small text-text-muted">Comments couldn’t load right now.</p>}>
              <CommentsThread targetType="post" targetId={postId} />
            </SafeSectionBoundary>
          )}
        />
      </SafeSectionBoundary>

      <SafeSectionBoundary fallback={<Unavailable>Comments couldn’t load right now. Try again in a moment.</Unavailable>}>
        <div className="mt-section">
          <CommentsThread targetType="town" targetId={id} title={`Local insights & community for ${town.name}`} />
        </div>
      </SafeSectionBoundary>

    </main>
  );
}
