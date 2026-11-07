import React, { useEffect, useState, type ReactNode } from 'react';
import { useConvexAuth } from 'convex/react';
import { useUpdateProfile, useUserProfile } from '../data/socialHooks';
import { openSignIn } from '../components/auth/AccountMenu';
import { Badge, Button, Card, EmptyState, Field, Input, PageHeader, Select, Skeleton } from '../components/ui';
import type { City } from '../types';

interface AccountProps {
  cities: City[];
  onBack: () => void;
}

type Form = { displayName: string; cityId: string; moveBy: string; budget: string; household: string };
const EMPTY: Form = { displayName: '', cityId: '', moveBy: '', budget: '', household: '' };

type Errors = Partial<Record<keyof Form, string>>;

function validate(f: Form): Errors {
  const errors: Errors = {};
  if (!f.displayName.trim()) errors.displayName = 'Enter a name so we can greet you.';
  if (f.budget !== '' && !(Number(f.budget) >= 0)) errors.budget = 'Enter a budget of $0 or more.';
  const h = Number(f.household);
  if (f.household !== '' && !(Number.isInteger(h) && h >= 1 && h <= 12)) errors.household = 'Household size is a whole number from 1 to 12.';
  return errors;
}

function Section({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <Card as="section" className="min-w-0 space-y-4">
      <div>
        <h2 className="font-display text-title text-text">{title}</h2>
        <p className="text-small text-text-muted">{description}</p>
      </div>
      {children}
    </Card>
  );
}

export default function Account({ cities, onBack }: AccountProps) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const profile = useUserProfile();
  const updateProfile = useUpdateProfile();

  const [form, setForm] = useState<Form>(EMPTY);
  const [saved, setSaved] = useState<Form>(EMPTY);
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!profile) return;
    const next: Form = {
      displayName: profile.displayName || '',
      cityId: profile.cityId || '',
      moveBy: profile.moveBy || '',
      budget: profile.budget == null ? '' : String(profile.budget),
      household: profile.household == null ? '' : String(profile.household),
    };
    setForm(next);
    setSaved(next);
  }, [profile]);

  const set = (key: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setStatusMsg('');
  };
  const errors = showErrors ? validate(form) : {};
  const dirty = (Object.keys(form) as (keyof Form)[]).some((k) => form[k] !== saved[k]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setShowErrors(true);
    if (Object.keys(validate(form)).length) return;
    setSaving(true);
    setStatusMsg('');
    try {
      await updateProfile({
        displayName: form.displayName.trim(),
        cityId: form.cityId || undefined,
        moveBy: form.moveBy || undefined,
        budget: form.budget === '' ? undefined : Number(form.budget),
        household: form.household === '' ? undefined : Number(form.household),
      });
      setSaved(form);
      setFailed(false);
      setStatusMsg('Profile updated successfully!');
    } catch {
      setFailed(true);
      setStatusMsg('Error saving profile. Please check your connection.');
    } finally {
      setSaving(false);
    }
  };

  const back = <Button variant="ghost" size="sm" onClick={onBack} className="-ml-4">← Back to results</Button>;
  const loading = isLoading || (isAuthenticated && profile === undefined);

  return (
    <main className="mx-auto max-w-2xl px-gutter pb-section pt-20 sm:pt-stack">
      {back}
      {loading ? (
        <div aria-busy="true" className="mt-4 space-y-4">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : !isAuthenticated ? (
        <EmptyState
          className="mt-4"
          title="Sign in to see your profile"
          description="Your profile keeps your move plans and saved places together. It only takes an email and a password."
          action={<Button onClick={openSignIn}>Sign in</Button>}
        />
      ) : (
        <form onSubmit={handleSave} noValidate className="mt-2 space-y-stack">
          <PageHeader
            title="Your Profile"
            description="Manage your move plans and preferences."
            actions={profile?.isSample ? <Badge tone="sample">Sample persona</Badge> : undefined}
          />

          <Section title="About you" description="How we greet you around the site.">
            <Field label="Display Name" error={errors.displayName}>
              <Input type="text" required value={form.displayName} onChange={set('displayName')} placeholder="e.g. Jordan Miller" autoComplete="name" />
            </Field>
          </Section>

          <Section title="Your move" description="Where and when you hope to land.">
            <Field label="Target Utah Town">
              <Select value={form.cityId} onChange={set('cityId')}>
                <option value="">Exploring all of Utah</option>
                {cities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.county} County)
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Move-by Date">
              <Input type="date" value={form.moveBy} onChange={set('moveBy')} />
            </Field>
          </Section>

          <Section title="Budget and household" description="Used to size up homes and rent. It stays on your profile.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Target Budget ($/mo)" error={errors.budget}>
                <Input type="number" inputMode="numeric" min={0} step={50} placeholder="e.g. 2400" value={form.budget} onChange={set('budget')} />
              </Field>
              <Field label="Household Size" hint="1 to 12 people." error={errors.household}>
                <Input type="number" inputMode="numeric" min={1} max={12} placeholder="e.g. 2" value={form.household} onChange={set('household')} />
              </Field>
            </div>
          </Section>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p role="status" className={`min-w-0 text-small font-semibold ${failed ? 'text-danger' : 'text-success'}`}>
              {statusMsg || (dirty ? <span className="text-text-muted">You have unsaved changes.</span> : <span className="text-text-muted">All changes saved.</span>)}
            </p>
            <Button type="submit" loading={saving} className="w-full sm:w-auto">
              {saving ? 'Saving...' : 'Save Profile'}
            </Button>
          </div>
        </form>
      )}
    </main>
  );
}
