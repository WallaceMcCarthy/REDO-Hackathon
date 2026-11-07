import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Id, TableNames } from "./_generated/dataModel";
import schema from "./schema";

const modules = {
  "./account.ts": () => import("./account"),
  "./ads.ts": () => import("./ads"),
  "./posts.ts": () => import("./posts"),
  "./profiles.ts": () => import("./profiles"),
  "./roommates.ts": () => import("./roommates"),
  "./social.ts": () => import("./social"),
  "./_generated/api.js": () => import("./_generated/api.js"),
  "./_generated/server.js": () => import("./_generated/server.js"),
};
const refs = {
  deleteMyAccount: makeFunctionReference<"mutation">("account:deleteMyAccount"),
  sweep: makeFunctionReference<"mutation">("account:sweep"),
  getMe: makeFunctionReference<"query">("profiles:getMe"),
  createPost: makeFunctionReference<"mutation">("posts:create"),
  savedIds: makeFunctionReference<"query">("social:savedIds"),
  toggleSaved: makeFunctionReference<"mutation">("social:toggleSaved"),
  addComment: makeFunctionReference<"mutation">("social:addComment"),
  comments: makeFunctionReference<"query">("social:comments"),
  pins: makeFunctionReference<"query">("ads:getActivePins"),
  fulfill: makeFunctionReference<"mutation">("ads:fulfillRedoPayment"),
  matches: makeFunctionReference<"query">("roommates:matches"),
};

type T = ReturnType<typeof convexTest>;
type Row = Record<string, unknown>;

const tables = Object.keys(schema.tables) as TableNames[];

async function dump(t: T) {
  return t.run(async (ctx) => {
    const out = {} as Record<TableNames, Row[]>;
    for (const table of tables) out[table] = await ctx.db.query(table).collect();
    return out;
  });
}

const mentions = (row: Row, needles: string[]) => needles.some((needle) => JSON.stringify(row).includes(needle));

/** Every row in every table that still names one of the needles, as "table: json". */
async function leftovers(t: T, needles: string[]) {
  const all = await dump(t);
  return tables.flatMap((table) => all[table].filter((row) => mentions(row, needles)).map((row) => `${table}: ${JSON.stringify(row)}`));
}

const finish = (t: T) => t.finishAllScheduledFunctions(vi.runAllTimers);

const roommate = (userId: Id<"users">) => ({
  userId, budgetMin: 500, budgetMax: 1500, cityIds: ["provo"], moveIn: 1, tags: [], bio: "Hi", contact: `${userId}@contact.test`, active: true, isSample: false,
});
const post = (userId: Id<"users">, extra = {}) => ({ cityId: "provo", userId, body: "A post", likes: 0, reports: 0, hidden: false, isSample: false, ...extra });
const comment = (userId: Id<"users">, targetId = "provo", extra = {}) => ({
  targetType: "town" as const, targetId, userId, body: "A comment", parentId: null, reports: 0, hidden: false, isSample: false, ...extra,
});
const campaign = (advertiserUserId: Id<"users">, extra = {}) => ({
  advertiserUserId, kind: "pin" as const, title: "Alice's Bakery", body: "Call 555-0100", url: "https://alice.test", lat: 40, lng: -111, cityId: "provo",
  startsAt: Date.now() - 1000, endsAt: Date.now() + 1_000_000, status: "active" as const, impressions: 7, clicks: 2, isSample: false, expectedAmount: 3500, expectedCurrency: "USD", ...extra,
});

