import { useAction, useConvexAuth } from 'convex/react';
import { useResilientQuery as useQuery } from './resilient';
import { api } from '../../convex/_generated/api';

export function usePreferenceAssistant() {
  const { isAuthenticated } = useConvexAuth();
  const availability = useQuery(api.jev.availability, {});
  const run = useAction(api.jev.suggest);
  return { enabled: availability?.enabled ?? false, isAuthenticated, run };
}
