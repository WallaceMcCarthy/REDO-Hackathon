import React, { useEffect, useState } from 'react';
import { useIsSaved, useToggleSaved } from '../../data/socialHooks';

interface SavedButtonProps {
  listingId: string;
  initialSaved?: boolean;
  onToggle?: (saved: boolean) => void;
  className?: string;
}

export default function SavedButton({
  listingId,
  initialSaved = false,
  onToggle,
  className = '',
}: SavedButtonProps) {
  const isSavedFromServer = useIsSaved(listingId);
  const [saved, setSaved] = useState(initialSaved);
  const [busy, setBusy] = useState(false);
  const toggleSaved = useToggleSaved();

  useEffect(() => {
    if (typeof isSavedFromServer === 'boolean') {
      setSaved(isSavedFromServer);
    }
  }, [isSavedFromServer]);

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (busy) return;

    const nextSaved = !saved;
    setSaved(nextSaved);
    onToggle?.(nextSaved);
    setBusy(true);

    try {
      const res = await toggleSaved(listingId);
      if (res && typeof res.saved === 'boolean') {
        setSaved(res.saved);
        onToggle?.(res.saved);
      }
    } catch (err: any) {
      // Revert optimistic state on failure
      setSaved(saved);
      onToggle?.(saved);
      if (err?.message?.includes('Sign in') || err?.message?.includes('auth')) {
        alert('Please sign in to save places to your profile.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={saved ? 'Remove from saved places' : 'Save to my places'}
      title={saved ? 'Remove from saved places' : 'Save to my places'}
      className={`group relative flex size-8 items-center justify-center rounded-full border transition-all duration-150 before:absolute before:-inset-2 before:content-[''] focus-visible:outline-2 focus-visible:outline-alpine-500 ${
        saved
          ? 'border-rose-200 bg-rose-50 text-rose-600 shadow-sm'
          : 'border-rock-200 bg-white/90 text-rock-400 hover:border-rock-300 hover:text-rose-500'
      } ${className}`}
    >
      <svg
        className={`size-4 transition-transform duration-150 group-active:scale-90 ${
          saved ? 'fill-rose-500 scale-110' : 'fill-none stroke-current stroke-2'
        }`}
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
        />
      </svg>
    </button>
  );
}