async function setup() {
  const t = convexTest(schema, modules);
  const [alice, bob, carol] = await t.run(async (ctx) => {
    await ctx.db.insert("cities", { id: "provo", name: "Provo", county: "Utah", lat: 40, lng: -111, population: 100, blurb: "Fixture" });
    await ctx.db.insert("listings", {
      id: "parcel-1", cityId: "provo", kind: "home", name: null, address: "Fixture", lat: 40, lng: -111, value: 1, rent: null, beds: null, sqft: 1,
      yearBuilt: 1980, units: 1, propertyType: "Residential", source: "Fixture", sourceUrl: "https://example.test", year: 2025,
    });
    const ids = [];
    for (const name of ["alice", "bob", "carol"]) {
      const userId = await ctx.db.insert("users", { email: `${name}@example.test` });
      await ctx.db.insert("profiles", { userId, displayName: name, cityId: null, moveBy: null, budget: null, household: null, isSample: false });
      ids.push(userId);
    }
    return ids;
  });
  const as = (id: Id<"users">) => t.withIdentity({ subject: `${id}|test-session` });
  return { t, alice, bob, carol, asAlice: as(alice), asBob: as(bob) };
}

/** Alice has a row of every kind, Bob and Carol have their own, and they interact in both directions. */
async function seedEverything(t: T, alice: Id<"users">, bob: Id<"users">, carol: Id<"users">) {
  return t.run(async (ctx) => {
    const auth = async (userId: Id<"users">, email: string) => {
      const accountId = await ctx.db.insert("authAccounts", { userId, provider: "password", providerAccountId: email, secret: "hash" });
      await ctx.db.insert("authVerificationCodes", { accountId, provider: "password", code: `code-${userId}`, expirationTime: 1 });
      await ctx.db.insert("authRateLimits", { identifier: accountId, lastAttemptTime: 1, attemptsLeft: 3 });
      const sessionIds = [];
      for (let i = 0; i < 2; i++) {
        const sessionId = await ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 1000 });
        await ctx.db.insert("authRefreshTokens", { sessionId, expirationTime: Date.now() + 1000 });
        sessionIds.push(sessionId);
      }
      return [accountId as string, ...sessionIds];
    };
    const aliceAuthIds = await auth(alice, "alice@example.test");
    await auth(bob, "bob@example.test");

    await ctx.db.insert("saved", { userId: alice, listingId: "parcel-1" });
    const bobSaved = await ctx.db.insert("saved", { userId: bob, listingId: "parcel-1" });

    const aliceRoot = await ctx.db.insert("comments", comment(alice));
    const bobReply = await ctx.db.insert("comments", comment(bob, "provo", { parentId: aliceRoot }));
    const bobRoot = await ctx.db.insert("comments", comment(bob, "provo", { reports: 1 }));
    await ctx.db.insert("comments", comment(alice, "provo", { parentId: bobRoot }));
    await ctx.db.insert("contentReports", { targetType: "comment", targetId: aliceRoot, userId: bob });
    await ctx.db.insert("contentReports", { targetType: "comment", targetId: bobRoot, userId: alice });

    const alicePost = await ctx.db.insert("posts", post(alice, { likes: 1, reports: 1 }));
    await ctx.db.insert("postLikes", { postId: alicePost, userId: bob });
    await ctx.db.insert("comments", comment(bob, alicePost, { targetType: "post" }));
    await ctx.db.insert("contentReports", { targetType: "post", targetId: alicePost, userId: carol });

    const bobPost = await ctx.db.insert("posts", post(bob, { likes: 2, reports: 2 }));
    await ctx.db.insert("postLikes", { postId: bobPost, userId: alice });
    await ctx.db.insert("postLikes", { postId: bobPost, userId: carol });
    await ctx.db.insert("contentReports", { targetType: "post", targetId: bobPost, userId: alice });
    await ctx.db.insert("contentReports", { targetType: "post", targetId: bobPost, userId: carol });
    const bobComment = await ctx.db.insert("comments", comment(carol, bobPost, { targetType: "post" }));

    await ctx.db.insert("roommateProfiles", roommate(alice));
    await ctx.db.insert("roommateProfiles", roommate(bob));
    await ctx.db.insert("connections", { fromUserId: alice, toUserId: bob, status: "accepted" });
    await ctx.db.insert("connections", { fromUserId: carol, toUserId: alice, status: "pending" });
    const bobCarol = await ctx.db.insert("connections", { fromUserId: bob, toUserId: carol, status: "accepted" });

    const paid = await ctx.db.insert("campaigns", campaign(alice, { redoPaymentId: "pay_1" }));
    const payment = await ctx.db.insert("payments", { campaignId: paid, redoPaymentId: "pay_1", amount: 3500, currency: "USD", status: "succeeded", rawEventId: "evt_1" });
    const pending = await ctx.db.insert("campaigns", campaign(alice, { status: "pending_payment" }));
    const bobCampaign = await ctx.db.insert("campaigns", campaign(bob, { title: "Bob's Bikes", body: "Bikes", url: "https://bob.test" }));

    return { aliceAuthIds, bobSaved, bobReply, bobRoot, alicePost, bobPost, bobComment, bobCarol, paid, payment, pending, bobCampaign };
  });
}

