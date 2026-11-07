import React, { useEffect, useState } from 'react';
import { useAuthActions } from '@convex-dev/auth/react';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useCities } from '../data/hooks';
import { useUpdateProfile, useUserProfile } from '../data/socialHooks';

const CONFIRM_WORD = 'DELETE';

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
    <section aria-labelledby="delete-account-heading" className="mt-6 rounded-3xl border border-rose-200 bg-white p-6 sm:p-8 shadow-sm">
      <h2 id="delete-account-heading" className="font-display text-xl font-bold text-ink">Delete account</h2>
      {!confirming ? (
        <>
          <p className="mt-1 text-xs text-dusk">Permanently remove your account and your data.</p>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="mt-4 cursor-pointer rounded-full border border-rose-300 px-5 py-2 text-sm font-semibold text-rose-800 hover:bg-rose-50"
          >
            Delete my account
          </button>
        </>
      ) : (
        <form onSubmit={handleDelete} className="mt-3 space-y-3 text-sm text-ink">
          <p className="font-semibold">This can't be undone. Here is what happens:</p>
          <ul className="list-disc space-y-1 pl-5 text-xs text-dusk">
            <li>Your profile, sign-in and saved places are deleted, and you are signed out everywhere.</li>
            <li>Your posts are deleted, along with their likes and comments.</li>
            <li>Your comments, likes and reports are deleted. Replies other people wrote to you stay up.</li>
            <li>Your roommate profile and all your roommate connections are deleted.</li>
            <li>Any ads you run end now and lose their text and link.</li>
            <li>Payment records stay for accounting, no longer linked to your account.</li>
          </ul>
          <div>
            <label htmlFor="delete-confirm" className="block text-xs font-semibold text-ink">
              Type {CONFIRM_WORD} to confirm
            </label>
            <input
              id="delete-confirm"
              type="text"
              autoComplete="off"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-rock-200 px-3.5 py-2 text-sm text-ink focus:border-rose-500 focus:outline-none"
            />
          </div>
          {error && <div role="alert" className="rounded-xl bg-rose-50 p-3 text-xs text-rose-800">{error}</div>}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              disabled={deleting}
              onClick={() => { setConfirming(false); setTyped(''); setError(''); }}
              className="cursor-pointer rounded-full border border-rock-300 px-5 py-2 text-sm font-semibold text-rock-700 hover:bg-rock-100 disabled:opacity-50"
            >
              Keep my account
            </button>
            <button
              type="submit"
              disabled={typed !== CONFIRM_WORD || deleting}
              className="cursor-pointer rounded-full bg-rose-700 px-5 py-2 text-sm font-semibold text-white hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {deleting ? 'Deleting...' : 'Permanently delete'}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

interface AccountProps {
  onBack: () => void;
  onSignIn: () => void;
}

export default function Account({ onBack, onSignIn }: AccountProps) {
  const profile = useUserProfile();
  const cities = useCities() ?? [];
  const updateProfile = useUpdateProfile();

  const [displayName, setDisplayName] = useState('');
  const [cityId, setCityId] = useState('');
  const [moveBy, setMoveBy] = useState('');
  const [budget, setBudget] = useState<number | ''>('');
  const [household, setHousehold] = useState<number | ''>('');
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [deleted, setDeleted] = useState(false);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName || '');
      setCityId(profile.cityId || '');
      setMoveBy(profile.moveBy || '');
      setBudget(profile.budget ?? '');
      setHousehold(profile.household ?? '');
    }
  }, [profile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatusMsg('');
    try {
      await updateProfile({
        displayName: displayName.trim(),
        cityId: cityId || null,
        moveBy: moveBy || null,
        budget: budget === '' ? null : Number(budget),
        household: household === '' ? null : Number(household),
      });
      setStatusMsg('Profile updated successfully!');
    } catch (err) {
      setStatusMsg('Error saving profile. Please check your connection.');
    } finally {
      setSaving(false);
    }
  };

  if (deleted || profile === null) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
        <div className="rounded-3xl border border-rock-200 bg-white p-6 sm:p-8 shadow-sm">
          <h1 className="font-display text-2xl font-bold text-ink">
            {deleted ? 'Your account has been deleted' : 'Sign in to manage your account'}
          </h1>
          <div className="mt-4 flex gap-2">
            {!deleted && (
              <button type="button" onClick={onSignIn} className="cursor-pointer rounded-full bg-alpine-700 px-5 py-2 text-sm font-semibold text-white hover:bg-alpine-800">
                Sign in
              </button>
            )}
            <button type="button" onClick={onBack} className="cursor-pointer rounded-full border border-rock-300 px-5 py-2 text-sm font-semibold text-rock-700 hover:bg-rock-100">
              Back to results
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
      <button
        type="button"
        onClick={onBack}
        className="mb-4 inline-flex min-h-[44px] items-center cursor-pointer rounded-full border border-rock-300 px-4 py-2 text-xs font-semibold text-rock-700 hover:bg-rock-100 focus-visible:outline-2 focus-visible:outline-alpine-500"
      >
        ← Back to results
      </button>

      <div className="rounded-3xl border border-rock-200 bg-white p-6 sm:p-8 shadow-sm">
        <div className="flex items-center justify-between border-b border-rock-100 pb-5">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-ink">Your Profile</h1>
            <p className="mt-1 text-xs text-dusk">
              Manage your move plans and preferences.
            </p>
          </div>
          {profile?.isSample && (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
              Sample Persona
            </span>
          )}
        </div>

        <form onSubmit={handleSave} className="mt-6 space-y-5">
          <div>
            <label htmlFor="acct-name" className="block text-xs font-semibold text-ink">Display Name</label>
            <input
              id="acct-name"
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Jordan Miller"
              className="mt-1.5 w-full min-h-[44px] rounded-xl border border-rock-200 px-3.5 py-2 text-sm text-ink placeholder:text-rock-400 focus:border-alpine-500 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="acct-town" className="block text-xs font-semibold text-ink">Target Utah Town</label>
            <select
              id="acct-town"
              value={cityId}
              onChange={(e) => setCityId(e.target.value)}
              className="mt-1.5 w-full min-h-[44px] rounded-xl border border-rock-200 px-3.5 py-2 text-sm text-ink focus:border-alpine-500 focus:outline-none"
            >
              <option value="">Exploring all of Utah</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.county} County)
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-ink">Move-by Date</label>
              <input
                id="acct-move"
                type="date"
                value={moveBy}
                onChange={(e) => setMoveBy(e.target.value)}
                className="mt-1.5 w-full min-h-[44px] rounded-xl border border-rock-200 px-3.5 py-2 text-sm text-ink focus:border-alpine-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink">Target Budget ($/mo)</label>
              <input
                id="acct-budget"
                type="number"
                min={0}
                step={50}
                placeholder="e.g. 2400"
                value={budget}
                onChange={(e) => setBudget(e.target.value === '' ? '' : Number(e.target.value))}
                className="mt-1.5 w-full min-h-[44px] rounded-xl border border-rock-200 px-3.5 py-2 text-sm text-ink placeholder:text-rock-400 focus:border-alpine-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label htmlFor="acct-house" className="block text-xs font-semibold text-ink">Household Size</label>
            <input
              id="acct-house"
              type="number"
              min={1}
              max={12}
              placeholder="e.g. 2"
              value={household}
              onChange={(e) => setHousehold(e.target.value === '' ? '' : Number(e.target.value))}
              className="mt-1.5 w-full min-h-[44px] rounded-xl border border-rock-200 px-3.5 py-2 text-sm text-ink placeholder:text-rock-400 focus:border-alpine-500 focus:outline-none"
            />
          </div>

          {statusMsg && (
            <div
              className={`rounded-xl p-3 text-xs ${
                statusMsg.includes('success')
                  ? 'bg-emerald-50 text-emerald-800'
                  : 'bg-rose-50 text-rose-800'
              }`}
            >
              {statusMsg}
            </div>
          )}

          <div className="flex justify-end pt-3">
            <button
              type="submit"
              disabled={saving}
              className="w-full sm:w-auto inline-flex min-h-[44px] items-center justify-center cursor-pointer rounded-full bg-alpine-700 px-6 py-2.5 text-sm font-semibold text-white hover:bg-alpine-800 focus-visible:outline-2 focus-visible:outline-alpine-500 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>
      </div>

      <DeleteAccount onDeleted={() => setDeleted(true)} />
    </main>
  );
}
