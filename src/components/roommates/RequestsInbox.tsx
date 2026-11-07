import React from 'react';
import { Button } from '../ui';
import ProfileCard from './ProfileCard';
import type { Request } from './types';

interface Props { requests: Request[]; towns: Map<string, string>; onRespond: (connectionId: string, accept: boolean) => void }

export default function RequestsInbox({ requests, towns, onRespond }: Props) {
  return (
    <section aria-labelledby="inbox-h" className="space-y-stack">
      <h2 id="inbox-h" className="font-display text-title text-text">Requests to you</h2>
      {requests.length === 0 ? (
        <p className="text-small text-text-muted">No pending requests.</p>
      ) : (
        <ul className="space-y-3">
          {requests.map((r) => (
            <ProfileCard key={r.connectionId} p={r} towns={towns}>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => onRespond(r.connectionId, true)}>Accept</Button>
                <Button size="sm" variant="secondary" onClick={() => onRespond(r.connectionId, false)}>Decline</Button>
              </div>
            </ProfileCard>
          ))}
        </ul>
      )}
    </section>
  );
}
