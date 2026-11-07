import React, { useEffect, useState } from 'react';
import { useConvexAuth } from 'convex/react';
import { useInbox, useUnreadCount } from '../data/messagesHooks';
import ConversationList from '../components/messages/ConversationList';
import ConversationView from '../components/messages/ConversationView';

interface MessagesProps {
  conversationId?: string | null;
  onSignIn?: () => void;
  onBack: () => void;
}

export default function Messages({
  conversationId: propConversationId,
  onSignIn,
  onBack,
}: MessagesProps) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const inbox = useInbox();
  const unreadTotal = useUnreadCount();

  const [activeId, setActiveId] = useState<string | null>(propConversationId || null);

  // Sync prop conversationId if changed from URL hash
  useEffect(() => {
    if (propConversationId) {
      setActiveId(propConversationId);
    }
  }, [propConversationId]);

  // If activeId is not set but inbox loads and has items on desktop, select first conversation
  useEffect(() => {
    if (!activeId && inbox && inbox.length > 0 && window.innerWidth >= 768) {
      setActiveId(inbox[0]._id);
    }
  }, [inbox, activeId]);

  const activeMeta = inbox?.find((item) => item._id === activeId);

  const handleSelectConversation = (id: string) => {
    setActiveId(id);
    window.location.hash = `/messages/${id}`;
  };

  const handleBackToList = () => {
    setActiveId(null);
    window.location.hash = '/messages';
  };

  return (
    <main className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col px-3 py-4 sm:px-6 sm:py-6">
      {/* Top Bar */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex min-h-[44px] items-center cursor-pointer rounded-full border border-rock-300 px-4 py-2 text-sm font-semibold text-rock-700 hover:bg-rock-100 focus-visible:outline-2 focus-visible:outline-alpine-500"
          >
            ← Back to results
          </button>
          <div>
            <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">Messages</h1>
            {unreadTotal > 0 && (
              <p className="text-xs font-semibold text-alpine-700">
                {unreadTotal} unread message{unreadTotal === 1 ? '' : 's'}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Auth Guard */}
      {!isLoading && !isAuthenticated ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-3xl border border-dashed border-rock-300 bg-white p-8 text-center shadow-sm">
          <span className="text-4xl">💬</span>
          <h2 className="mt-4 font-display text-xl font-bold text-ink">Sign in to view messages</h2>
          <p className="mt-2 max-w-md text-xs text-dusk sm:text-sm">
            Chat directly with Utah roommates, landlords, and commenters regarding house and apartment listings.
          </p>
          <button
            type="button"
            onClick={onSignIn}
            className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-full bg-alpine-600 px-6 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-alpine-700 focus-visible:outline-2 focus-visible:outline-alpine-500 cursor-pointer"
          >
            Sign in or create account
          </button>
        </div>
      ) : (
        /* Main Messages Container */
        <div className="flex flex-1 overflow-hidden rounded-3xl border border-rock-200 bg-white shadow-sm">
          {/* Inbox Column: always on desktop (w-80), on mobile only if no active conversation */}
          <div
            className={`w-full md:w-80 md:border-r md:border-rock-200 ${
              activeId ? 'hidden md:flex md:flex-col' : 'flex flex-col'
            }`}
          >
            <ConversationList
              items={inbox}
              activeId={activeId}
              onSelect={handleSelectConversation}
            />
          </div>

          {/* Conversation Thread Column */}
          <div
            className={`flex-1 flex-col ${
              activeId ? 'flex' : 'hidden md:flex md:items-center md:justify-center'
            }`}
          >
            {activeId ? (
              <ConversationView
                conversationId={activeId}
                conversationMeta={activeMeta}
                onBack={handleBackToList}
              />
            ) : (
              <div className="p-8 text-center text-dusk">
                <span className="text-4xl">✉️</span>
                <p className="mt-3 text-sm font-medium text-ink">Select a conversation</p>
                <p className="mt-1 text-xs text-rock-400">
                  Choose a chat from the left or message someone from a listing.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
