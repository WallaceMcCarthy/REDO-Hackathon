import React from 'react';
import type { Listing, Recommendation } from '../../../convex/lib/listings';
import { formatListingFinancials } from './types';
import SafeSectionBoundary from '../SafeSectionBoundary';
import SavedButton from '../social/SavedButton';

interface ListingCardProps {
  item: Listing | Recommendation;
  isSelected?: boolean;
  onSelect?: (listing: Listing) => void;
  onHover?: (hovered: boolean) => void;
  cityName?: string;
  className?: string;
}

function isRecommendation(item: Listing | Recommendation): item is Recommendation {
  return 'listing' in item;
}

export default function ListingCard({
  item,
  isSelected,
  onSelect,
  onHover,
  cityName,
  className = '',
}: ListingCardProps) {
  const listing: Listing = isRecommendation(item) ? item.listing : item;
  const reason = isRecommendation(item) ? item.reason : undefined;
  const townScore = isRecommendation(item) ? item.townScore : undefined;
  const townRank = isRecommendation(item) ? item.townRank : undefined;

  const financials = formatListingFinancials(listing);
  const displayName = listing.name || listing.address || 'Residential Property';
  const displayAddress = listing.name && listing.address ? listing.address : null;

  return (
    <article
      onClick={() => onSelect?.(listing)}
      onMouseEnter={() => onHover?.(true)}
      onMouseLeave={() => onHover?.(false)}
      tabIndex={onSelect ? 0 : undefined}
      onKeyDown={(e) => {
        if (onSelect && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onSelect(listing);
        }
      }}
      className={`group relative flex flex-col justify-between rounded-2xl border p-4 transition-all duration-150 ${
        isSelected
          ? 'border-alpine-500 bg-alpine-50/50 shadow-md ring-2 ring-alpine-500/20'
          : 'border-rock-200 bg-white hover:border-rock-300 hover:shadow-sm'
      } ${onSelect ? 'cursor-pointer' : ''} ${className}`}
    >
      <div>
        {/* Top Badges */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 text-xs">
          <div className="flex items-center gap-1.5">
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-medium ${
                listing.kind === 'apartment'
                  ? 'bg-sky-100 text-sky-800'
                  : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              {listing.propertyType || (listing.kind === 'apartment' ? 'Apartment' : 'Single Family')}
            </span>
            {cityName && (
              <span className="font-semibold text-rock-700">
                {cityName}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {townRank != null && (
              <span className="inline-flex items-center rounded-full bg-alpine-100 px-2 py-0.5 font-medium text-alpine-800">
                #{townRank} match {townScore != null && `(${Math.round(townScore)}%)`}
              </span>
            )}
            <SafeSectionBoundary><SavedButton listingId={listing.id} /></SafeSectionBoundary>
          </div>
        </div>

        {/* Title & Address */}
        <div className="mt-2.5">
          <h3 className="font-display text-lg font-semibold leading-snug text-ink group-hover:text-alpine-900">
            {displayName}
          </h3>
          {displayAddress && (
            <p className="mt-0.5 text-xs text-dusk line-clamp-1">{displayAddress}</p>
          )}
        </div>

        {/* Price & Benchmark */}
        <div className="mt-3 rounded-xl bg-rock-50 p-2.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-display text-2xl font-bold tracking-tight text-ink">
              {financials.amountFormatted}
            </span>
            <span className="rounded bg-rock-200/70 px-1.5 py-0.5 text-[10px] font-medium text-rock-700">
              {financials.benchmarkBadge}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-dusk">{financials.label}</p>
        </div>

        {/* Property Attributes */}
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-rock-600">
          {listing.kind === 'apartment' ? (
            <>
              <span className="inline-flex items-center gap-1">
                <span className="font-medium text-ink">2-bed</span> rent benchmark
              </span>
              {listing.units != null && (
                <>
                  <span className="text-rock-300">•</span>
                  <span>{listing.units} units</span>
                </>
              )}
              {listing.yearBuilt != null && (
                <>
                  <span className="text-rock-300">•</span>
                  <span>Built {listing.yearBuilt}</span>
                </>
              )}
            </>
          ) : (
            <>
              {listing.beds != null && (
                <span className="inline-flex items-center gap-1">
                  <span className="font-medium text-ink">{listing.beds}</span> beds
                </span>
              )}
              {listing.sqft != null && (
                <>
                  {listing.beds != null && <span className="text-rock-300">•</span>}
                  <span className="inline-flex items-center gap-1">
                    <span className="font-medium text-ink">{listing.sqft.toLocaleString()}</span> sq ft
                  </span>
                </>
              )}
              {listing.yearBuilt != null && (
                <>
                  <span className="text-rock-300">•</span>
                  <span>Built {listing.yearBuilt}</span>
                </>
              )}
            </>
          )}
        </div>

        {/* Why this home */}
        {reason && (
          <div className="mt-3 rounded-lg border border-alpine-200 bg-alpine-50/60 p-2 text-xs text-alpine-900">
            <span className="font-semibold text-alpine-800">Why this place: </span>
            <span>{reason}</span>
          </div>
        )}
      </div>

      {/* Provenance Footer */}
      <footer className="mt-3.5 border-t border-rock-100 pt-2 text-[11px] text-dusk">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate" title={financials.disclaimer}>
            {listing.source}
          </span>
          {listing.sourceUrl && (
            <a
              href={listing.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="shrink-0 font-medium text-alpine-700 underline underline-offset-2 hover:text-alpine-900"
            >
              Source ↗
            </a>
          )}
        </div>
      </footer>
    </article>
  );
}
