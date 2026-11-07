import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Connected, Match, MyProfile, Request } from '../components/roommates/types';

// _generated/api.d.ts lags until `convex dev` regenerates it, so go through any like listingsHooks does.
const r = (api as any).roommates;

export const useMyRoommateProfile = (): MyProfile | null | undefined => useQuery(r.getMine);
export const useRoommateMatches = (): Match[] | undefined => useQuery(r.matches);
export const useRoommateRequests = (): Request[] | undefined => useQuery(r.listRequests);
export const useRoommateConnections = (): Connected[] | undefined => useQuery(r.listConnections);
export const useRoommateActions = () => ({
  upsert: useMutation(r.upsertMine),
  setActive: useMutation(r.setActive),
  remove: useMutation(r.deleteMine),
  sendRequest: useMutation(r.sendRequest),
  respond: useMutation(r.respond),
});
