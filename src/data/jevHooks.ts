import { useAction, useConvexAuth, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';

export function usePreferenceAssistant() {
  const { isAuthenticated } = useConvexAuth();
  const availability = useQuery(api.jev.availability, {});
  const run = useAction(api.jev.suggest);
  return { enabled: availability?.enabled ?? false, isAuthenticated, run };
}
