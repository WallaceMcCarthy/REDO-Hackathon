import { useEffect, useState } from 'react';
import type { Listing } from './types';
import AerialPhoto from './AerialPhoto';
import type { ZillowPreview } from './useZillowPreview';

interface Props {
  listing: Listing;
  preview: ZillowPreview | null;
  fallbackUrl: string;
  rounded?: string;
}

/** Zillow's own photo (Open Graph image) in the same 16:10 box as AerialPhoto; falls back to the aerial. */
export default function ZillowPhoto({ listing, preview, fallbackUrl, rounded = 'rounded-t-xl' }: Props) {
  // Pages with no photo give Zillow's app icon as their Open Graph image.
  const imageUrl = preview?.imageUrl?.startsWith('https://photos.zillowstatic.com/') ? preview.imageUrl : null;
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [imageUrl]);
  if (!imageUrl || failed) return <AerialPhoto listing={listing} rounded={rounded} />;
  const address = listing.address || listing.name || 'the property';
  return (
    <div className={`relative aspect-[16/10] w-full overflow-hidden bg-rock-100 ${rounded}`}>
      <img
        src={imageUrl} alt={`Photo of ${address} from Zillow`} referrerPolicy="no-referrer" loading="lazy"
        draggable={false} onError={() => setFailed(true)} className="size-full object-cover"
      />
      <span className="pointer-events-none absolute left-2 top-2 rounded-full bg-black/45 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">Photo · Zillow</span>
    </div>
  );
}
