import React, { useEffect, useState, type ReactNode } from 'react';
import { useAuthActions } from '@convex-dev/auth/react';
import { useConvexAuth, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useCities } from '../data/hooks';
import { useUpdateProfile, useUserProfile } from '../data/socialHooks';
import { Badge, Button, Card, EmptyState, Field, Input, PageHeader, Select, Skeleton } from '../components/ui';

const CONFIRM_WORD = 'DELETE';
// Same limits convex/profiles.ts enforces.
const MAX_NAME = 40;
const MAX_BUDGET = 50_000_000;

interface AccountProps {
  onBack: () => void;
  onSignIn: () => void;
}

type Form = { displayName: string; cityId: string; moveBy: string; budget: string; household: string };
const EMPTY: Form = { displayName: '', cityId: '', moveBy: '', budget: '', household: '' };

type Errors = Partial<Record<keyof Form, string>>;

function validate(f: Form): Errors {
  const errors: Errors = {};
  if (!f.displayName.trim()) errors.displayName = 'Enter a name so we can greet you.';
  else if (f.displayName.trim().length > MAX_NAME) errors.displayName = `Keep your name to ${MAX_NAME} characters.`;
  if (f.budget !== '' && !(Number(f.budget) >= 0 && Number(f.budget) <= MAX_BUDGET)) errors.budget = `Enter a budget from $0 to $${MAX_BUDGET.toLocaleString()}.`;
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

function DeleteAccount({ onDeleted }: { onDeleted: () => void }) {
  const { signOut } = useAuthActions();
  const deleteMyAccount = useMutation(api.account.deleteMyAccount);
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (typed !== CONFIRM_WORD) return;
    setDeleting(true);
    setError('');
    try {
      await deleteMyAccount();
    } catch {
      setError('Your account was not deleted. Check your connection and try again.');
      setDeleting(false);
      return;
    }
    onDeleted();
    await signOut();
  };

  return (
    <Section title="Delete account" description="Permanently remove your account and your data.">
      {!confirming ? (
        <Button variant="danger" onClick={() => setConfirming(true)}>Delete my account</Button>
      ) : (
        <form onSubmit={handleDelete} noValidate className="space-y-3">
          <p className="text-small font-semibold text-text">This can't be undone. Here is what happens:</p>
          <ul className="list-disc space-y-1 pl-5 text-small text-text-muted">
            <li>Your profile, sign-in and saved places are deleted, and you are signed out everywhere.</li>
            <li>Your posts are deleted, along with their likes and comments.</li>
            <li>Your comments, likes and reports are deleted. Replies other people wrote to you stay up.</li>
            <li>Your roommate profile and all your roommate connections are deleted.</li>
            <li>Your direct messages are deleted, including the copy the other person sees.</li>
            <li>Any ads you run end now and lose their text and link.</li>
            <li>Payment records stay for accounting, no longer linked to your account.</li>
          </ul>
          <Field label={`Type ${CONFIRM_WORD} to confirm`} error={error}>
            <Input type="text" autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} />
          </Field>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" disabled={deleting} onClick={() => { setConfirming(false); setTyped(''); setError(''); }}>
              Keep my account
            </Button>
            <Button type="submit" variant="danger" disabled={typed !== CONFIRM_WORD} loading={deleting}>
              {deleting ? 'Deleting...' : 'Permanently delete'}
            </Button>
          </div>
        </form>
      )}
    </Section>
  );
}

export default function Account({ onBack, onSignIn }: AccountProps) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const profile = useUserProfile();
  const cities = useCities() ?? [];
  const updateProfile = useUpdateProfile();

  const [form, setForm] = useState<Form>(EMPTY);
  const [saved, setSaved] = useState<Form>(EMPTY);
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [failed, setFailed] = useState(false);
  const [deleted, setDeleted] = useState(false);

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
        cityId: form.cityId || null,
        moveBy: form.moveBy || null,
        budget: form.budget === '' ? null : Number(form.budget),
        household: form.household === '' ? null : Number(form.household),
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
    <main className="mx-auto max-w-2xl px-gutter pb-section pt-stack">
      {back}
      {(deleted || loading || !isAuthenticated) && <h1 className="sr-only">Your profile</h1>}
      {deleted ? (
        <EmptyState className="mt-4" title="Your account has been deleted" description="Your profile and data are gone. You can keep browsing without an account." />
      ) : loading ? (
        <div aria-busy="true" className="mt-4 space-y-4">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : !isAuthenticated ? (
        <EmptyState
          className="mt-4"
          title="Sign in to see your profile"
          description="Your profile keeps your move plans and saved places together. It only takes an email and a password."
          action={<Button onClick={onSignIn}>Sign in</Button>}
        />
      ) : (
        <div className="mt-2 space-y-stack">
          <form onSubmit={handleSave} noValidate className="space-y-stack">
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

            <Section title="Budget and household" description="Optional. It stays on your profile.">
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
          <DeleteAccount onDeleted={() => setDeleted(true)} />
        </div>
      )}
    </main>
  );
}
