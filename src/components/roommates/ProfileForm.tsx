import React, { useState } from 'react';
import { LIMITS } from '../../../convex/lib/roommateRules';
import { TAGS, tagLabel, type MyProfile, type ProfileDraft } from './types';

interface Props {
  initial: MyProfile | null;
  towns: { id: string; name: string }[];
  onSave: (draft: ProfileDraft) => void;
  onSetActive?: (active: boolean) => void;
  onDelete?: () => void;
  error?: string | null;
}

const field = 'min-h-[44px] w-full rounded-lg border border-rock-300 bg-white px-3 text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-alpine-500';
const toDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export default function ProfileForm({ initial, towns, onSave, onSetActive, onDelete, error }: Props) {
  const [min, setMin] = useState(String(initial?.budgetMin ?? 800));
  const [max, setMax] = useState(String(initial?.budgetMax ?? 1200));
  const [cityIds, setCityIds] = useState<string[]>(initial?.cityIds ?? []);
  const [moveIn, setMoveIn] = useState(toDate(initial?.moveIn ?? Date.now() + 30 * 86_400_000));
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [bio, setBio] = useState(initial?.bio ?? '');
  const [contact, setContact] = useState(initial?.contact ?? '');
  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  return (
    <form
      aria-labelledby="pf-h"
      className="space-y-4 rounded-xl border border-rock-100 bg-white p-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ budgetMin: Number(min), budgetMax: Number(max), cityIds, moveIn: Date.parse(moveIn), tags, bio, contact });
      }}
    >
      <h2 id="pf-h" className="font-display text-2xl font-bold text-ink">{initial ? 'Your roommate profile' : 'Join the roommate finder'}</h2>
      <p className="text-sm text-dusk">Optional. Others see your budget, towns, move-in date, habits and bio. Your contact is shared only with people you both accept.</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block text-sm font-medium text-ink">Budget min ($/mo)
          <input className={field} type="number" inputMode="numeric" min={0} max={LIMITS.maxBudget} value={min} onChange={(e) => setMin(e.target.value)} required />
        </label>
        <label className="block text-sm font-medium text-ink">Budget max ($/mo)
          <input className={field} type="number" inputMode="numeric" min={0} max={LIMITS.maxBudget} value={max} onChange={(e) => setMax(e.target.value)} required />
        </label>
        <label className="block text-sm font-medium text-ink">Move-in date
          <input className={field} type="date" value={moveIn} onChange={(e) => setMoveIn(e.target.value)} required />
        </label>
      </div>
      <fieldset>
        <legend className="text-sm font-medium text-ink">Towns of interest (pick up to {LIMITS.maxCities})</legend>
        <div className="mt-1 flex max-h-40 flex-wrap gap-2 overflow-y-auto">
          {towns.map((t) => (
            <label key={t.id} className="flex min-h-[44px] items-center gap-2 rounded-lg border border-rock-100 px-3 text-sm">
              <input type="checkbox" checked={cityIds.includes(t.id)} onChange={() => setCityIds(toggle(cityIds, t.id))} />
              {t.name}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="text-sm font-medium text-ink">Lifestyle habits</legend>
        <div className="mt-1 flex flex-wrap gap-2">
          {TAGS.map((t) => (
            <label key={t} className="flex min-h-[44px] items-center gap-2 rounded-lg border border-rock-100 px-3 text-sm">
              <input type="checkbox" checked={tags.includes(t)} onChange={() => setTags(toggle(tags, t))} />
              {tagLabel(t)}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block text-sm font-medium text-ink">Short bio ({bio.length}/{LIMITS.bio})
        <textarea className={`${field} py-2`} rows={3} maxLength={LIMITS.bio} value={bio} onChange={(e) => setBio(e.target.value)} />
      </label>
      <label className="block text-sm font-medium text-ink">Contact (email or phone, shown only after you both accept)
        <input className={field} maxLength={LIMITS.contact} value={contact} onChange={(e) => setContact(e.target.value)} required />
      </label>
      {error && <p role="alert" className="text-sm font-semibold text-rock-600">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="min-h-[44px] rounded-lg bg-alpine-500 px-4 text-sm font-semibold text-white hover:bg-alpine-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-alpine-700 focus-visible:ring-offset-2">
          {initial ? 'Save profile' : 'Create profile'}
        </button>
        {initial && onSetActive && (
          <button type="button" onClick={() => onSetActive(!initial.active)} className="min-h-[44px] rounded-lg border border-alpine-500 px-4 text-sm font-semibold text-alpine-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-alpine-700">
            {initial.active ? 'Pause (hide me from matches)' : 'Resume'}
          </button>
        )}
        {initial && onDelete && (
          <button type="button" onClick={() => window.confirm('Delete your profile and all connections? This cannot be undone.') && onDelete()} className="min-h-[44px] rounded-lg border border-rock-500 px-4 text-sm font-semibold text-rock-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-rock-500">
            Delete profile
          </button>
        )}
      </div>
    </form>
  );
}
