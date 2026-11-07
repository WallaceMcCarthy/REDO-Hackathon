import React from 'react';
import { Button } from '../ui';
import ProfileCard from './ProfileCard';
import { tagLabel, townNames, type Match } from './types';

interface Props { match: Match; towns: Map<string, string>; onRequest: (profileId: string) => void }

export default function MatchCard({ match, towns, onRequest }: Props) {
  return (
    <ProfileCard p={match} towns={towns}>
      <p className="text-small font-semibold text-primary-hover">{match.score}% match</p>
      <ul className="list-disc pl-5 text-small text-text-muted">
        {match.reasons.map((r) => <li key={r}>{r}</li>)}
      </ul>
      {match.sharedCityIds.length > 0 && <p className="break-words text-small text-text-muted">Shared towns: {townNames(match.sharedCityIds, towns)}</p>}
      {match.sharedTags.length > 0 && <p className="text-small text-text-muted">Shared habits: {match.sharedTags.map(tagLabel).join(', ')}</p>}
      <Button size="sm" onClick={() => onRequest(match.profileId)}>Request to connect</Button>
    </ProfileCard>
  );
}
