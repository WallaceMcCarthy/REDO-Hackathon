import React, { useEffect, useState } from 'react';
import { useConvexAuth } from 'convex/react';
import { AD_CATEGORIES } from '../../../convex/lib/adCategories';
import { DEFAULT_AD_DAYS, FREE_AD_DAYS, priceCents } from '../../../convex/lib/pricing';
import { ConvexError } from 'convex/values';
import { openSignIn } from '../auth/AccountMenu';
import { useConfirmCheckout, useCreateCheckout, useMyCampaigns, useMyCampaignStats, usePaymentProvider, useResumeCheckout } from '../../data/adsHooks';
import type { City } from '../../types';
import AdImage from './AdImage';
import AdLocationPicker, { type AdLocation } from './AdLocationPicker';
import { campaignPlacement, titleRepeatsMessage } from './campaignPlacement';
import { Badge, Button, Card, EmptyState, Field, Input, PageHeader, Segmented, Skeleton, Textarea } from '../ui';

const KINDS = [
  { value: 'pin', label: 'Map pin' },
  { value: 'featured', label: 'Featured' },
  { value: 'job', label: 'Job pin' },
] as const;

interface AdvertiserDashboardProps {
  cities: City[];
  onBack: () => void;
}

export default function AdvertiserDashboard({ cities, onBack }: AdvertiserDashboardProps) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const signedOut = !isLoading && !isAuthenticated;
  const campaigns = useMyCampaigns();
  const dailyStats = useMyCampaignStats();
  const createCheckout = useCreateCheckout();
  const resumeCheckout = useResumeCheckout();
  const provider = usePaymentProvider();
  const isStripe = provider === 'stripe';
  const hashParams = new URLSearchParams(window.location.hash.split('?')[1] ?? '');
  const paidSessionId = hashParams.get('paid');
  const returnedPaid = hashParams.has('paid');
  const confirmCheckout = useConfirmCheckout();
  const [confirmStatus, setConfirmStatus] = useState<string | null>(null);
  const returnedCanceled = hashParams.has('canceled');

  const [location, setLocation] = useState<AdLocation | null>(null);
  const [plan, setPlan] = useState<'paid' | 'free'>('paid');
  const [body, setBody] = useState('');
  const [url, setUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resumingId, setResumingId] = useState<string | null>(null);
  const [checkoutNotice, setCheckoutNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!paidSessionId) return;
    let cancelled = false;
    (async () => {
      for (let attempt = 0; attempt < 3 && !cancelled; attempt++) {
        let status: string;
        try {
          status = await confirmCheckout(paidSessionId);
        } catch {
          status = 'error';
        }
        if (cancelled) return;
        setConfirmStatus(status);
        if (status !== 'unpaid' || attempt === 2) return;
        await new Promise((r) => setTimeout(r, 2000));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paidSessionId]);

  const now = Date.now();
  const totalCost = priceCents('pin', DEFAULT_AD_DAYS) / 100;
  const free = isStripe && plan === 'free';

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!location || submitting) return;
    setSubmitting(true);
    setCheckoutNotice(null);

    try {
      const res = await createCheckout({
        ...location,
        body: body.trim(),
        url: url.trim(),
        imageUrl: imageUrl.trim(),
        free,
      });

      if (res?.provider === 'stripe' && res.checkoutUrl) {
        window.location.href = res.checkoutUrl;
        return;
      }
      if (res) {
        setCheckoutNotice('Your ad is live. It is labelled Sponsored and listed under Your campaigns.');
        setLocation(null);
        setBody('');
        setUrl('');
        setImageUrl('');
      }
    } catch (err) {
      setCheckoutNotice(err instanceof ConvexError ? String(err.data) : 'Could not create the campaign. Check that you are signed in and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResume = async (campaignId: string) => {
    if (resumingId) return;
    setResumingId(campaignId);
    setCheckoutNotice(null);
    try {
      const result = await resumeCheckout(campaignId);
      if (result?.checkoutUrl) window.location.href = result.checkoutUrl;
    } catch (err) {
      setCheckoutNotice(err instanceof ConvexError ? String(err.data) : 'Could not resume checkout. Try again.');
    } finally {
      setResumingId(null);
    }
  };

  return (
    <main className="mx-auto max-w-5xl px-gutter py-section">
      <PageHeader
        title="Advertiser dashboard"
        description="Self-serve local advertising for Utah businesses and employers. Ads always appear labelled Sponsored."
        actions={<Button variant="secondary" size="sm" onClick={onBack}>Back to results</Button>}
      />

      {isStripe && (
        <Card role="note" className="mt-stack bg-surface-sunken">
          <p className="text-small font-semibold text-text">Test mode: use card 4242 4242 4242 4242</p>
          <p className="mt-1 text-caption text-text-muted">
            Payments run through Stripe test mode, so no real money moves. Any future expiry and any CVC work.
          </p>
        </Card>
      )}

      {returnedPaid && (
        <Card role="status" className="mt-stack">
          <p className="text-small font-semibold text-text">
            {confirmStatus === 'active'
              ? 'Payment confirmed. Your ad is live.'
              : confirmStatus === 'unpaid'
                ? 'Payment not completed yet, so we could not confirm it. Check back shortly.'
                : confirmStatus === 'not_found'
                  ? 'We could not find that checkout for your account.'
                  : confirmStatus === 'error'
                    ? 'Payment received, but we could not confirm it just now. Your ad goes live once confirmed.'
                    : 'Payment received. Confirming with Stripe...'}
          </p>
        </Card>
      )}
      {returnedCanceled && (
        <Card role="status" className="mt-stack">
          <p className="text-small text-text">Checkout canceled. You were not charged. To run this ad, fill in the form again.</p>
        </Card>
      )}

      <div className="mt-section grid gap-section lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section aria-labelledby="campaigns-heading" className="min-w-0 space-y-stack">
          <h2 id="campaigns-heading" className="font-display text-title text-text">Your campaigns</h2>

          {signedOut ? (
            <EmptyState title="Sign in to see your campaigns" description="You need an account to create and track campaigns." action={<Button onClick={openSignIn}>Sign in</Button>} />
          ) : campaigns === undefined ? (
            <div aria-busy="true" className="space-y-3">
              {[0, 1].map((i) => <Skeleton key={i} className="h-32 w-full" />)}
            </div>
          ) : campaigns.length === 0 ? (
            <EmptyState title="No campaigns yet" description="Create your first campaign with the form." />
          ) : (
            <ul className="space-y-3">
              {campaigns.map((c) => {
                const ctr = c.impressions > 0 ? ((c.clicks / c.impressions) * 100).toFixed(1) : '0.0';
                const townName = cities.find((t) => t.id === c.cityId)?.name;
                const placement = campaignPlacement(c, townName, provider, now);
                const stats = dailyStats?.filter((row) => row.campaignId === c._id) ?? [];
                const townViews = stats.filter((row) => row.surface === 'town_highlights').reduce((sum, row) => sum + row.impressions, 0);
                const resultViews = stats.filter((row) => row.surface === 'results_featured').reduce((sum, row) => sum + row.impressions, 0);
                return (
                  <Card as="li" key={c._id}>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge>{KINDS.find((k) => k.value === c.kind)?.label ?? c.kind}</Badge>
                      {c.isSample && <Badge tone="sample" />}
                      <Badge>{AD_CATEGORIES[c.category ?? 'other'].label}</Badge>
                      <Badge>{c.cityId ? townName ?? c.cityId : 'All Utah towns'}</Badge>
                    </div>
                    <div className="mt-2 flex min-w-0 gap-3">
                      <AdImage campaign={c} />
                      <h3 className="min-w-0 break-words font-semibold text-text">{titleRepeatsMessage(c) ? c.body : c.title}</h3>
                    </div>
                    <div className="mt-2 rounded-control bg-surface-sunken p-3">
                      <p className="text-small font-semibold text-text">{placement.label}</p>
                      <p className="mt-1 text-small text-text">{placement.text}</p>
                      {placement.next && <p className="mt-1 text-small text-text-muted">{placement.next}</p>}
                      {isStripe && c.status === 'pending_payment' && (
                        <Button size="sm" className="mt-2" disabled={resumingId === c._id} onClick={() => void handleResume(c._id)}>
                          {resumingId === c._id ? 'Opening checkout…' : 'Resume checkout'}
                        </Button>
                      )}
                      {placement.link && (
                        <a href={placement.link.href} className="mt-1 inline-flex min-h-11 items-center text-small text-alpine-700 underline underline-offset-2">{placement.link.label}</a>
                      )}
                    </div>
                    <dl className="mt-2 grid grid-cols-2 gap-2 text-caption text-text-muted sm:grid-cols-4">
                      <div><dt>Spend</dt><dd className="font-semibold text-text">{c.expectedAmount ? `$${(c.expectedAmount / 100).toFixed(2)}` : 'No charge'}</dd></div>
                      <div><dt>Started</dt><dd className="font-semibold text-text">{new Date(c.startsAt).toLocaleDateString()}</dd></div>
                      <div><dt>Town views</dt><dd className="font-semibold text-text">{townViews}</dd></div>
                      <div><dt>Results views</dt><dd className="font-semibold text-text">{resultViews}</dd></div>
                    </dl>
                    {!titleRepeatsMessage(c) && <p className="mt-2 line-clamp-2 break-words text-small text-text-muted">{c.body}</p>}
                    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 border-t border-border pt-3 text-small sm:grid-cols-4">
                      <div><dt className="text-text-muted">Views</dt><dd className="font-semibold text-text">{c.impressions}</dd></div>
                      <div><dt className="text-text-muted">Clicks</dt><dd className="font-semibold text-text">{c.clicks}</dd></div>
                      <div><dt className="text-text-muted">Click rate</dt><dd className="font-semibold text-text">{ctr}%</dd></div>
                      <div><dt className="text-text-muted">Ends</dt><dd className="font-semibold text-text">{new Date(c.endsAt).toLocaleDateString()}</dd></div>
                    </dl>
                  </Card>
                );
              })}
            </ul>
          )}
          <p className="text-caption text-text-muted">
            Views and clicks count each visitor once an hour. Your own views do not count.
          </p>
        </section>

        <Card as="section" raised aria-labelledby="create-heading" className="self-start">
          <h2 id="create-heading" className="font-display text-title text-text">Create a campaign</h2>
          <p className="mt-1 text-small text-text-muted">Your image and message sit on the map at your pin, labelled Sponsored. A click opens your link.</p>

          {signedOut && (
            <div className="mt-stack rounded-control bg-surface-sunken p-3">
              <p className="text-small font-semibold text-text">Sign in to publish your ad</p>
              <p className="mt-1 text-small text-text-muted">You can fill in the form first. What you type stays here while you sign in.</p>
              <Button variant="secondary" size="sm" className="mt-2" onClick={openSignIn}>Sign in</Button>
            </div>
          )}

          <form onSubmit={handleCreate} className="mt-stack space-y-stack">
            <AdLocationPicker cities={cities} value={location} onChange={setLocation} />

            <Field label="Image URL" hint="Shown in a circle on the map. Must start with https://">
              <Input type="url" required maxLength={500} value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://example.com/photo.jpg" />
            </Field>

            <Field label="Message">
              <Textarea required minLength={5} maxLength={300} rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Short pitch or offer" />
            </Field>

            <Field label="Link" hint="Must start with https://">
              <Input type="url" required maxLength={500} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/promo" />
            </Field>

            {isStripe ? (
              <div className="space-y-2">
                <Segmented
                  label="Payment" value={plan} onChange={setPlan}
                  options={[{ value: 'paid', label: `$${totalCost}, ${DEFAULT_AD_DAYS} days` }, { value: 'free', label: `Free, ${FREE_AD_DAYS} day` }]}
                />
                <p className="rounded-control bg-surface-sunken p-3 text-caption text-text-muted">
                  {free
                    ? `No payment. Your ad goes live at once for ${FREE_AD_DAYS} day. You can publish 3 free ads every 24 hours.`
                    : 'Billed securely via Stripe (test mode).'}
                </p>
              </div>
            ) : provider === 'none' && (
              <p className="rounded-control bg-surface-sunken p-3 text-small text-text">
                No payment needed. Your ad goes live as soon as you publish it and runs for {DEFAULT_AD_DAYS} days. You can have up to 5 live ads at a time.
              </p>
            )}

            {checkoutNotice && (
              <p role="status" className="rounded-control border border-border-strong bg-surface-sunken p-3 text-small text-text">{checkoutNotice}</p>
            )}

            {signedOut ? (
              <Button fullWidth onClick={openSignIn}>Sign in to continue</Button>
            ) : (
              <Button type="submit" fullWidth loading={submitting} disabled={provider === undefined}>
                {submitting ? 'Publishing...' : isStripe && !free ? `Pay $${totalCost} with Stripe` : 'Publish ad'}
              </Button>
            )}
          </form>
        </Card>
      </div>
    </main>
  );
}
