import { useActiveFeatured } from '../../data/adsHooks';
import FeaturedListingSlot from './FeaturedListingSlot';
import { pickFeatured } from './placement';

type Props = { townIds: string[]; max: number };

/** Paid placements above the ranked list, kept in their own labeled block so they never read as a ranked result. */
export default function ResultsFeatured({ townIds, max }: Props) {
  // The public query is capped and sorted newest first, so ask by town or a town's ads would never surface.
  const first = useActiveFeatured(townIds[0]);
  const second = useActiveFeatured(townIds[1]);
  const statewide = useActiveFeatured();
  const picks = pickFeatured([...(first ?? []), ...(second ?? []), ...(statewide ?? [])], townIds, max);
  if (!picks.length) return null;
  return (
    <section aria-label="Sponsored placements" className="mb-4 border-b border-border-strong pb-4">
      <h2 className="mb-2 text-caption font-semibold text-text-muted">Paid placements, not part of your ranking</h2>
      <div className="space-y-3">
        {picks.map(c => <FeaturedListingSlot key={c._id} campaign={c} />)}
      </div>
    </section>
  );
}
