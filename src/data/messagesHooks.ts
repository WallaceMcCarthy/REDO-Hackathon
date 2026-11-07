import { useConvexAuth, useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';

export interface InboxListing {
  id: string;
  name?: string | null;
  address?: string | null;
  kind: 'home' | 'apartment';
  value?: number | null;
  rent?: number | null;
  cityId: string;
}

export interface InboxItem {
  _id: string;
  otherUserId: string;
  otherDisplayName: string;
  otherIsSample?: boolean;
  listing: InboxListing | null;
  lastMessage: string;
  lastMessageAt: number;
  unreadCount: number;
}

export interface MessageItem {
  _id: string;
  body: string;
  senderUserId: string;
  createdAt: number;
  isMine: boolean;
  isSample?: boolean;
}

export interface ThreadResult {
  page: MessageItem[];
  isDone: boolean;
  continueCursor?: string | null;
}

export function useInbox(): InboxItem[] | undefined {
  const { isAuthenticated } = useConvexAuth();
  return useQuery(api.messages.myConversations, isAuthenticated ? {} : 'skip') as InboxItem[] | undefined;
}

export function useUnreadCount(): number {
  const { isAuthenticated } = useConvexAuth();
  return useQuery(api.messages.unreadTotal, isAuthenticated ? {} : 'skip') ?? 0;
}

export function useThread(conversationId: string | null): ThreadResult | undefined {
  const { isAuthenticated } = useConvexAuth();
  const res = useQuery(
    api.messages.messages,
    isAuthenticated && conversationId
      ? { conversationId: conversationId as Id<'conversations'>, paginationOpts: { numItems: 50, cursor: null } }
      : 'skip',
  );
  if (!res) return undefined;
  // Thread arrives newest-first from backend; reverse for chronological UI display
  return { ...res, page: [...res.page].reverse() };
}

export function useMessagesActions() {
  const startConvoMutation = useMutation(api.messages.startConversation);
  const sendMutation = useMutation(api.messages.sendMessage);
  const markReadMutation = useMutation(api.messages.markRead);

  return {
    startConversation: (otherUserId: string, listingId?: string): Promise<string> =>
      startConvoMutation({ otherUserId: otherUserId as Id<'users'>, listingId }),
    sendMessage: (conversationId: string, body: string): Promise<string> =>
      sendMutation({ conversationId: conversationId as Id<'conversations'>, body: body.trim() }),
    markRead: async (conversationId: string): Promise<void> => {
      try {
        await markReadMutation({ conversationId: conversationId as Id<'conversations'> });
      } catch (err) {
        console.warn('markRead error:', err);
      }
    },
  };
}

/** Helper for listing comments or other components to open/start a conversation */
export const openConversation = (conversationId: string) => {
  if (typeof window !== 'undefined') {
    window.location.hash = `/messages/${conversationId}`;
  }
};

export const openMessagesInbox = () => {
  if (typeof window !== 'undefined') {
    window.location.hash = '/messages';
  }
};
