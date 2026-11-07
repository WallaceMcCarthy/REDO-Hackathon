import { useEffect, useRef, useState } from 'react';
import type { Listing, Recommendation } from './types';
import { zillowUrl } from '../../../convex/lib/zillow';
import ZillowPhoto from './ZillowPhoto';
import { useZillowPreview } from './useZillowPreview';
import CommentsThread from '../social/CommentsThread';
import SavedButton from '../social/SavedButton';
import { FOCUS, LINK, money, rentFmt } from '../homes/ui';

interface Props {
  listing: Listing;
  rec?: Recommendation;
  cityName?: string;
  /** 'floating' = desktop card over the map; 'sheet' = phone bottom sheet. */
  variant: 'floating' | 'sheet';
  index?: number;
  total?: number;
  onPrev?: () => void;
  onNext?: () => void;
  onClose: () => void;
  onOpenTown?: (cityId: string) => void;
  /** Opens a DM with a commenter; the Message button is hidden when omitted. */
  onMessageUser?: (userId: string, listingId: string) => void;
}

const Arrow = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);
const ICON_BTN = `inline-flex size-8 cursor-pointer items-center justify-center rounded-full bg-white/95 text-ink shadow ring-1 ring-black/10 hover:bg-white disabled:cursor-default disabled:opacity-40 ${FOCUS}`;

export default function ListingDetailPanel({ listing, rec, cityName, variant, index, total, onPrev, onNext, onClose, onOpenTown, onMessageUser }: Props) {
  const apt = listing.kind === 'apartment';
  const { preview } = useZillowPreview(listing.id, listing.kind === 'home');
  const zUrl = zillowUrl(listing.address, cityName, listing.kind);
  const fit = rec ? Math.max(0, Math.min(100, Math.round(rec.townScore))) : undefined;
  const amount = apt ? (listing.rent != null ? rentFmt(listing.rent) : 'N/A') : (listing.value != null ? money(listing.value) : 'N/A');
  const label = apt ? 'HUD 2-bed fair market rent' : 'Est. value';
  const address = listing.address || listing.name || 'Address not listed';
  const meta = [
    cityName,
    apt ? (listing.units != null ? `${listing.units} units` : null) : (listing.beds != null ? `${listing.beds} bd` : null),
    !apt && listing.sqft != null ? `${listing.sqft.toLocaleString()} sqft` : null,
    listing.yearBuilt != null ? `Built ${listing.yearBuilt}` : null,
  ].filter(Boolean);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Swipe down to dismiss (sheet only).
  const startY = useRef<number | null>(null);
  const [dy, setDy] = useState(0);
  const swipe = variant === 'sheet' ? {
    onTouchStart: (e: React.TouchEvent) => { startY.current = e.touches[0].clientY; },
    onTouchMove: (e: React.TouchEvent) => {
      if (startY.current == null) return;
      const d = e.touches[0].clientY - startY.current;
      const scroller = e.currentTarget as HTMLElement;
      if (d > 0 && scroller.scrollTop <= 0) setDy(d);
    },
    onTouchEnd: () => { if (dy > 90) onClose(); setDy(0); startY.current = null; },
  } : {};

  const shell = variant === 'floating'
    ? 'absolute left-14 top-3 z-20 max-h-[calc(100%-1.5rem)] w-[360px] rounded-xl'
    : 'fixed inset-x-0 bottom-0 z-40 h-[60dvh] rounded-t-2xl';

  return (
    <aside
      aria-label={`Details for ${address}`}
      data-testid="listing-panel"
      {...swipe}
      style={variant === 'sheet' && dy ? { transform: `translateY(${dy}px)`, transition: 'none' } : undefined}
      className={`${shell} overflow-y-auto overscroll-contain bg-white shadow-2xl ring-1 ring-black/10`}
    >
      {variant === 'sheet' && <div className="sticky top-0 z-10 flex justify-center bg-white pb-1 pt-2"><span className="h-1 w-10 rounded-full bg-rock-300" /></div>}
      <div className="relative">
        <ZillowPhoto listing={listing} preview={preview} fallbackUrl={zUrl} rounded={variant === 'floating' ? 'rounded-t-xl' : ''} />
        <div className="absolute right-2 top-2 flex gap-1.5">
          <button type="button" onClick={onClose} aria-label="Close details" className={ICON_BTN}><Arrow d="M6 6l12 12M18 6 6 18" /></button>
        </div>
        {(onPrev || onNext) && (
          <div className="absolute bottom-5 right-2 flex items-center gap-1.5">
            {index != null && index >= 0 && total ? <span className="rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-white">{index + 1} / {total}</span> : null}
            <button type="button" onClick={onPrev} disabled={!onPrev} aria-label="Previous listing" className={ICON_BTN}><Arrow d="M15 5l-7 7 7 7" /></button>
            <button type="button" onClick={onNext} disabled={!onNext} aria-label="Next listing" className={ICON_BTN}><Arrow d="M9 5l7 7-7 7" /></button>
          </div>
        )}
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-display text-3xl leading-none text-ink tabular-nums">{amount}</p>
            <p className="mt-1 flex items-center gap-1 text-xs text-dusk">
              {label}
              {!apt && (
                <span className="group relative inline-flex">
                  <span
                    tabIndex={0} role="img" aria-label="County assessor estimate, not an asking price"
                    className={`inline-flex size-4 cursor-help items-center justify-center rounded-full border border-rock-300 text-[10px] font-bold text-dusk ${FOCUS}`}
                  >i</span>
                  <span role="tooltip" className="pointer-events-none absolute bottom-full left-0 z-20 mb-1 hidden w-48 rounded-lg bg-ink px-2.5 py-1.5 text-xs text-white group-focus-within:block group-hover:block">
                    County assessor estimate, not an asking price
                  </span>
                </span>
              )}
            </p>
          </div>
          <SavedButton listingId={listing.id} />
        </div>

        <h2 className="mt-3 text-base font-semibold text-ink">{address}</h2>
        <p className="mt-0.5 text-sm text-dusk">{meta.join(' · ')}</p>

        {fit != null && (
          <div className="mt-3 flex items-center gap-2">
            <span role="meter" aria-label="Fit score" aria-valuemin={0} aria-valuemax={100} aria-valuenow={fit} className="block h-2 flex-1 overflow-hidden rounded-full bg-rock-100">
              <span className="block h-full rounded-full bg-alpine-500" style={{ width: `${fit}%` }} />
            </span>
            <span className="w-16 text-right text-xs tabular-nums text-dusk">{fit} / 100</span>
          </div>
        )}
        {rec?.reason && <p className="mt-2 text-sm text-ink"><span className="font-semibold text-alpine-700">Why this place: </span>{rec.reason}</p>}

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-rock-100 pt-3">
          <a href={preview?.pageUrl ?? zUrl} target="_blank" rel="noopener noreferrer" className={LINK}>View on Zillow</a>
          {onOpenTown && cityName && (
            <button type="button" onClick={() => onOpenTown(listing.cityId)} className={LINK}>About {cityName}</button>
          )}
          {listing.sourceUrl && (
            <a href={listing.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-dusk underline-offset-2 hover:underline">Data source</a>
          )}
        </div>

        <CommentsThread
          targetType="listing"
          targetId={listing.id}
          title="Comments"
          helper="Looking for roommates? Say what you're after. Others interested in this place can reply or message you."
          placeholder="Looking for roommates? Say what you're after..."
          onMessageUser={onMessageUser}
          className="mt-4 !border-0 !bg-transparent !p-0 !shadow-none"
        />
      </div>
    </aside>
  );
}
