import React, { useState } from 'react';
import { useCreateCampaign, useMyCampaigns } from '../../data/adsHooks';
import type { City } from '../../types';

interface AdvertiserDashboardProps {
  cities: City[];
  onBack: () => void;
}

export default function AdvertiserDashboard({ cities, onBack }: AdvertiserDashboardProps) {
  const campaigns = useMyCampaigns();
  const createCampaign = useCreateCampaign();

  const [kind, setKind] = useState<'pin' | 'featured' | 'job'>('pin');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [url, setUrl] = useState('');
  const [cityId, setCityId] = useState('');
  const [durationDays, setDurationDays] = useState(7);
  const [submitting, setSubmitting] = useState(false);
  const [checkoutNotice, setCheckoutNotice] = useState<string | null>(null);
  const [pendingCheckoutUrl, setPendingCheckoutUrl] = useState<string | null>(null);

  const selectedCity = cities.find((c) => c.id === cityId);

  // Rate card: Map pin = $5/day ($500 cents), Featured = $10/day ($1000 cents), Job = $7/day ($700 cents)
  const ratePerDay = kind === 'featured' ? 10 : kind === 'job' ? 7 : 5;
  const totalCost = ratePerDay * durationDays;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !url.trim() || submitting) return;
    setSubmitting(true);
    setCheckoutNotice(null);
    setPendingCheckoutUrl(null);

    try {
      const res = await createCampaign({
        kind,
        title: title.trim(),
        body: body.trim(),
        url: url.trim(),
        lat: selectedCity?.lat,
        lng: selectedCity?.lng,
        cityId: cityId || undefined,
        durationDays,
      });

      if (res?.checkoutUrl) {
        setPendingCheckoutUrl(res.checkoutUrl);
        setCheckoutNotice(
          `Campaign created in pending_payment state! REDO checkout session generated.`
        );
        // Clear form
        setTitle('');
        setBody('');
        setUrl('');
      }
    } catch (err: any) {
      setCheckoutNotice(`Error creating campaign: ${err.message || 'Please sign in first.'}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
      <button
        type="button"
        onClick={onBack}
        className="mb-4 inline-flex min-h-[44px] items-center cursor-pointer rounded-full border border-rock-300 px-4 py-2 text-sm font-semibold text-rock-700 hover:bg-rock-100 focus-visible:outline-2 focus-visible:outline-alpine-500"
      >
        ← Back to results
      </button>

      <div className="flex flex-col gap-2 border-b border-rock-200 pb-6 sm:flex-row sm:items-baseline sm:justify-between">
        <div>
          <h1 className="font-display text-4xl font-bold text-ink">Advertiser Dashboard</h1>
          <p className="mt-1 text-sm text-dusk">
            Self-serve local advertising for Utah businesses and employers.
          </p>
        </div>
        <div className="rounded-xl bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 border border-amber-200 flex items-center gap-1.5">
          <span>⚠️</span>
          <span>SANDBOX: REDO payments not connected yet</span>
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_22rem]">
        {/* Active & Past Campaigns */}
        <section aria-labelledby="campaigns-heading" className="space-y-4">
          <h2 id="campaigns-heading" className="font-display text-xl font-bold text-ink">
            Your Campaigns
          </h2>

          {campaigns === undefined ? (
            <div className="space-y-3">
              {[0, 1].map((i) => (
                <div key={i} className="h-32 animate-pulse rounded-2xl bg-rock-100/60" />
              ))}
            </div>
          ) : campaigns.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-rock-300 p-8 text-center">
              <span className="text-2xl">📢</span>
              <p className="mt-2 text-sm font-semibold text-ink">No campaigns yet</p>
              <p className="mt-1 text-xs text-dusk">
                Create your first sponsored pin or featured listing using the form on the right.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {campaigns.map((c) => {
                const ctr =
                  c.impressions > 0 ? ((c.clicks / c.impressions) * 100).toFixed(1) : '0.0';

                return (
                  <div
                    key={c._id}
                    className="rounded-2xl border border-rock-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-semibold text-purple-900 capitalize">
                          {c.kind}
                        </span>
                        <h3 className="font-semibold text-ink">{c.title}</h3>
                        {c.isSample && (
                          <span className="rounded bg-amber-100 px-1.5 py-0.2 text-[10px] font-medium text-amber-800">
                            Sample
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                            c.status === 'active'
                              ? 'bg-emerald-100 text-emerald-800'
                              : c.status === 'pending_payment'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rock-100 text-rock-600'
                          }`}
                        >
                          {c.status.replace('_', ' ')}
                        </span>
                        {c.status === 'pending_payment' && (
                          <span className="text-[10px] text-dusk italic">
                            Awaiting REDO webhook confirmation
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="mt-2 text-xs text-rock-600 line-clamp-2">{c.body}</p>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-rock-100 pt-3 text-xs">
                      <div className="flex gap-4">
                        <div>
                          <span className="text-dusk">Impressions: </span>
                          <span className="font-semibold text-ink">{c.impressions}</span>
                        </div>
                        <div>
                          <span className="text-dusk">Clicks: </span>
                          <span className="font-semibold text-ink">{c.clicks}</span>
                        </div>
                        <div>
                          <span className="text-dusk">CTR: </span>
                          <span className="font-semibold text-ink">{ctr}%</span>
                        </div>
                      </div>

                      <div className="text-dusk text-[11px]">
                        Ends: {new Date(c.endsAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <p className="text-[11px] text-dusk italic">
            Metrics: Impressions and clicks are tracked server-side for authenticated visitors. Self-views are excluded to prevent metric inflation.
          </p>
        </section>

        {/* Create Campaign Form */}
        <section
          aria-labelledby="create-heading"
          className="rounded-3xl border border-rock-200 bg-white p-6 shadow-sm self-start"
        >
          <h2 id="create-heading" className="font-display text-lg font-bold text-ink">
            Create a Campaign
          </h2>
          <p className="mt-0.5 text-xs text-dusk">
            Reach Utah movers directly on map and town results.
          </p>

          <form onSubmit={handleCreate} className="mt-4 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-ink">Ad Type</label>
              <div className="mt-1 grid grid-cols-3 gap-1 rounded-xl bg-rock-100 p-1 text-xs">
                {(['pin', 'featured', 'job'] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setKind(k)}
                    className={`rounded-lg min-h-[40px] flex items-center justify-center capitalize transition-all ${
                      kind === k
                        ? 'bg-white font-semibold text-ink shadow-sm'
                        : 'text-rock-600 hover:text-ink'
                    }`}
                  >
                    {k === 'pin' ? 'Map Pin' : k === 'featured' ? 'Featured' : 'Job Pin'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink">Headline / Title</label>
              <input
                type="text"
                required
                minLength={3}
                maxLength={80}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={
                  kind === 'job'
                    ? 'Apply to REDO!'
                    : kind === 'featured'
                    ? 'Park City Luxury Mountain Living'
                    : "Eat at Freddy's Cafe"
                }
                className="mt-1 w-full min-h-[44px] rounded-xl border border-rock-200 px-3 py-2 text-xs text-ink placeholder:text-rock-400 focus:border-alpine-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink">Body / Description</label>
              <textarea
                required
                rows={2}
                minLength={5}
                maxLength={300}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Short pitch or offer to entice viewers..."
                className="mt-1 w-full min-h-[44px] rounded-xl border border-rock-200 p-2.5 text-xs text-ink placeholder:text-rock-400 focus:border-alpine-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink">Destination URL (HTTPS only)</label>
              <input
                type="url"
                required
                maxLength={500}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/promo"
                className="mt-1 w-full min-h-[44px] rounded-xl border border-rock-200 px-3 py-2 text-xs text-ink placeholder:text-rock-400 focus:border-alpine-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink">Target City (Location)</label>
              <select
                value={cityId}
                onChange={(e) => setCityId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-rock-200 px-3 py-1.5 text-xs text-ink focus:border-alpine-500 focus:outline-none"
              >
                <option value="">Statewide / Salt Lake Metro</option>
                {cities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink">Duration (Days)</label>
              <select
                value={durationDays}
                onChange={(e) => setDurationDays(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-rock-200 px-3 py-1.5 text-xs text-ink focus:border-alpine-500 focus:outline-none"
              >
                <option value={7}>7 Days (${ratePerDay * 7})</option>
                <option value={14}>14 Days (${ratePerDay * 14})</option>
                <option value={30}>30 Days (${ratePerDay * 30})</option>
              </select>
            </div>

            <div className="rounded-xl bg-rock-50 p-3 text-xs">
              <div className="flex justify-between font-semibold text-ink">
                <span>Total Due:</span>
                <span>${totalCost}.00 USD</span>
              </div>
              <p className="mt-1 text-[10px] text-dusk">
                Billed securely via REDO Payments Gateway.
              </p>
            </div>

            {checkoutNotice && (
              <div className="rounded-xl bg-purple-50 p-3 text-xs text-purple-900 border border-purple-200">
                {checkoutNotice}
              </div>
            )}

            {pendingCheckoutUrl && (
              <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900 border border-amber-300 space-y-2">
                <div className="font-semibold">Checkout Session Initialized:</div>
                <a
                  href={pendingCheckoutUrl}
                  className="inline-block cursor-pointer rounded-full bg-purple-700 px-4 py-1.5 text-xs font-bold text-white hover:bg-purple-800"
                >
                  View Sandbox Checkout Info →
                </a>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full inline-flex min-h-[48px] items-center justify-center cursor-pointer rounded-full bg-purple-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-purple-800 focus-visible:outline-2 focus-visible:outline-purple-500 disabled:opacity-50"
            >
              {submitting ? 'Creating...' : `Pay $${totalCost} with REDO`}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
