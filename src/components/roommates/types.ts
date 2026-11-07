import { ROOMMATE_TAGS } from '../../../convex/lib/roommateRules';

export interface PublicProfile {
  profileId: string;
  budgetMin: number;
  budgetMax: number;
  cityIds: string[];
  moveIn: number;
  tags: string[];
  bio: string;
  isSample: boolean;
}
export interface Match extends PublicProfile {
  score: number;
  sharedCityIds: string[];
  sharedTags: string[];
  reasons: string[];
}
export interface Request extends PublicProfile { connectionId: string }
export interface Connected extends Request { contact: string }
export interface MyProfile extends PublicProfile { contact: string; active: boolean }
export interface ProfileDraft {
  budgetMin: number; budgetMax: number; cityIds: string[]; moveIn: number; tags: string[]; bio: string; contact: string;
}

export const TAGS = ROOMMATE_TAGS;
export const tagLabel = (t: string) => t.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());
export const money = (n: number) => `$${n.toLocaleString()}`;
export const dateLabel = (ms: number) => new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
export const townNames = (ids: string[], names: Map<string, string>) => ids.map((id) => names.get(id) ?? id).join(', ');
