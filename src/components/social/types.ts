import type { Listing } from '../../../convex/lib/listings';

export type CommentTargetType = 'listing' | 'town' | 'post';

export interface CommentItem {
  _id: string;
  targetType: CommentTargetType;
  targetId: string;
  userId: string;
  displayName: string;
  body: string;
  parentId?: string | null;
  createdAt: number;
  reports?: number;
  hidden?: boolean;
  isSample?: boolean;
  canDelete?: boolean;
  hasReported?: boolean;
  replies?: CommentItem[];
}

export interface SavedListingItem {
  listingId: string;
  savedAt?: number;
  listing: Listing | null;
}

export interface UserProfile {
  userId?: string;
  displayName: string;
  cityId?: string | null;
  moveBy?: string | null;
  budget?: number | null;
  household?: number | null;
  isSample?: boolean;
}
