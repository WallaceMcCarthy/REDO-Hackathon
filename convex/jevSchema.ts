import { defineTable } from 'convex/server';
import { v } from 'convex/values';

// Only transient quota counters, never prompts, replies, emails or API credentials.
export const jevTables = {
  jevQuota: defineTable({ key: v.string(), count: v.number(), expiresAt: v.number() })
    .index('by_key', ['key']).index('by_expiry', ['expiresAt']),
};
