import MetricRow from '../components/detail/MetricRow';
import TownListings from '../components/listings/TownListings';
import CommentsThread from '../components/social/CommentsThread';
import { useCities, useMetrics, useRank } from '../data/hooks';
import { CATEGORY_LABELS, toMetricWeights } from '../prefs';
import { CATEGORIES, type Prefs } from '../types';

function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <button onClick={onBack} className="cursor-pointer rounded-full border border-rock-300 px-4 py-1.5 text-sm font-semibold text-rock-800 hover:bg-rock-100 focus-visible:outline-2 focus-visible:outline-alpine-500">
      Back to results
    </button>
  );
}

export default function TownDetail({ id, prefs, onBack }: { id: string; prefs: Prefs; onBack: () => void }) {
  const cities = useCities();
  const metrics = useMetrics();
  const ranked = useRank(toMetricWeights(prefs.categories, metrics ?? []), prefs.filters);

  if (!cities || !metrics || !ranked) {
    return (
      <main className="mx-auto max-w-4xl space-y-4 px-4 py-16" role="status" aria-busy="true">
        <p className="text-sm text-dusk">Loading town details</p>
        <div className="h-12 w-1/2 animate-pulse rounded-xl bg-rock-100/70" />
        <div className="h-5 w-3/4 animate-pulse rounded bg-rock-100/70" />
        {[0, 1, 2].map(i => <div key={i} className="h-28 animate-pulse rounded-2xl bg-rock-100/70" />)}
      </main>
    );
  }
  const town = cities.find(c => c.id === id);
  if (!town) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-16">
        <h1 className="font-display text-3xl text-ink">We couldn’t find that town</h1>
        <p className="mt-2 mb-6 text-dusk">No town matches “{id}”. Head back to the results and pick another.</p>
        <BackButton onBack={onBack} />
      </main>
    );
  }

  const idx = ranked.findIndex(r => r.cityId === id);
  const score = ranked[idx];
  const groups = CATEGORIES.map(category => ({ category, items: metrics.filter(m => m.category === category) })).filter(g => g.items.length);

  return (
    <main className="min-h-full pb-20">
      <header className="border-b border-rock-100 bg-rock-50">
        <div className="mx-auto max-w-4xl px-4 pt-6 pb-8 sm:pt-8 sm:pb-10">
          <BackButton onBack={onBack} />
          <div className="mt-8 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-xl">
              <h1 className="font-display text-5xl leading-none text-rock-800 sm:text-6xl">{town.name}</h1>
              <p className="mt-3 text-sm text-dusk">{town.county} County, population {town.population.toLocaleString('en-US')}</p>
              <p className="mt-4 font-display text-lg leading-relaxed text-ink">{town.blurb}</p>
            </div>
            <div className="shrink-0 sm:text-right">
              {score ? (
                <>
                  <p className="font-display text-6xl leading-none tabular-nums text-alpine-700">{Math.round(score.score)}</p>
                  <p className="mt-2 text-sm text-dusk">Fit for your priorities, ranked {idx + 1} of {ranked.length}</p>
                </>
              ) : (
                <p className="max-w-56 text-sm text-dusk">Your filters hide this town, so it has no rank right now. Relax them on the results screen to see its score.</p>
              )}
            </div>
          </div>
          {score && score.highlights.length > 0 && (
            <ul className="mt-6 flex flex-wrap gap-2">
              {score.highlights.map(h => (
                <li key={h} className="rounded-full bg-alpine-100 px-3 py-1 text-sm font-medium text-alpine-900">{h}</li>
              ))}
            </ul>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4">
        <TownListings cityId={id} cityName={town.name} />

        <div className="mt-12 border-t border-rock-200 pt-8">
          <CommentsThread targetType="town" targetId={id} title={`Local insights & community for ${town.name}`} />
        </div>

        {groups.map(({ category, items }) => (
          <section key={category} className="mt-10" aria-labelledby={`cat-${category}`}>
            <h2 id={`cat-${category}`} className="border-b-2 border-alpine-300 pb-2 font-display text-2xl text-alpine-900">{CATEGORY_LABELS[category]}</h2>
            <ul className="divide-y divide-rock-100">
              {items.map(m => <MetricRow key={m.id} metric={m} townId={id} />)}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
