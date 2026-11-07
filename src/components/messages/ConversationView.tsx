import React, { useEffect, useRef, useState } from 'react';
import { ConvexError } from 'convex/values';
import { useMessagesActions, useThread, type InboxItem } from '../../data/messagesHooks';

interface ConversationViewProps {
  conversationId: string;
  conversationMeta?: InboxItem;
  onBack?: () => void;
}

function formatMessageTime(timestamp: number): string {
  if (!timestamp) return '';
  const d = new Date(timestamp);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export default function ConversationView({
  conversationId,
  conversationMeta,
  onBack,
}: ConversationViewProps) {
  const thread = useThread(conversationId);
  const { sendMessage, markRead } = useMessagesActions();
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Mark read when conversation is opened or new messages arrive
  useEffect(() => {
    if (conversationId) {
      void markRead(conversationId);
    }
  }, [conversationId, thread?.page.length]);

  // Scroll to bottom on message update
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [thread?.page.length, conversationId]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;

    if (text.length > 2000) {
      setSendError('Message exceeds maximum 2,000 characters.');
      return;
    }

    setSending(true);
    setSendError(null);
    try {
      await sendMessage(conversationId, text);
      setDraft('');
    } catch (err) {
      setSendError(err instanceof ConvexError ? String(err.data) : 'Failed to deliver message. Try again.');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const otherName = conversationMeta?.otherDisplayName || 'Participant';
  const listing = conversationMeta?.listing;

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Thread Header */}
      <div className="flex items-center justify-between border-b border-rock-100 px-4 py-3 bg-white">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-rock-600 hover:bg-rock-100 focus-visible:outline-2 focus-visible:outline-alpine-500"
              aria-label="Back to conversations list"
            >
              ←
            </button>
          )}

          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-alpine-100 text-sm font-bold text-alpine-900">
            {otherName.charAt(0).toUpperCase()}
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="font-display text-sm font-bold text-ink">{otherName}</h2>
              {conversationMeta?.otherIsSample && (
                <span className="rounded bg-amber-100 px-1.5 py-0.2 text-[9px] font-medium text-amber-800">
                  Sample
                </span>
              )}
            </div>
            {listing && (
              <p className="text-[11px] text-dusk truncate max-w-xs sm:max-w-md">
                Re: {listing.address || listing.name || 'Listing'}
                {listing.rent ? ` ($${listing.rent}/mo)` : listing.value ? ` ($${Math.round(listing.value / 1000)}k)` : ''}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Listing Context Banner if present */}
      {listing && (
        <div className="flex items-center justify-between border-b border-rock-100 bg-rock-50/80 px-4 py-2 text-xs">
          <div className="flex items-center gap-2 truncate">
            <span>🏠</span>
            <span className="font-medium text-ink truncate">{listing.name || listing.address}</span>
            <span className="text-dusk">({listing.cityId})</span>
          </div>
          <a
            href={`#/town/${listing.cityId}`}
            className="shrink-0 text-[11px] font-semibold text-alpine-700 hover:underline"
          >
            View Area →
          </a>
        </div>
      )}

      {/* Message Feed */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {thread === undefined ? (
          <div className="space-y-3 py-6">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={`h-12 w-2/3 animate-pulse rounded-2xl bg-rock-100/70 ${
                  i % 2 === 0 ? 'ml-auto' : 'mr-auto'
                }`}
              />
            ))}
          </div>
        ) : thread.page.length === 0 ? (
          <div className="py-12 text-center text-xs text-dusk">
            <span>👋</span>
            <p className="mt-2 font-medium">Say hello to {otherName}!</p>
            <p className="mt-0.5 text-[11px] text-dusk">
              Discuss rent, schedules, or coordinate a meetup.
            </p>
          </div>
        ) : (
          thread.page.map((msg) => {
            const isMine = msg.isMine;

            return (
              <div
                key={msg._id}
                className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed break-words [overflow-wrap:anywhere] ${
                    isMine
                      ? 'bg-alpine-700 text-white rounded-tr-xs shadow-sm'
                      : 'bg-rock-100 text-ink rounded-tl-xs'
                  }`}
                >
                  {/* Strict plain text rendering to prevent XSS */}
                  <span className="whitespace-pre-wrap">{msg.body}</span>
                </div>
                <span className="mt-1 px-1 text-[10px] text-dusk">
                  {formatMessageTime(msg.createdAt)}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Error alert if send failed */}
      {sendError && (
        <div className="border-t border-red-200 bg-red-50 px-4 py-1.5 text-xs text-red-700">
          {sendError}
        </div>
      )}

      {/* Composer */}
      <form onSubmit={handleSend} className="border-t border-rock-100 p-3 bg-white">
        <div className="flex items-end gap-2">
          <textarea
            rows={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${otherName}... (Enter to send)`}
            maxLength={2000}
            className="flex-1 min-h-[44px] max-h-32 resize-none rounded-xl border border-rock-100 p-2.5 text-xs text-ink placeholder:text-dusk focus:border-alpine-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!draft.trim() || sending}
            className="inline-flex min-h-[44px] min-w-[64px] items-center justify-center rounded-xl bg-alpine-700 px-4 py-2 text-xs font-semibold text-white transition-opacity hover:bg-alpine-700 focus-visible:outline-2 focus-visible:outline-alpine-500 disabled:opacity-40 cursor-pointer"
          >
            {sending ? '...' : 'Send'}
          </button>
        </div>
        <div className="mt-1 flex justify-between px-1 text-[10px] text-dusk">
          <span>Shift+Enter for new line</span>
          <span>{draft.length}/2000</span>
        </div>
      </form>
    </div>
  );
}
