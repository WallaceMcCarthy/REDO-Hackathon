import React from 'react';
import ProfileCard from './ProfileCard';
import type { Request } from './types';

interface Props { requests: Request[]; towns: Map<string, string>; onRespond: (connectionId: string, accept: boolean) => void }

const btn = 'min-h-[44px] rounded-lg px-4 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-alpine-700 focus-visible:ring-offset-2';

export default function RequestsInbox({ requests, towns, onRespond }: Props) {
  return (
    <section aria-labelledby="inbox-h" className="space-y-3">
      <h2 id="inbox-h" className="font-display text-2xl font-bold text-ink">Requests to you</h2>
      {requests.length === 0 ? (
        <p className="text-sm text-dusk">No pending requests.</p>
      ) : (
        <ul className="space-y-3">
          {requests.map((r) => (
            <ProfileCard key={r.connectionId} p={r} towns={towns}>
              <div className="flex gap-2">
                <button type="button" onClick={() => onRespond(r.connectionId, true)} className={`${btn} bg-alpine-500 text-white hover:bg-alpine-700`}>Accept</button>
                <button type="button" onClick={() => onRespond(r.connectionId, false)} className={`${btn} border border-rock-300 bg-white text-rock-800 hover:bg-rock-50`}>Decline</button>
              </div>
            </ProfileCard>
          ))}
        </ul>
      )}
    </section>
  );
}
