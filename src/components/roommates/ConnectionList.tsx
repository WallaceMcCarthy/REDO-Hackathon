import React from 'react';
import ProfileCard from './ProfileCard';
import type { Connected } from './types';

export default function ConnectionList({ connections, towns }: { connections: Connected[]; towns: Map<string, string> }) {
  return (
    <section aria-labelledby="conn-h" className="space-y-3">
      <h2 id="conn-h" className="font-display text-2xl font-bold text-ink">Connected</h2>
      {connections.length === 0 ? (
        <p className="text-sm text-dusk">Contact details appear here once both of you accept.</p>
      ) : (
        <ul className="space-y-3">
          {connections.map((c) => (
            <ProfileCard key={c.connectionId} p={c} towns={towns}>
              <p className="break-words rounded-lg bg-alpine-50 p-3 text-sm text-alpine-900"><span className="font-semibold">Contact:</span> {c.contact}</p>
            </ProfileCard>
          ))}
        </ul>
      )}
    </section>
  );
}
