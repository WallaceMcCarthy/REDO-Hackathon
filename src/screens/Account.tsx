import React, { useEffect, useState } from 'react';
import { useUpdateProfile, useUserProfile } from '../data/socialHooks';
import type { City } from '../types';

interface AccountProps {
  cities: City[];
  onBack: () => void;
}

export default function Account({ cities, onBack }: AccountProps) {
  const profile = useUserProfile();
  const updateProfile = useUpdateProfile();

  const [displayName, setDisplayName] = useState('');
  const [cityId, setCityId] = useState('');
  const [moveBy, setMoveBy] = useState('');
  const [budget, setBudget] = useState<number | ''>('');
  const [household, setHousehold] = useState<number | ''>('');
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

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
    </main>
  );
}
