import { useCallback } from 'react';
import { useResilientQuery as useQuery } from './resilient';
import { useConvexAuth, useAction, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { AdCategory } from '../../convex/lib/adCategories';

export interface CampaignRecord {
  _id: string;
  kind: 'pin' | 'featured' | 'job';
  category?: AdCategory;
  title: string;
  body: string;
  url: string;
  imageUrl?: string;
  lat?: number;
  lng?: number;
  listingId?: string;
  cityId?: string;
  startsAt: number;
  endsAt: number;
  status: 'pending_payment' | 'pending_review' | 'active' | 'expired';
  redoPaymentId?: string;
  impressions: number;
  clicks: number;
  isSample?: boolean;
  expectedAmount?: number;
  expectedCurrency?: string;
}

export function useActivePins(cityId?: string): CampaignRecord[] | undefined {
  const queryFn = (api as any).ads?.getActivePins;
  const result = useQuery(queryFn, queryFn ? { cityId } : 'skip');
  return result as CampaignRecord[] | undefined;
}

export function useActiveFeatured(cityId?: string): CampaignRecord[] | undefined {
  const queryFn = (api as any).ads?.getActiveFeatured;
  const result = useQuery(queryFn, queryFn ? { cityId } : 'skip');
  return result as CampaignRecord[] | undefined;
}

/** Every active campaign shown for a town, featured first. Undefined while loading. */
export function useTownCampaigns(cityId: string): CampaignRecord[] | undefined {
  const pins = useActivePins(cityId);
  const featured = useActiveFeatured(cityId);
  return pins && featured ? [...featured, ...pins] : undefined;
}

export function useMyCampaigns(): CampaignRecord[] | undefined {
  const { isAuthenticated } = useConvexAuth();
  const queryFn = (api as any).ads?.listMyCampaigns;
  // The query throws for signed-out visitors, which would take the whole app down.
  const result = useQuery(queryFn, queryFn && isAuthenticated ? {} : 'skip');
  return result as CampaignRecord[] | undefined;
}

export function useDeleteCampaign() {
  const mutationFn = (api as any).ads?.deleteCampaign;
  const mutate = useMutation(mutationFn ?? (() => Promise.resolve()));
  return useCallback(async (campaignId: string) => {
    if (!mutationFn) return;
    await mutate({ campaignId: campaignId as any });
  }, [mutate, mutationFn]);
}

export interface CampaignDailyStat {
  campaignId: string;
  day: number;
  surface: 'results_featured' | 'town_highlights' | 'unknown';
  pageTownId?: string;
  impressions: number;
  clicks: number;
}

export function useMyCampaignStats(): CampaignDailyStat[] | undefined {
  const { isAuthenticated } = useConvexAuth();
  const queryFn = (api as any).ads?.listMyCampaignStats;
  return useQuery(queryFn, queryFn && isAuthenticated ? {} : 'skip') as CampaignDailyStat[] | undefined;
}

export function useCreateCheckout() {
  const actionFn = (api as any).ads?.createCheckout;
  const run = useAction(actionFn ?? (() => Promise.resolve({ campaignId: '', checkoutUrl: '', amount: 0, provider: 'none' })));

  return useCallback(
    async (params: { body: string; url: string; imageUrl: string; lat: number; lng: number; free?: boolean }) => {
      if (!actionFn) return null;
      return (await run(params)) as { campaignId: string; checkoutUrl: string; amount: number; provider: 'none' | 'stripe' };
    },
    [run, actionFn],
  );
}

export function useResumeCheckout() {
  const actionFn = (api as any).ads?.resumeCheckout;
  const run = useAction(actionFn ?? (() => Promise.resolve({ checkoutUrl: '', amount: 0 })));
  return useCallback(async (campaignId: string) => {
    if (!actionFn) return null;
    return (await run({ campaignId: campaignId as any })) as { checkoutUrl: string; amount: number };
  }, [run, actionFn]);
}

export type ConfirmStatus = 'active' | 'unpaid' | 'not_found' | 'error';

export function useConfirmCheckout() {
  const actionFn = (api as any).ads?.confirmCheckout;
  const run = useAction(actionFn ?? (() => Promise.resolve({ status: 'error' })));
  return useCallback(
    async (sessionId: string): Promise<ConfirmStatus> => {
      if (!actionFn) return 'error';
      return ((await run({ sessionId })) as { status: ConfirmStatus }).status;
    },
    [run, actionFn],
  );
}

export function usePaymentProvider(): 'none' | 'stripe' | undefined {
  const queryFn = (api as any).ads?.paymentProvider;
  const result = useQuery(queryFn, queryFn ? {} : 'skip') as { provider: 'none' | 'stripe' } | undefined;
  return result?.provider;
}

let memoryViewerKey: string | null = null;
const newKey = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().replace(/-/g, '')
    : Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');

/** One anonymous viewer key per browser; falls back to an in-memory key if storage is unavailable. */
export function getViewerKey(): string {
  try {
    const existing = localStorage.getItem('utahfit-viewer');
    if (existing && /^[A-Za-z0-9_-]{8,64}$/.test(existing)) return existing;
    const key = newKey();
    localStorage.setItem('utahfit-viewer', key);
    return key;
  } catch {
    return (memoryViewerKey ??= newKey());
  }
}

export function useRecordImpression() {
  const mutationFn = (api as any).ads?.recordImpression;
  const mutate = useMutation(mutationFn ?? (() => Promise.resolve()));

  return useCallback(
    async (campaignId: string, surface?: 'results_featured' | 'town_highlights', pageTownId?: string) => {
      if (!mutationFn) return;
      try {
        await mutate({ campaignId: campaignId as any, viewerKey: getViewerKey(), surface, pageTownId });
      } catch {
        // Silently ignore if unauthenticated session
      }
    },
    [mutate, mutationFn],
  );
}

export function useRecordClick() {
  const mutationFn = (api as any).ads?.recordClick;
  const mutate = useMutation(mutationFn ?? (() => Promise.resolve()));

  return useCallback(
    async (campaignId: string, surface?: 'results_featured' | 'town_highlights', pageTownId?: string) => {
      if (!mutationFn) return;
      try {
        await mutate({ campaignId: campaignId as any, viewerKey: getViewerKey(), surface, pageTownId });
      } catch {
        // Silently ignore if unauthenticated session
      }
    },
    [mutate, mutationFn],
  );
}