beforeEach(() => void vi.useFakeTimers());
afterEach(() => void vi.useRealTimers());

describe("deleteMyAccount", () => {
  it("rejects a signed-out caller and changes nothing", async () => {
    const { t, alice, bob, carol } = await setup();
    await seedEverything(t, alice, bob, carol);
    const before = await dump(t);
    await expect(t.mutation(refs.deleteMyAccount, {})).rejects.toThrow("Sign in");
    await finish(t);
    expect(await dump(t)).toEqual(before);
  });

  it("takes no client user id, so one user cannot delete another", async () => {
    const { t, alice, bob, carol, asAlice, asBob } = await setup();
    await seedEverything(t, alice, bob, carol);
    const before = await dump(t);
    await expect(asBob.mutation(refs.deleteMyAccount, { userId: alice })).rejects.toThrow();
    await finish(t);
    expect(await dump(t)).toEqual(before);

    await asBob.mutation(refs.deleteMyAccount, {});
    await finish(t);
    expect(await asAlice.query(refs.getMe, {})).toMatchObject({ email: "alice@example.test" });
    expect(await leftovers(t, [bob])).toEqual([]);
    expect(await t.run((ctx) => ctx.db.get(alice))).not.toBeNull();
  });

  it("leaves nothing referencing the user in any table", async () => {
    const { t, alice, bob, carol, asAlice } = await setup();
    const { aliceAuthIds, alicePost } = await seedEverything(t, alice, bob, carol);
    const needles = [alice, "alice@example.test", ...aliceAuthIds];
    expect((await leftovers(t, needles)).length).toBeGreaterThan(15);

    await asAlice.mutation(refs.deleteMyAccount, {});
    await finish(t);

    expect(await leftovers(t, needles)).toEqual([]);
    expect(await leftovers(t, [alicePost, "Alice's Bakery", "555-0100", "alice.test"])).toEqual([]);
  });

  it("keeps other users' data, correcting only counts and thread position", async () => {
    const { t, alice, bob, carol, asAlice } = await setup();
    const ids = await seedEverything(t, alice, bob, carol);
    const before = await dump(t);
    await asAlice.mutation(refs.deleteMyAccount, {});
    await finish(t);
    const after = await dump(t);

    const needles = [alice, ...ids.aliceAuthIds];
    for (const table of ["users", "profiles", "saved", "roommateProfiles", "connections", "authAccounts", "authSessions", "authRefreshTokens", "authVerificationCodes", "authRateLimits", "cities", "listings"] as const) {
      expect(after[table], table).toEqual(before[table].filter((row) => !mentions(row, needles) && !mentions(row, ["alice@example.test"])));
    }
    const row = async (id: Id<"posts"> | Id<"comments">) => t.run((ctx) => ctx.db.get(id));
    expect(await row(ids.bobPost)).toMatchObject({ likes: 1, reports: 1, hidden: false });
    expect(await row(ids.bobRoot)).toMatchObject({ reports: 0 });
    expect(await row(ids.bobComment)).not.toBeNull();
    expect(await row(ids.bobReply)).toMatchObject({ parentId: null, body: "A comment" });
    expect(await t.run((ctx) => ctx.db.get(ids.bobCampaign))).toMatchObject({ title: "Bob's Bikes", status: "active", advertiserUserId: bob });
    expect(after.postLikes).toHaveLength(1);
    expect(after.contentReports).toHaveLength(1);
  });

  it("keeps payments and anonymized campaigns, and ends the ads", async () => {
    const { t, alice, bob, carol, asAlice } = await setup();
    const ids = await seedEverything(t, alice, bob, carol);
    const payment = await t.run((ctx) => ctx.db.get(ids.payment));
    expect(await t.query(refs.pins, {})).toHaveLength(2);

    await asAlice.mutation(refs.deleteMyAccount, {});
    await finish(t);

    expect(await t.run((ctx) => ctx.db.get(ids.payment))).toEqual(payment);
    const paid = await t.run((ctx) => ctx.db.get(ids.paid));
    expect(paid).toMatchObject({ status: "expired", redoPaymentId: "pay_1", expectedAmount: 3500, impressions: 7, clicks: 2, title: "Deleted advertiser", body: "", url: "" });
    expect(paid!.advertiserUserId).toBeUndefined();
    expect(paid!.lat).toBeUndefined();
    expect(paid!.endsAt).toBeLessThanOrEqual(Date.now());
    expect((await t.query(refs.pins, {})).map((pin: { title: string }) => pin.title)).toEqual(["Bob's Bikes"]);
  });

  it("records a late payment for a deleted advertiser without putting a blank ad live", async () => {
    const { t, alice, bob, carol, asAlice } = await setup();
    const { pending } = await seedEverything(t, alice, bob, carol);
    await asAlice.mutation(refs.deleteMyAccount, {});
    await finish(t);

    const result = await t.mutation(refs.fulfill, { campaignId: pending, redoPaymentId: "pay_late", amount: 3500, currency: "USD", rawEventId: "evt_late" });

    expect(result).toEqual({ status: "recorded_without_activation" });
    expect(await t.run((ctx) => ctx.db.get(pending))).toMatchObject({ status: "expired", redoPaymentId: "pay_late" });
    expect(await t.run((ctx) => ctx.db.query("payments").withIndex("by_rawEventId", (q) => q.eq("rawEventId", "evt_late")).first())).toMatchObject({ amount: 3500 });
  });

  it("locks out a still-valid token as soon as the mutation commits, before the sweep runs", async () => {
    const { t, alice, bob, carol, asAlice } = await setup();
    await seedEverything(t, alice, bob, carol);
    await asAlice.mutation(refs.deleteMyAccount, {});

    expect(await asAlice.query(refs.getMe, {})).toBeNull();
    expect(await asAlice.query(refs.savedIds, {})).toEqual([]);
    expect(await asAlice.query(refs.matches, {})).toEqual([]);
    await expect(asAlice.mutation(refs.createPost, { cityId: "provo", body: "From beyond" })).rejects.toThrow("Sign in");
    await expect(asAlice.mutation(refs.addComment, { targetType: "town", targetId: "provo", body: "From beyond" })).rejects.toThrow("Sign in");
    await expect(asAlice.mutation(refs.toggleSaved, { listingId: "parcel-1" })).rejects.toThrow("Sign in");
    expect(await t.run((ctx) => ctx.db.query("authAccounts").withIndex("providerAndAccountId", (q) => q.eq("provider", "password").eq("providerAccountId", "alice@example.test")).first())).toBeNull();
    await finish(t);
  });

  it("converges when retried: repeat calls and overlapping sweeps correct counts once", async () => {
    const { t, alice, bob, carol, asAlice } = await setup();
    const ids = await seedEverything(t, alice, bob, carol);
    const needles = [alice, ...ids.aliceAuthIds];
    await asAlice.mutation(refs.deleteMyAccount, {});
    await expect(asAlice.mutation(refs.deleteMyAccount, {})).rejects.toThrow("Sign in");

    await Promise.all([t.mutation(refs.sweep, { userId: alice }), t.mutation(refs.sweep, { userId: alice })]);
    await finish(t);
    const settled = await dump(t);
    await t.mutation(refs.sweep, { userId: alice });
    await finish(t);

    expect(await dump(t)).toEqual(settled);
    expect(await leftovers(t, needles)).toEqual([]);
    expect(await t.run((ctx) => ctx.db.get(ids.bobPost))).toMatchObject({ likes: 1, reports: 1 });
  });

  it("does not restore moderated content when a reporter leaves, but frees their report", async () => {
    const { t, alice, bob, carol, asAlice } = await setup();
    const hidden = await t.run(async (ctx) => {
      const postId = await ctx.db.insert("posts", post(bob, { reports: 3, hidden: true }));
      for (const userId of [alice, carol]) await ctx.db.insert("contentReports", { targetType: "post", targetId: postId, userId });
      return postId;
    });
    await asAlice.mutation(refs.deleteMyAccount, {});
    await finish(t);
    expect(await t.run((ctx) => ctx.db.get(hidden))).toMatchObject({ reports: 2, hidden: true });
  });

  it("splits a heavy account across runs, keeping replies and likes correct", async () => {
    const { t, alice, bob, asAlice } = await setup();
    const N = 450;
    const { popularComment, popularPost, bobPost } = await t.run(async (ctx) => {
      const popularComment = await ctx.db.insert("comments", comment(alice));
      const popularPost = await ctx.db.insert("posts", post(alice));
      const bobPost = await ctx.db.insert("posts", post(bob, { likes: N }));
      for (let i = 0; i < N; i++) {
        await ctx.db.insert("comments", comment(bob, "provo", { parentId: popularComment }));
        await ctx.db.insert("comments", comment(bob, popularPost, { targetType: "post" }));
        await ctx.db.insert("postLikes", { postId: popularPost, userId: bob });
        await ctx.db.insert("posts", post(alice));
        await ctx.db.insert("comments", comment(alice));
        await ctx.db.insert("saved", { userId: alice, listingId: `parcel-${i}` });
        await ctx.db.insert("connections", { fromUserId: alice, toUserId: bob, status: "pending" });
        await ctx.db.insert("connections", { fromUserId: bob, toUserId: alice, status: "pending" });
        const sessionId = await ctx.db.insert("authSessions", { userId: alice, expirationTime: 1 });
        await ctx.db.insert("authRefreshTokens", { sessionId, expirationTime: 1 });
        const liked = await ctx.db.insert("posts", post(bob, { likes: 1 }));
        await ctx.db.insert("postLikes", { postId: liked, userId: alice });
      }
      const session = await ctx.db.insert("authSessions", { userId: alice, expirationTime: 1 });
      for (let i = 0; i < N; i++) await ctx.db.insert("authRefreshTokens", { sessionId: session, expirationTime: 1 });
      return { popularComment, popularPost, bobPost };
    });

    await asAlice.mutation(refs.deleteMyAccount, {});
    const rowCount = async () => Object.values(await dump(t)).reduce((sum, rows) => sum + rows.length, 0);
    const needles = [alice, "alice@example.test", popularPost, popularComment];
    let rows = await rowCount();
    let biggestRun = 0;
    let runs = 0;
    while ((await leftovers(t, needles)).length > 0 && runs < 100) {
      await t.mutation(refs.sweep, { userId: alice });
      const next = await rowCount();
      biggestRun = Math.max(biggestRun, rows - next);
      rows = next;
      runs++;
    }
    expect(runs).toBeGreaterThan(10);
    expect(runs).toBeLessThan(100);
    expect(biggestRun).toBeGreaterThan(100);
    expect(biggestRun).toBeLessThanOrEqual(200);
    await t.finishAllScheduledFunctions(vi.runAllTimers, 2000);

    expect(await leftovers(t, needles)).toEqual([]);
    const all = await dump(t);
    expect(all.comments.filter((row) => row.targetId === "provo")).toHaveLength(N);
    expect(all.comments.every((row) => row.parentId === null)).toBe(true);
    expect(all.posts.filter((row) => row._id !== bobPost).every((row) => row.likes === 0)).toBe(true);
    expect(all.postLikes).toEqual([]);
  });
});
