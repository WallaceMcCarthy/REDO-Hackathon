import { convexTest } from 'convex-test';
import { defineSchema, makeFunctionReference } from 'convex/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import baseSchema from './schema';
import { jevTables } from './jevSchema';
import { TOPICS } from './lib/jev';

const schema = defineSchema({ ...baseSchema.tables, ...jevTables });
const suggest = makeFunctionReference<'action'>('jev:suggest');
const reserve = makeFunctionReference<'mutation'>('jev:reserve');
const availability = makeFunctionReference<'query'>('jev:availability');
async function setup() {
  vi.stubEnv('JEV_PREFERENCES_ENABLED', 'true');
  vi.stubEnv('JEV_API_KEY', 'fixture-key-never-real');
  const t = convexTest(schema, { './jev.ts': () => import('./jev'), './_generated/server.js': () => import('./_generated/server.js') });
  const userId = await t.run(ctx => ctx.db.insert('users', { email: 'fixture@example.test' }));
  return { t, userId, user: t.withIdentity({ subject: `${userId}|fixture` }) };
}
function reply() {
  return { model: 'jev-1.14.0', answers: Object.fromEntries([
    ...Object.keys(TOPICS).map(key => [`${key}_stated`, { type: 'noul', noul: 0.01 }]),
    ['mode_stated', { type: 'noul', noul: 0.01 }], ['budget_stated', { type: 'noul', noul: 0.01 }],
  ]) };
}
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('server-side preference suggestions', () => {
  it('requires a real signed-in account and the rollout flag before spending a call', async () => {
    const { t, user, userId } = await setup();
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    await expect(t.action(suggest, { text: 'Near trails please' })).rejects.toThrow('Sign in');
    vi.stubEnv('JEV_PREFERENCES_ENABLED', 'false');
    expect(await t.query(availability, {})).toEqual({ enabled: false, questionRevision: 3 });
    await expect(user.action(suggest, { text: 'Near trails please' })).rejects.toThrow('not available');
    vi.stubEnv('JEV_PREFERENCES_ENABLED', 'true');
    await t.run(ctx => ctx.db.delete(userId));
    await expect(user.action(suggest, { text: 'Near trails please' })).rejects.toThrow('Sign in');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('sends only entered text, pins the endpoint and keeps credentials out of results and storage', async () => {
    const { t, user } = await setup();
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(reply()), { status: 200 }));
    vi.stubGlobal('fetch', fetcher);
    const result = await user.action(suggest, { text: 'Near trails please' });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, options] = fetcher.mock.calls[0];
    expect(url).toBe('https://api.typesafe.ai/v1/systemone');
    expect(options.headers.Authorization).toBe('Bearer fixture-key-never-real');
    expect(JSON.parse(options.body).state).toEqual({ housing_preferences: 'Near trails please' });
    expect(JSON.stringify(result)).not.toContain('fixture-key');
    const stored = await t.run(ctx => ctx.db.query('jevQuota').collect());
    expect(stored).toHaveLength(3);
    expect(JSON.stringify(stored)).not.toContain('Near trails');
  });
  it('enforces atomic quotas including failed calls and hides provider error bodies', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-07T04:00:00Z'));
    const { user } = await setup();
    const fetcher = vi.fn().mockResolvedValue(new Response('fixture-key-never-real secret', { status: 429 }));
    vi.stubGlobal('fetch', fetcher);
    for (let i = 0; i < 3; i++) await expect(user.action(suggest, { text: 'Near trails please' })).rejects.toThrow('Could not suggest');
    await expect(user.action(suggest, { text: 'Near trails please' })).rejects.toThrow('limit reached');
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it('blocks global quota without calling provider and deletes expired counters', async () => {
    const { t, user } = await setup();
    const day = Math.floor(Date.now() / 86400000);
    await t.run(async ctx => {
      await ctx.db.insert('jevQuota', { key: `global:${day}`, count: 200, expiresAt: (day + 1) * 86400000 });
    });
    await expect(user.mutation(reserve, {})).rejects.toThrow('limit reached');
    await t.run(async ctx => {
      for (const r of await ctx.db.query('jevQuota').collect()) await ctx.db.delete(r._id);
      await ctx.db.insert('jevQuota', { key: 'expired', count: 1, expiresAt: 0 });
    });
    await user.mutation(reserve, {});
    expect(await t.run(ctx => ctx.db.query('jevQuota').collect())).toHaveLength(3);
  });
});
