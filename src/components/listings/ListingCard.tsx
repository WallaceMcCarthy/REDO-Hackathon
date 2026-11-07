import type { Listing, Recommendation } from '../../../convex/lib/listings';
import { zillowUrl } from '../../../convex/lib/zillow';
import ZillowPhoto from './ZillowPhoto';
import { useZillowPreview } from './useZillowPreview';
import SavedButton from '../social/SavedButton';
import { FOCUS, LINK, money, rentFmt } from '../homes/ui';

export { zillowUrl };

interface ListingCardProps {
  item: Listing | Recommendation;
  isSelected?: boolean;
  onSelect?: (listing: Listing) => void;
  onHover?: (hovered: boolean) => void;
  onOpenTown?: (cityId: string) => void;
  cityName?: string;
  className?: string;
}

const isRec = (item: Listing | Recommendation): item is Recommendation => 'listing' in item;

export default function ListingCard({ item, isSelected, onSelect, onHover, onOpenTown, cityName, className = '' }: ListingCardProps) {
  const listing: Listing = isRec(item) ? item.listing : item;
  const reason = isRec(item) ? item.reason : undefined;
  const fit = isRec(item) ? Math.max(0, Math.min(100, Math.round(item.townScore))) : undefined;
  const apt = listing.kind === 'apartment';
  const { preview, ref } = useZillowPreview<HTMLElement>(listing.id, listing.kind === 'home');
  const zUrl = zillowUrl(listing.address, cityName, listing.kind);

  const amount = apt
    ? (listing.rent != null ? rentFmt(listing.rent) : 'N/A')
    : (listing.value != null ? money(listing.value) : 'N/A');
  const label = apt ? 'HUD 2-bed fair market rent' : 'Est. value';
  const address = listing.address || listing.name || 'Address not listed';
  const meta = [
    cityName,
    apt ? (listing.units != null ? `${listing.units} units` : null) : (listing.beds != null ? `${listing.beds} bd` : null),
    !apt && listing.sqft != null ? `${listing.sqft.toLocaleString()} sqft` : null,
    listing.yearBuilt != null ? `Built ${listing.yearBuilt}` : null,
  ].filter(Boolean);

  return (
    <article
      ref={ref}
      data-listing-id={listing.id}
      aria-label={address}
      onClick={() => onSelect?.(listing)}
      onMouseEnter={() => onHover?.(true)}
      onMouseLeave={() => onHover?.(false)}
      onFocus={() => onHover?.(true)}
      onBlur={() => onHover?.(false)}
      tabIndex={onSelect ? 0 : undefined}
      onKeyDown={e => {
        if (onSelect && e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onSelect(listing);
        }
      }}
      className={`overflow-hidden rounded-xl border bg-white transition-colors ${FOCUS} ${
        isSelected ? 'border-alpine-500 ring-2 ring-alpine-500/20' : 'border-rock-100 hover:border-rock-300'
      } ${onSelect ? 'cursor-pointer' : ''} ${className}`}
    >
      <ZillowPhoto listing={listing} preview={preview} fallbackUrl={zUrl} rounded="" />
      <div className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-2xl leading-none text-ink tabular-nums">{amount}</p>
          <p className="mt-1 flex items-center gap-1 text-xs text-dusk">
            {label}
            {!apt && (
              <span className="group relative inline-flex">
                <span
                  tabIndex={0} role="img" aria-label="County assessor estimate, not an asking price"
                  className={`inline-flex size-4 cursor-help items-center justify-center rounded-full border border-rock-300 text-[10px] font-bold text-dusk ${FOCUS}`}
                >
                  i
                </span>
                <span role="tooltip" className="pointer-events-none absolute bottom-full left-0 z-20 mb-1 hidden w-48 rounded-lg bg-ink px-2.5 py-1.5 text-xs text-white group-focus-within:block group-hover:block">
                  County assessor estimate, not an asking price
                </span>
              </span>
            )}
          </p>
        </div>
        <SavedButton listingId={listing.id} />
      </div>

      <h3 className="mt-3 truncate text-sm font-semibold text-ink" title={address}>{address}</h3>
      <p className="mt-0.5 truncate text-xs text-dusk">{meta.join(' · ')}</p>

      {fit != null && (
        <div className="mt-3 flex items-center gap-2">
          <span
            role="meter" aria-label="Fit score" aria-valuemin={0} aria-valuemax={100} aria-valuenow={fit}
            className="block h-1.5 flex-1 overflow-hidden rounded-full bg-rock-100"
          >
            <span className="block h-full rounded-full bg-alpine-500" style={{ width: `${fit}%` }} />
          </span>
          <span className="w-16 text-right text-xs tabular-nums text-dusk">{fit} / 100</span>
        </div>
      )}
      {reason && <p className="mt-2 line-clamp-2 text-xs text-ink"><span className="font-semibold text-alpine-700">Why this place: </span>{reason}</p>}

      <div className="mt-3 flex items-center justify-between gap-3 border-t border-rock-100 pt-3">
        <div className="flex items-baseline gap-3">
          <a href={preview?.pageUrl ?? zUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className={LINK}>
            View on Zillow
          </a>
          {listing.sourceUrl && (
            <a href={listing.sourceUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-xs text-dusk underline-offset-2 hover:underline">
              Data source
            </a>
          )}
        </div>
        {onOpenTown && cityName && (
          <button type="button" onClick={e => { e.stopPropagation(); onOpenTown(listing.cityId); }} className={LINK}>
            About {cityName}
          </button>
        )}
      </div>
      </div>
    </article>
  );
}
