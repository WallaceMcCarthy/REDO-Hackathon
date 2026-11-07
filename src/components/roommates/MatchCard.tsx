import React from 'react';
import ProfileCard from './ProfileCard';
import { tagLabel, townNames, type Match } from './types';

interface Props { match: Match; towns: Map<string, string>; onRequest: (profileId: string) => void }

export default function MatchCard({ match, towns, onRequest }: Props) {
  return (
    <ProfileCard p={match} towns={towns}>
      <p className="text-sm font-semibold text-alpine-700">{match.score}% match</p>
      <ul className="list-disc pl-5 text-sm text-dusk">
        {match.reasons.map((r) => <li key={r}>{r}</li>)}
      </ul>
      {match.sharedCityIds.length > 0 && <p className="text-sm text-dusk">Shared towns: {townNames(match.sharedCityIds, towns)}</p>}
      {match.sharedTags.length > 0 && <p className="text-sm text-dusk">Shared habits: {match.sharedTags.map(tagLabel).join(', ')}</p>}
      <button
        type="button"
        onClick={() => onRequest(match.profileId)}
        className="min-h-[44px] rounded-lg bg-alpine-500 px-4 text-sm font-semibold text-white hover:bg-alpine-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-alpine-700 focus-visible:ring-offset-2"
      >
        Request to connect
      </button>
    </ProfileCard>
  );
}
