import React, { useEffect, useState } from 'react';
import { useConvexAuth } from 'convex/react';
import { useInbox, useUnreadCount } from '../data/messagesHooks';
import ConversationList from '../components/messages/ConversationList';
import ConversationView from '../components/messages/ConversationView';
import SafeSectionBoundary from '../components/SafeSectionBoundary';
import { Button, EmptyState } from '../components/ui';

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
          <Button variant="ghost" size="sm" onClick={onBack}>← Back to results</Button>
          <div>
            <h1 className="font-display text-heading text-text">Messages</h1>
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
        <EmptyState
          className="mt-stack w-full"
          title="Sign in to view messages"
          description="Chat directly with Utah roommates, landlords, and commenters regarding house and apartment listings."
          action={<Button onClick={onSignIn}>Sign in or create account</Button>}
        />
      ) : (
        /* Main Messages Container */
        <div className="flex flex-1 overflow-hidden rounded-3xl border border-rock-100 bg-white shadow-sm">
          {/* Inbox Column: always on desktop (w-80), on mobile only if no active conversation */}
          <div
            className={`w-full md:w-80 md:border-r md:border-rock-100 ${
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
            className={`min-w-0 flex-1 flex-col ${
              activeId ? 'flex' : 'hidden md:flex md:items-center md:justify-center'
            }`}
          >
            {activeId ? (
              // Keyed so a conversation that vanishes (the other person deleted their account) resets on Back.
              <SafeSectionBoundary
                key={activeId}
                fallback={<EmptyState title="That conversation is not available" action={<Button onClick={handleBackToList}>Back to messages</Button>} />}
              >
                <ConversationView
                  conversationId={activeId}
                  conversationMeta={activeMeta}
                  onBack={handleBackToList}
                />
              </SafeSectionBoundary>
            ) : (
              <div className="p-8 text-center text-dusk">
                <span aria-hidden="true" className="mx-auto grid size-11 place-items-center rounded-pill bg-alpine-100 text-alpine-700">
                  <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5h16v11H9l-5 4z" /></svg>
                </span>
                <p className="mt-3 text-sm font-medium text-ink">Select a conversation</p>
                <p className="mt-1 text-xs text-dusk">
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
