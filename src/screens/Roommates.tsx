import React, { useMemo, useState } from 'react';
import { useConvexAuth } from 'convex/react';
import { useCities } from '../data/hooks';
import {
  useMyRoommateProfile, useRoommateActions, useRoommateConnections, useRoommateMatches, useRoommateRequests,
} from '../data/roommatesHooks';
import ProfileForm from '../components/roommates/ProfileForm';
import MatchCard from '../components/roommates/MatchCard';
import RequestsInbox from '../components/roommates/RequestsInbox';
import ConnectionList from '../components/roommates/ConnectionList';
import { Button, PageHeader, Skeleton } from '../components/ui';
import type { ProfileDraft } from '../components/roommates/types';

function Loading() {
  return (
    <main aria-busy="true" className="mx-auto max-w-2xl space-y-stack px-gutter py-section">
      <Skeleton className="h-10 w-56" />
      <Skeleton className="h-64 w-full" />
    </main>
  );
}

/** `onSignIn` opens the accounts modal; wired at integration. */
export default function Roommates({ onSignIn }: { onSignIn?: () => void }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  if (isLoading) return <Loading />;
  if (!isAuthenticated) {
    return (
      <main className="mx-auto max-w-2xl space-y-stack px-gutter py-section">
        <PageHeader
          title="Roommate finder"
          description="Sign in to create an optional roommate profile and see people with a similar budget, towns and move-in date."
        />
        <Button onClick={onSignIn}>Sign in or create an account</Button>
      </main>
    );
  }
  return <SignedIn />;
}

function SignedIn() {
  const cities = useCities();
  const mine = useMyRoommateProfile();
  const matches = useRoommateMatches();
  const requests = useRoommateRequests();
  const connections = useRoommateConnections();
  const act = useRoommateActions();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<Set<string>>(new Set());
  const towns = useMemo(() => new Map((cities ?? []).map((c) => [c.id, c.name])), [cities]);

  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message.replace(/^.*Uncaught Error:\s*/s, '').split('\n')[0] : 'Something went wrong.'); }
  };

  if (mine === undefined || !cities) return <Loading />;
  return (
    <main className="mx-auto max-w-2xl space-y-section px-gutter py-section">
      <PageHeader title="Roommate finder" />
      <ProfileForm
        key={mine?.profileId ?? 'new'}
        initial={mine}
        towns={cities}
        error={error}
        onSave={(d: ProfileDraft) => run(() => act.upsert(d))}
        onSetActive={(a) => run(() => act.setActive({ active: a }))}
        onDelete={() => run(() => act.remove({}))}
      />
      {mine && (
        <>
          <RequestsInbox requests={requests ?? []} towns={towns} onRespond={(connectionId, accept) => run(() => act.respond({ connectionId, accept }))} />
          <ConnectionList connections={connections ?? []} towns={towns} />
          <section aria-labelledby="match-h" className="space-y-stack">
            <h2 id="match-h" className="font-display text-title text-text">Your matches</h2>
            {!mine.active ? <p className="text-small text-text-muted">Your profile is paused. Resume it to see matches.</p>
              : matches === undefined ? <p className="text-small text-text-muted">Loading...</p>
              : matches.length === 0 ? <p className="text-small text-text-muted">No matches yet. Try more towns or a wider budget.</p>
              : (
                <ul className="space-y-stack">
                  {matches.map((m) => (
                    <MatchCard key={m.profileId} match={m} towns={towns} sent={sent.has(m.profileId)}
                      onRequest={(id) => run(async () => { await act.sendRequest({ profileId: id as never }); setSent((s) => new Set(s).add(id)); })} />
                  ))}
                </ul>
              )}
          </section>
        </>
      )}
    </main>
  );
}
