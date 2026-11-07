import { useTownCampaigns } from '../../data/adsHooks';
import FeaturedListingSlot from './FeaturedListingSlot';

/** One labelled Sponsored card for a town, shown beside results. It reads campaigns only and never touches ranking. */
export default function TownSponsoredSlot({ cityId, className }: { cityId: string; className?: string }) {
  const campaigns = useTownCampaigns(cityId);
  const campaign = campaigns?.find(c => c.cityId === cityId) ?? campaigns?.[0];
  return campaign ? <FeaturedListingSlot key={campaign._id} campaign={campaign} className={className} /> : null;
}
