import { useCallback } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';

export interface CampaignRecord {
  _id: string;
  kind: 'pin' | 'featured' | 'job';
  title: string;
  body: string;
  url: string;
  lat?: number;
  lng?: number;
  listingId?: string;
  cityId?: string;
  startsAt: number;
  endsAt: number;
  status: 'pending_payment' | 'active' | 'expired';
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

export function useMyCampaigns(): CampaignRecord[] | undefined {
  const queryFn = (api as any).ads?.listMyCampaigns;
  const result = useQuery(queryFn, queryFn ? {} : 'skip');
  return result as CampaignRecord[] | undefined;
}

export function useCreateCampaign() {
  const mutationFn = (api as any).ads?.createCampaign;
  const mutate = useMutation(mutationFn ?? (() => Promise.resolve({ campaignId: '', checkoutUrl: '', amount: 0 })));

  return useCallback(
    async (params: {
      kind: 'pin' | 'featured' | 'job';
      title: string;
      body: string;
      url: string;
      lat?: number;
      lng?: number;
      listingId?: string;
      cityId?: string;
      durationDays: number;
    }) => {
      if (!mutationFn) return null;
      return await mutate(params);
    },
    [mutate, mutationFn],
  );
}

export function useRecordImpression() {
  const mutationFn = (api as any).ads?.recordImpression;
  const mutate = useMutation(mutationFn ?? (() => Promise.resolve()));

  return useCallback(
    async (campaignId: string) => {
      if (!mutationFn) return;
      try {
        await mutate({ campaignId: campaignId as any });
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
    async (campaignId: string) => {
      if (!mutationFn) return;
      try {
        await mutate({ campaignId: campaignId as any });
      } catch {
        // Silently ignore if unauthenticated session
      }
    },
    [mutate, mutationFn],
  );
}
