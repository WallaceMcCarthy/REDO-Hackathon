import React, { useEffect, useState } from 'react';
import { useConvexAuth } from 'convex/react';
import { AD_CATEGORIES, AD_CATEGORY_IDS, type AdCategory } from '../../../convex/lib/adCategories';
import { ConvexError } from 'convex/values';
import { openSignIn } from '../auth/AccountMenu';
import { useConfirmCheckout, useCreateCheckout, useMyCampaigns, usePaymentProvider } from '../../data/adsHooks';
import type { City } from '../../types';
import AdImage from './AdImage';
import { campaignPlacement } from './campaignPlacement';
import { Badge, Button, Card, EmptyState, Field, Input, PageHeader, Segmented, Select, Skeleton, Textarea } from '../ui';

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
  const campaigns = useMyCampaigns();
  const createCheckout = useCreateCheckout();
  const provider = usePaymentProvider();
  const isStripe = provider === 'stripe';
  const hashParams = new URLSearchParams(window.location.hash.split('?')[1] ?? '');
  const paidSessionId = hashParams.get('paid');
  const returnedPaid = hashParams.has('paid');
  const confirmCheckout = useConfirmCheckout();
  const [confirmStatus, setConfirmStatus] = useState<string | null>(null);
  const returnedCanceled = hashParams.has('canceled');

  const [kind, setKind] = useState<'pin' | 'featured' | 'job'>('pin');
  const [category, setCategory] = useState<AdCategory | ''>('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [url, setUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [cityId, setCityId] = useState('');
  const [durationDays, setDurationDays] = useState(7);
  const [submitting, setSubmitting] = useState(false);
  const [checkoutNotice, setCheckoutNotice] = useState<string | null>(null);
  const [pendingCheckoutUrl, setPendingCheckoutUrl] = useState<string | null>(null);

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

  const selectedCity = cities.find((c) => c.id === cityId);
  const now = Date.now();

  // Rate card: Map pin = $5/day ($500 cents), Featured = $10/day ($1000 cents), Job = $7/day ($700 cents)
  const ratePerDay = kind === 'featured' ? 10 : kind === 'job' ? 7 : 5;
  const totalCost = ratePerDay * durationDays;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!category || !title.trim() || !url.trim() || submitting) return;
    setSubmitting(true);
    setCheckoutNotice(null);
    setPendingCheckoutUrl(null);

    try {
      const res = await createCheckout({
        kind,
        category,
        title: title.trim(),
        body: body.trim(),
        url: url.trim(),
        imageUrl: imageUrl.trim() || undefined,
        lat: selectedCity?.lat,
        lng: selectedCity?.lng,
        cityId: cityId || undefined,
        durationDays,
      });

      if (res?.provider === 'stripe' && res.checkoutUrl) {
        window.location.href = res.checkoutUrl;
        return;
      }
      if (res?.checkoutUrl) {
        setPendingCheckoutUrl(res.checkoutUrl);
        setCheckoutNotice(
          'Campaign created as pending payment. Nothing was charged and it is not live.'
        );
        // Clear form
        setCategory('');
        setTitle('');
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

  return (
    <main className="mx-auto max-w-5xl px-gutter py-section">
      <PageHeader
        title="Advertiser dashboard"
        description="Self-serve local advertising for Utah businesses and employers. Ads always appear labelled Sponsored."
        actions={<Button variant="secondary" size="sm" onClick={onBack}>Back to results</Button>}
      />

      {isStripe ? (
        <Card role="note" className="mt-stack bg-surface-sunken">
          <p className="text-small font-semibold text-text">Test mode: use card 4242 4242 4242 4242</p>
          <p className="mt-1 text-caption text-text-muted">
            Payments run through Stripe test mode, so no real money moves. Any future expiry and any CVC work.
          </p>
        </Card>
      ) : (
        <Card role="note" className="mt-stack bg-surface-sunken">
          <p className="text-small font-semibold text-text">Sandbox: REDO payments are not connected yet. No charge is made.</p>
          <p className="mt-1 text-caption text-text-muted">
            Campaigns stay in pending payment and never go live until the backend receives a verified REDO webhook.
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
          <p className="text-small text-text">Checkout canceled. Your campaign stays pending until paid.</p>
        </Card>
      )}

      <div className="mt-section grid gap-section lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section aria-labelledby="campaigns-heading" className="min-w-0 space-y-stack">
          <h2 id="campaigns-heading" className="font-display text-title text-text">Your campaigns</h2>

          {!isLoading && !isAuthenticated ? (
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
                      <h3 className="min-w-0 break-words font-semibold text-text">{c.title}</h3>
                    </div>
                    <div className="mt-2 rounded-control bg-surface-sunken p-3">
                      <p className="text-small font-semibold text-text">{placement.label}</p>
                      <p className="mt-1 text-small text-text">{placement.text}</p>
                      {placement.next && <p className="mt-1 text-small text-text-muted">{placement.next}</p>}
                      {placement.link && (
                        <a href={placement.link.href} className="mt-1 inline-flex min-h-11 items-center text-small text-alpine-700 underline underline-offset-2">{placement.link.label}</a>
                      )}
                    </div>
                    <p className="mt-2 line-clamp-2 break-words text-small text-text-muted">{c.body}</p>
                    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 border-t border-border pt-3 text-small sm:grid-cols-4">
                      <div><dt className="text-text-muted">Impressions</dt><dd className="font-semibold text-text">{c.impressions}</dd></div>
                      <div><dt className="text-text-muted">Clicks</dt><dd className="font-semibold text-text">{c.clicks}</dd></div>
                      <div><dt className="text-text-muted">CTR</dt><dd className="font-semibold text-text">{ctr}%</dd></div>
                      <div><dt className="text-text-muted">Ends</dt><dd className="font-semibold text-text">{new Date(c.endsAt).toLocaleDateString()}</dd></div>
                    </dl>
                  </Card>
                );
              })}
            </ul>
          )}
          <p className="text-caption text-text-muted">
            Impressions and clicks are tracked server-side for authenticated visitors. Self-views are excluded.
          </p>
        </section>

        <Card as="section" raised aria-labelledby="create-heading" className="self-start">
          <h2 id="create-heading" className="font-display text-title text-text">Create a campaign</h2>
          <p className="mt-1 text-small text-text-muted">Any Utah business or employer can reach people researching a town.</p>

          <form onSubmit={handleCreate} className="mt-stack space-y-stack">
            <Field label="Location" hint={`Shown in the Sponsored section of ${selectedCity ? `the ${selectedCity.name} town page` : 'every town page'} once payment is verified.`}>
              <Select value={cityId} onChange={(e) => setCityId(e.target.value)}>
                <option value="">All Utah towns</option>
                {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>

            <Field label="Image URL" hint="Optional. HTTPS only.">
              <Input type="url" maxLength={500} value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://example.com/photo.jpg" />
            </Field>

            <Field label="Business name">
              <Input type="text" required minLength={3} maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Your business" />
            </Field>

            <Field label="Message">
              <Textarea required minLength={5} maxLength={300} rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Short pitch or offer" />
            </Field>

            <Field label="Link" hint="HTTPS only.">
              <Input type="url" required maxLength={500} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/promo" />
            </Field>

            <Field label="Business category">
              <Select required value={category} onChange={(e) => setCategory(e.target.value as AdCategory | '')}>
                <option value="" disabled>Choose a category</option>
                {AD_CATEGORY_IDS.map((id) => <option key={id} value={id}>{AD_CATEGORIES[id].label}</option>)}
              </Select>
            </Field>

            <div>
              <p className="mb-1.5 text-small font-semibold text-text">Ad type</p>
              <Segmented label="Ad type" options={KINDS} value={kind} onChange={setKind} />
            </div>

            <Field label="Duration">
              <Select value={durationDays} onChange={(e) => setDurationDays(Number(e.target.value))}>
                <option value={7}>7 days (${ratePerDay * 7})</option>
                <option value={14}>14 days (${ratePerDay * 14})</option>
                <option value={30}>30 days (${ratePerDay * 30})</option>
              </Select>
            </Field>

            <div className="rounded-control bg-surface-sunken p-3 text-small">
              <div className="flex justify-between font-semibold text-text">
                <span>Listed price</span>
                <span>${totalCost}.00 USD</span>
              </div>
              <p className="mt-1 text-caption text-text-muted">
                {isStripe ? 'Billed securely via Stripe (test mode).' : 'Not charged yet. REDO is not connected.'}
              </p>
            </div>

            {checkoutNotice && (
              <p role="status" className="rounded-control border border-border-strong bg-surface-sunken p-3 text-small text-text">{checkoutNotice}</p>
            )}

            {pendingCheckoutUrl && (
              <Button href={pendingCheckoutUrl} variant="secondary" fullWidth>View sandbox checkout info</Button>
            )}

            <Button type="submit" fullWidth loading={submitting}>
              {submitting ? 'Creating...' : isStripe ? `Pay $${totalCost} with Stripe` : 'Create campaign (pending payment)'}
            </Button>
          </form>
        </Card>
      </div>
    </main>
  );
}
