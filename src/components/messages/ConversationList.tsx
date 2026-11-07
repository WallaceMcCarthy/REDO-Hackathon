import React, { useState } from 'react';
import type { InboxItem } from '../../data/messagesHooks';

interface ConversationListProps {
  items: InboxItem[] | undefined;
  activeId: string | null;
  onSelect: (id: string) => void;
}

function formatTime(timestamp: number): string {
  if (!timestamp) return '';
  const now = Date.now();
  const diff = now - timestamp;
  const mins = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;
  const d = new Date(timestamp);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function ConversationList({ items, activeId, onSelect }: ConversationListProps) {
  const [filter, setFilter] = useState('');

  if (items === undefined) {
    return (
      <div className="space-y-3 p-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex h-18 animate-pulse items-center gap-3 rounded-2xl bg-rock-100/60 p-3" />
        ))}
      </div>
    );
  }

  const filtered = items.filter((item) => {
    if (!filter.trim()) return true;
    const q = filter.toLowerCase();
    const nameMatch = item.otherDisplayName.toLowerCase().includes(q);
    const listingMatch =
      item.listing?.name?.toLowerCase().includes(q) || item.listing?.address?.toLowerCase().includes(q);
    const messageMatch = item.lastMessage.toLowerCase().includes(q);
    return nameMatch || listingMatch || messageMatch;
  });

  return (
    <div className="flex h-full flex-col">
      {/* Search Filter */}
      <div className="border-b border-rock-100 p-3">
        <label htmlFor="message-search" className="sr-only">
          Search conversations
        </label>
        <input
          id="message-search"
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter messages..."
          className="w-full rounded-xl border border-rock-100 bg-rock-50 px-3 py-2 text-xs text-ink placeholder:text-dusk focus:border-alpine-500 focus:bg-white focus:outline-none"
        />
      </div>

      {/* List */}
      <div className="flex-1 divide-y divide-rock-100 overflow-y-auto">
        {items.length === 0 ? (
          <div className="p-8 text-center">
            <span className="text-3xl">💬</span>
            <h3 className="mt-3 font-display text-sm font-semibold text-ink">No conversations yet</h3>
            <p className="mt-1 text-xs text-dusk">
              Connect with Utah renters, buyers, or commenters by clicking "Message" on any listing comment.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-center text-xs text-dusk">No conversations match "{filter}"</div>
        ) : (
          filtered.map((item) => {
            const isActive = item._id === activeId;
            const hasUnread = item.unreadCount > 0;

            return (
              <button
                key={item._id}
                type="button"
                className={`flex w-full cursor-pointer items-start gap-3 p-3 text-left transition-colors min-h-[56px] focus-visible:outline-2 focus-visible:outline-alpine-500 ${
                  isActive ? 'bg-alpine-50/70 border-l-4 border-alpine-700' : 'hover:bg-rock-50'
                }`}
                onClick={() => onSelect(item._id)}
              >
                {/* Avatar */}
                <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rock-100 font-semibold text-rock-800">
                  {item.otherDisplayName ? item.otherDisplayName.charAt(0).toUpperCase() : '?'}
                  {hasUnread && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-alpine-500 opacity-75" />
                      <span className="relative inline-flex h-3 w-3 rounded-full bg-alpine-700" />
                    </span>
                  )}
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className={`truncate text-xs font-semibold ${hasUnread ? 'text-ink' : 'text-rock-800'}`}>
                        {item.otherDisplayName}
                      </span>
                      {item.otherIsSample && (
                        <span className="rounded bg-amber-100 px-1 py-0.2 text-[9px] font-medium text-amber-800">
                          Sample
                        </span>
                      )}
                    </div>
                    <span className="shrink-0 text-[10px] text-dusk">
                      {formatTime(item.lastMessageAt)}
                    </span>
                  </div>

                  {/* Context Listing Tag if any */}
                  {item.listing && (
                    <div className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-alpine-700 font-medium">
                      <span>🏠</span>
                      <span className="truncate">
                        {item.listing.address || item.listing.name || 'Listing discussion'}
                      </span>
                    </div>
                  )}

                  {/* Message snippet */}
                  <p
                    className={`mt-0.5 truncate text-xs ${
                      hasUnread ? 'font-medium text-ink' : 'text-dusk'
                    }`}
                  >
                    {item.lastMessage || 'Started a conversation'}
                  </p>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
