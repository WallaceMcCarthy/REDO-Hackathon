import { describe, expect, it, beforeEach } from 'vitest';
import { openConversation, openMessagesInbox, type InboxItem } from '../../data/messagesHooks';

describe('messagesHooks and routing helpers', () => {
  beforeEach(() => {
    if (typeof window === 'undefined') {
      (globalThis as any).window = { location: { hash: '' } };
    } else {
      window.location.hash = '';
    }
  });

  it('updates window.location.hash with openConversation', () => {
    openConversation('conv-12345');
    expect(window.location.hash).toBe('/messages/conv-12345');
  });

  it('updates window.location.hash with openMessagesInbox', () => {
    openMessagesInbox();
    expect(window.location.hash).toBe('/messages');
  });

  it('handles message items structure correctly', () => {
    const item: InboxItem = {
      _id: 'conv-1',
      otherUserId: 'user-2',
      otherDisplayName: 'Sarah Miller',
      otherIsSample: true,
      listing: {
        id: 'home-123',
        name: 'Sugar House Craftsman',
        address: '1234 S 1100 E',
        kind: 'home',
        value: 580000,
        rent: null,
        cityId: 'salt-lake-city',
      },
      lastMessage: 'Is this still available for a roommate?',
      lastMessageAt: Date.now() - 3600000,
      unreadCount: 2,
      isBlockedByMe: false,
    };

    expect(item.otherDisplayName).toBe('Sarah Miller');
    expect(item.unreadCount).toBe(2);
    expect(item.listing?.cityId).toBe('salt-lake-city');
  });
});
