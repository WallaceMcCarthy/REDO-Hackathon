import React from 'react';
import { dateLabel, money, tagLabel, townNames, type PublicProfile } from './types';
import SampleBadge from './SampleBadge';

/** Shared header for match, request and connection cards. Never renders contact. */
export default function ProfileCard({ p, towns, children }: { p: PublicProfile; towns: Map<string, string>; children?: React.ReactNode }) {
  return (
    <li className="space-y-2 rounded-xl border border-rock-100 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-display text-lg font-bold text-ink">Roommate seeker</h3>
        {p.isSample && <SampleBadge />}
      </div>
      <p className="text-sm text-dusk">
        {money(p.budgetMin)} to {money(p.budgetMax)} a month, moving {dateLabel(p.moveIn)}
      </p>
      <p className="text-sm text-dusk">Towns: {townNames(p.cityIds, towns)}</p>
      {p.tags.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Lifestyle">
          {p.tags.map((t) => (
            <li key={t} className="rounded-full bg-alpine-50 px-2 py-0.5 text-xs text-alpine-700">{tagLabel(t)}</li>
          ))}
        </ul>
      )}
      {p.bio && <p className="whitespace-pre-line text-sm text-ink">{p.bio}</p>}
      {children}
    </li>
  );
}
