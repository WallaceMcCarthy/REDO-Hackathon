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
import type { ProfileDraft } from '../components/roommates/types';

/** `onSignIn` opens the accounts modal; wired at integration. */
export default function Roommates({ onSignIn }: { onSignIn?: () => void }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  if (isLoading) return <p className="p-4 text-dusk">Loading...</p>;
  if (!isAuthenticated) {
    return (
      <main className="mx-auto max-w-2xl space-y-3 p-4">
        <h1 className="font-display text-3xl font-bold text-ink">Roommate finder</h1>
        <p className="text-dusk">Sign in to create an optional roommate profile and see people with a similar budget, towns and move-in date.</p>
        <button type="button" onClick={onSignIn} className="min-h-[44px] rounded-lg bg-alpine-500 px-4 text-sm font-semibold text-white hover:bg-alpine-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-alpine-700 focus-visible:ring-offset-2">
          Sign in or create an account
        </button>
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
  const [notice, setNotice] = useState<string | null>(null);
  const towns = useMemo(() => new Map((cities ?? []).map((c) => [c.id, c.name])), [cities]);

  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    setNotice(null);
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message.replace(/^.*Uncaught Error:\s*/s, '').split('\n')[0] : 'Something went wrong.'); }
  };

  if (mine === undefined || !cities) return <p className="p-4 text-dusk">Loading...</p>;
  return (
    <main className="mx-auto max-w-2xl space-y-6 p-4">
      <h1 className="font-display text-3xl font-bold text-ink">Roommate finder</h1>
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
          <section aria-labelledby="match-h" className="space-y-3">
            <h2 id="match-h" className="font-display text-2xl font-bold text-ink">Your matches</h2>
            {notice && <p role="status" className="text-sm font-semibold text-alpine-700">{notice}</p>}
            {!mine.active ? <p className="text-sm text-dusk">Your profile is paused. Resume it to see matches.</p>
              : matches === undefined ? <p className="text-sm text-dusk">Loading...</p>
              : matches.length === 0 ? <p className="text-sm text-dusk">No matches yet. Try more towns or a wider budget.</p>
              : (
                <ul className="space-y-3">
                  {matches.map((m) => (
                    <MatchCard key={m.profileId} match={m} towns={towns}
                      onRequest={(id) => run(async () => { await act.sendRequest({ profileId: id as never }); setNotice('Request sent. Their contact appears under Connected if they accept.'); })} />
                  ))}
                </ul>
              )}
          </section>
        </>
      )}
    </main>
  );
}
