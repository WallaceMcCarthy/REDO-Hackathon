import { useCallback } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { CommentItem, CommentTargetType, SavedListingItem, UserProfile } from '../components/social/types';

/**
 * Hook to retrieve user's saved listings (api.social.mySaved).
 */
export function useMySaved(): SavedListingItem[] | undefined {
  const queryFn = (api as any).social?.mySaved;
  const result = useQuery(queryFn, queryFn ? {} : 'skip');
  return result as SavedListingItem[] | undefined;
}

/**
 * Mutation hook to toggle saving/hearting a listing.
 */
export function useToggleSaved() {
  const mutationFn = (api as any).social?.toggleSaved;
  const mutate = useMutation(mutationFn ?? (() => Promise.resolve({ saved: false })));

  return useCallback(
    async (listingId: string): Promise<{ saved: boolean }> => {
      if (!mutationFn) return { saved: false };
      return await mutate({ listingId });
    },
    [mutate, mutationFn],
  );
}

/**
 * Hook to retrieve comment thread for a listing, town, or post.
 */
export function useComments(targetType: CommentTargetType, targetId: string): CommentItem[] | undefined {
  const queryFn = (api as any).social?.comments;
  const result = useQuery(
    queryFn,
    queryFn && targetId ? { targetType, targetId } : 'skip',
  );
  return result as CommentItem[] | undefined;
}

/**
 * Mutation hook to add a comment (supports 1-level threading via parentId).
 */
export function useAddComment() {
  const mutationFn = (api as any).social?.addComment;
  const mutate = useMutation(mutationFn ?? (() => Promise.resolve('')));

  return useCallback(
    async (params: {
      targetType: CommentTargetType;
      targetId: string;
      body: string;
      parentId?: string;
    }): Promise<string> => {
      if (!mutationFn) return '';
      return await mutate(params);
    },
    [mutate, mutationFn],
  );
}

/**
 * Mutation hook to delete a comment (author only).
 */
export function useDeleteComment() {
  const mutationFn = (api as any).social?.deleteComment;
  const mutate = useMutation(mutationFn ?? (() => Promise.resolve()));

  return useCallback(
    async (commentId: string): Promise<void> => {
      if (!mutationFn) return;
      await mutate({ commentId });
    },
    [mutate, mutationFn],
  );
}

/**
 * Mutation hook to report a comment (moderation: hides at 3 reports).
 */
export function useReportComment() {
  const mutationFn = (api as any).social?.reportComment;
  const mutate = useMutation(mutationFn ?? (() => Promise.resolve()));

  return useCallback(
    async (commentId: string): Promise<void> => {
      if (!mutationFn) return;
      await mutate({ commentId });
    },
    [mutate, mutationFn],
  );
}

/**
 * Hook to fetch current user's profile (api.profiles.getMe).
 */
export function useUserProfile(): UserProfile | null | undefined {
  const queryFn = (api as any).profiles?.getMe ?? (api as any).profiles?.myProfile;
  const result = useQuery(queryFn, queryFn ? {} : 'skip');
  return result as UserProfile | null | undefined;
}

/**
 * Mutation hook to update user's profile (api.profiles.updateProfile).
 */
export function useUpdateProfile() {
  const mutationFn = (api as any).profiles?.updateProfile ?? (api as any).profiles?.updateMyProfile;
  const mutate = useMutation(mutationFn ?? (() => Promise.resolve()));

  return useCallback(
    async (profile: Partial<UserProfile>): Promise<void> => {
      if (!mutationFn) return;
      await mutate(profile);
    },
    [mutate, mutationFn],
  );
}
