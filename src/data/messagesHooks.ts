import { useConvexAuth, useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';

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
  isBlockedByMe?: boolean;
}

export interface MessageItem {
  _id: string;
  body: string;
  senderUserId: string;
  createdAt: number;
  isMine: boolean;
  isSample?: boolean;
  hasReported?: boolean;
}

export interface ThreadResult {
  page: MessageItem[];
  isDone: boolean;
  continueCursor?: string | null;
}

// Safely access api.messages with canonical names from Edward (msg 281, 291) & backward aliases
const messagesApi = (api as any).messages;

export function useInbox(): InboxItem[] | undefined {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const queryFn = messagesApi?.myConversations ?? messagesApi?.inbox;
  const shouldQuery = Boolean(isAuthenticated && !isLoading && queryFn);
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const res = useQuery(queryFn ?? 'skip', shouldQuery ? {} : 'skip');
  if (!shouldQuery || !res) return undefined;
  return res as InboxItem[];
}

export function useUnreadCount(): number {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const queryFn = messagesApi?.unreadTotal ?? messagesApi?.unreadCount;
  const shouldQuery = Boolean(isAuthenticated && !isLoading && queryFn);
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const count = useQuery(queryFn ?? 'skip', shouldQuery ? {} : 'skip');
  if (!shouldQuery || typeof count !== 'number') return 0;
  return count;
}

export function useThread(conversationId: string | null): ThreadResult | undefined {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const queryFn = messagesApi?.messages ?? messagesApi?.thread;
  const shouldQuery = Boolean(isAuthenticated && !isLoading && conversationId && queryFn);
  // Unconditionally call useQuery to preserve stable hook order
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const res = useQuery(
    queryFn ?? 'skip',
    shouldQuery
      ? {
          conversationId: conversationId as any,
          paginationOpts: { numItems: 50, cursor: null },
        }
      : 'skip',
  );

  if (!shouldQuery || !res) return undefined;
  // Thread arrives newest-first from backend; reverse for chronological UI display
  return {
    ...res,
    page: [...(res.page || [])].reverse(),
  };
}

export function useMessagesActions() {
  const startConvoMutation = messagesApi?.startConversation ? useMutation(messagesApi.startConversation) : null;
  const sendMutation = (messagesApi?.sendMessage ?? messagesApi?.send) ? useMutation(messagesApi.sendMessage ?? messagesApi.send) : null;
  const markReadMutation = messagesApi?.markRead ? useMutation(messagesApi.markRead) : null;
  const reportMutation = messagesApi?.reportMessage ? useMutation(messagesApi.reportMessage) : null;
  const blockMutation = messagesApi?.block ? useMutation(messagesApi.block) : null;
  const unblockMutation = messagesApi?.unblock ? useMutation(messagesApi.unblock) : null;

  return {
    startConversation: async (otherUserId: string, listingId?: string): Promise<string> => {
      if (!startConvoMutation) {
        console.warn('startConversation called before messages backend initialized');
        return 'demo-conversation';
      }
      return await startConvoMutation({ otherUserId, recipientUserId: otherUserId, listingId });
    },
    sendMessage: async (conversationId: string, body: string): Promise<string> => {
      if (!sendMutation) {
        console.warn('sendMessage called before messages backend initialized');
        return 'demo-message-id';
      }
      return await sendMutation({ conversationId, body: body.trim() });
    },
    markRead: async (conversationId: string): Promise<void> => {
      if (!markReadMutation) return;
      try {
        await markReadMutation({ conversationId });
      } catch (err) {
        console.warn('markRead error:', err);
      }
    },
    reportMessage: async (messageId: string): Promise<{ reported: boolean; alreadyReported: boolean }> => {
      if (!reportMutation) {
        return { reported: false, alreadyReported: false };
      }
      return await reportMutation({ messageId });
    },
    blockUser: async (userId: string): Promise<void> => {
      if (!blockMutation) return;
      await blockMutation({ userId });
    },
    unblockUser: async (userId: string): Promise<void> => {
      if (!unblockMutation) return;
      await unblockMutation({ userId });
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
