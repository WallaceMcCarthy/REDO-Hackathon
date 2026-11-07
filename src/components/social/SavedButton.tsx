import React, { useEffect, useState } from 'react';
import { useConvexAuth } from 'convex/react';
import { useIsSaved, useToggleSaved } from '../../data/socialHooks';
import { openSignIn } from '../auth/AccountMenu';

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
  const { isAuthenticated, isLoading } = useConvexAuth();

  useEffect(() => {
    if (typeof isSavedFromServer === 'boolean') {
      setSaved(isSavedFromServer);
    }
  }, [isSavedFromServer]);

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (busy) return;
    if (!isLoading && !isAuthenticated) return openSignIn();

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
      if (err?.message?.includes('Sign in') || err?.message?.includes('auth')) openSignIn();
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
      className={`group relative flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-pill border transition-colors ${
        saved
          ? 'border-primary bg-rock-100 text-primary'
          : 'border-border-strong bg-surface-raised text-text-muted hover:text-primary'
      } ${className}`}
    >
      <svg
        className={`size-5 transition-transform duration-150 group-active:scale-90 ${
          saved ? 'fill-current' : 'fill-none stroke-current stroke-2'
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
