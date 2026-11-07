import React from 'react';
import { Badge, Card } from '../ui';
import { dateLabel, money, tagLabel, townNames, type PublicProfile } from './types';

/** Shared header for match, request and connection cards. Never renders contact. */
export default function ProfileCard({ p, towns, children }: { p: PublicProfile; towns: Map<string, string>; children?: React.ReactNode }) {
  return (
    <Card as="li" className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-display text-title text-text">Roommate seeker</h3>
        {p.isSample && <Badge tone="sample" />}
      </div>
      <p className="text-small text-text-muted">
        {money(p.budgetMin)} to {money(p.budgetMax)} a month, moving {dateLabel(p.moveIn)}
      </p>
      <p className="break-words text-small text-text-muted">Towns: {townNames(p.cityIds, towns)}</p>
      {p.tags.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Lifestyle">
          {p.tags.map((t) => <li key={t}><Badge>{tagLabel(t)}</Badge></li>)}
        </ul>
      )}
      {p.bio && <p className="whitespace-pre-line break-words text-body text-text">{p.bio}</p>}
      {children}
    </Card>
  );
}
