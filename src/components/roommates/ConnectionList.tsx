import React from 'react';
import ProfileCard from './ProfileCard';
import type { Connected } from './types';

export default function ConnectionList({ connections, towns }: { connections: Connected[]; towns: Map<string, string> }) {
  return (
    <section aria-labelledby="conn-h" className="space-y-stack">
      <h2 id="conn-h" className="font-display text-title text-text">Connected</h2>
      {connections.length === 0 ? (
        <p className="text-small text-text-muted">Contact details appear here once both of you accept.</p>
      ) : (
        <ul className="space-y-3">
          {connections.map((c) => (
            <ProfileCard key={c.connectionId} p={c} towns={towns}>
              <p className="break-words rounded-control bg-surface-sunken p-3 text-small text-text"><span className="font-semibold">Contact:</span> {c.contact}</p>
            </ProfileCard>
          ))}
        </ul>
      )}
    </section>
  );
}
