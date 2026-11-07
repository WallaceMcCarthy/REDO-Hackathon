import React, { useState } from 'react';
import { LIMITS } from '../../../convex/lib/roommateRules';
import { Button, Card, Chip, Field, Input, Textarea } from '../ui';
import { TAGS, tagLabel, type MyProfile, type ProfileDraft } from './types';

interface Props {
  initial: MyProfile | null;
  towns: { id: string; name: string }[];
  onSave: (draft: ProfileDraft) => void;
  onSetActive?: (active: boolean) => void;
  onDelete?: () => void;
  error?: string | null;
}

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
    <Card as="section" aria-labelledby="pf-h">
    <form
      aria-labelledby="pf-h"
      className="space-y-stack"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ budgetMin: Number(min), budgetMax: Number(max), cityIds, moveIn: Date.parse(moveIn), tags, bio, contact });
      }}
    >
      <div>
        <h2 id="pf-h" className="font-display text-title text-text">{initial ? 'Your roommate profile' : 'Join the roommate finder'}</h2>
        <p className="mt-1 text-small text-text-muted">Optional. Others see your budget, towns, move-in date, habits and bio. Your contact is shared only with people you both accept.</p>
      </div>
      <div className="grid gap-stack sm:grid-cols-3">
        <Field label="Budget min ($/mo)"><Input type="number" inputMode="numeric" min={0} max={LIMITS.maxBudget} value={min} onChange={(e) => setMin(e.target.value)} required /></Field>
        <Field label="Budget max ($/mo)"><Input type="number" inputMode="numeric" min={0} max={LIMITS.maxBudget} value={max} onChange={(e) => setMax(e.target.value)} required /></Field>
        <Field label="Move-in date"><Input type="date" value={moveIn} onChange={(e) => setMoveIn(e.target.value)} required /></Field>
      </div>
      <fieldset>
        <legend className="text-small font-semibold text-text">Towns of interest (pick up to {LIMITS.maxCities})</legend>
        <div className="mt-2 flex max-h-48 flex-wrap gap-2 overflow-y-auto">
          {towns.map((t) => <Chip key={t.id} pressed={cityIds.includes(t.id)} onClick={() => setCityIds(toggle(cityIds, t.id))}>{t.name}</Chip>)}
        </div>
      </fieldset>
      <fieldset>
        <legend className="text-small font-semibold text-text">Lifestyle habits</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {TAGS.map((t) => <Chip key={t} pressed={tags.includes(t)} onClick={() => setTags(toggle(tags, t))}>{tagLabel(t)}</Chip>)}
        </div>
      </fieldset>
      <Field label="Short bio" hint={`${bio.length}/${LIMITS.bio}`}>
        <Textarea rows={3} maxLength={LIMITS.bio} value={bio} onChange={(e) => setBio(e.target.value)} />
      </Field>
      <Field label="Contact" hint="Email or phone. Shown only after you both accept.">
        <Input maxLength={LIMITS.contact} value={contact} onChange={(e) => setContact(e.target.value)} required />
      </Field>
      {error && <p role="alert" className="text-small font-semibold text-danger">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit">{initial ? 'Save profile' : 'Create profile'}</Button>
        {initial && onSetActive && (
          <Button variant="secondary" onClick={() => onSetActive(!initial.active)}>
            {initial.active ? 'Pause (hide me from matches)' : 'Resume'}
          </Button>
        )}
        {initial && onDelete && (
          <Button variant="danger" onClick={() => window.confirm('Delete your profile and all connections? This cannot be undone.') && onDelete()}>
            Delete profile
          </Button>
        )}
      </div>
    </form>
    </Card>
  );
}
