import { useMutation, useQuery } from 'convex/react';
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

// Safely access api.messages with canonical names from Edward (msg 281) & backward aliases
const messagesApi = (api as any).messages;

export function useInbox(): InboxItem[] | undefined {
  const queryFn = messagesApi?.myConversations ?? messagesApi?.inbox;
  if (!queryFn) return [];
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useQuery(queryFn);
}

export function useUnreadCount(): number {
  const queryFn = messagesApi?.unreadTotal ?? messagesApi?.unreadCount;
  if (!queryFn) return 0;
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const count = useQuery(queryFn);
  return typeof count === 'number' ? count : 0;
}

export function useThread(conversationId: string | null): ThreadResult | undefined {
  const queryFn = messagesApi?.messages ?? messagesApi?.thread;
  if (!conversationId || !queryFn) return undefined;
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const res = useQuery(queryFn, { conversationId, paginationOpts: { numItems: 50 } });
  if (!res) return undefined;
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
