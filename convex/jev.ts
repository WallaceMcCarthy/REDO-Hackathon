import { v, ConvexError } from 'convex/values';
import { action, internalMutation, query } from './_generated/server';
import { internal } from './_generated/api';
import { requireUserId } from './lib/auth';
import { preferenceRequest, interpretPreferences, type PreferenceProposal } from './lib/jev';

declare const process: { env: Record<string, string | undefined> };
const enabled = () => process.env.JEV_PREFERENCES_ENABLED === 'true' && !!process.env.JEV_API_KEY;
export const availability = query({ args: {}, handler: () => ({ enabled: enabled(), questionRevision: 3 }) });

export const reserve = internalMutation({
  args: {},
  handler: async ctx => {
    const userId = await requireUserId(ctx);
    if (!enabled()) throw new ConvexError('Preference suggestions are not available yet.');
    const now = Date.now(), minute = Math.floor(now / 60000), day = Math.floor(now / 86400000);
    const limits = [
      { key: `minute:${userId}:${minute}`, max: 3, expiresAt: (minute + 1) * 60000 },
      { key: `day:${userId}:${day}`, max: 20, expiresAt: (day + 1) * 86400000 },
      { key: `global:${day}`, max: 200, expiresAt: (day + 1) * 86400000 },
    ];
    const rows = await Promise.all(limits.map(l => ctx.db.query('jevQuota').withIndex('by_key', q => q.eq('key', l.key)).unique()));
    if (rows.some((r, i) => (r?.count ?? 0) >= limits[i].max)) throw new ConvexError('Suggestion limit reached. Please try again later or adjust the sliders yourself.');
    for (let i = 0; i < limits.length; i++) {
      const row = rows[i], limit = limits[i];
      if (row) await ctx.db.patch(row._id, { count: row.count + 1 });
      else await ctx.db.insert('jevQuota', { key: limit.key, expiresAt: limit.expiresAt, count: 1 });
    }
    for (const row of await ctx.db.query('jevQuota').withIndex('by_expiry', q => q.lt('expiresAt', now)).take(100)) await ctx.db.delete(row._id);
  },
});

export const suggest = action({
  args: { text: v.string() },
  handler: async (ctx, { text }): Promise<PreferenceProposal> => {
    const request = preferenceRequest(text);
    await ctx.runMutation(internal.jev.reserve, {});
    try {
      const response = await fetch('https://api.typesafe.ai/v1/systemone', {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
        headers: { Authorization: `Bearer ${process.env.JEV_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(request.body),
      });
      if (!response.ok) throw new Error('Provider request failed');
      return interpretPreferences(await response.json(), request.amounts);
    } catch {
      // Do not return provider error bodies: they can echo submitted text or credentials.
      throw new ConvexError('Could not suggest priorities. Please try again or use the sliders.');
    }
  },
});
