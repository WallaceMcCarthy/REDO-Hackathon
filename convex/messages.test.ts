import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { describe, expect, it } from "vitest";
import schema from "./schema";
import { deleteConversationsForUser } from "./messages";

const q = (name: string) => makeFunctionReference<"query">(`messages:${name}`);
const m = (name: string) => makeFunctionReference<"mutation">(`messages:${name}`);
const paginationOpts = { numItems: 2, cursor: null };
async function setup() {
  const t = convexTest(schema, {
    "./messages.ts": () => import("./messages"), "./social.ts": () => import("./social"),
    "./_generated/server.js": () => import("./_generated/server.js"),
  });
  const ids = await t.run(async ctx => {
    const ids = [];
    for (const name of ["Alice", "Bob", "Carol"]) {
      const userId = await ctx.db.insert("users", { email: `${name}@private.example` });
      await ctx.db.insert("profiles", { userId, displayName: name, cityId: null, moveBy: null, budget: null, household: null, isSample: name === "Alice" });
      ids.push(userId);
    }
    await ctx.db.insert("listings", { id: "home", cityId: "provo", kind: "home", name: null, address: "Fixture", lat: 40, lng: -111, value: 300000, rent: null, beds: null, sqft: null, yearBuilt: null, units: null, propertyType: null, source: "Fixture", sourceUrl: "https://example.test", year: 2026 });
    return ids;
  });
  const [alice, bob, carol] = ids.map(id => t.withIdentity({ subject: `${id}|fixture` }));
  return { t, ids, alice, bob, carol };
}

describe("private direct messages", () => {
  it("requires auth for every endpoint and denies outsider reads, sends, reports and read markers", async () => {
    const { t, ids, alice, carol } = await setup();
    const conversationId = await alice.mutation(m("startConversation"), { otherUserId: ids[1] });
    const messageId = await alice.mutation(m("sendMessage"), { conversationId, body: "Private text" });
    for (const name of ["myConversations", "inbox", "unreadTotal", "unreadCount"]) await expect(t.query(q(name), {})).rejects.toThrow("Sign in");
    await expect(t.query(q("messages"), { conversationId, paginationOpts })).rejects.toThrow("Sign in");
    for (const [name, args] of [["startConversation", { otherUserId: ids[1] }], ["sendMessage", { conversationId, body: "No" }], ["markRead", { conversationId }], ["block", { userId: ids[1] }], ["unblock", { userId: ids[1] }], ["reportMessage", { messageId }]] as const) await expect(t.mutation(m(name), args)).rejects.toThrow("Sign in");
    expect(await carol.query(q("myConversations"), {})).toEqual([]);
    await expect(carol.query(q("messages"), { conversationId, paginationOpts })).rejects.toThrow("not available");
    await expect(carol.mutation(m("sendMessage"), { conversationId, body: "Intrusion" })).rejects.toThrow("not available");
    await expect(carol.mutation(m("markRead"), { conversationId })).rejects.toThrow("not available");
    await expect(carol.mutation(m("reportMessage"), { messageId })).rejects.toThrow("not available");
  });

  it("deduplicates both directions per listing, rejects self-DMs and invalid contexts", async () => {
    const { ids, alice, bob } = await setup();
    const id = await alice.mutation(m("startConversation"), { recipientUserId: ids[1], listingId: "home" });
    expect(await bob.mutation(m("startConversation"), { otherUserId: ids[0], listingId: "home" })).toBe(id);
    expect(await alice.mutation(m("startConversation"), { otherUserId: ids[1] })).not.toBe(id);
    await expect(alice.mutation(m("startConversation"), { otherUserId: ids[0] })).rejects.toThrow();
    await expect(alice.mutation(m("startConversation"), { otherUserId: ids[1], listingId: "missing" })).rejects.toThrow();
    await expect(alice.mutation(m("startConversation"), { otherUserId: ids[1], recipientUserId: ids[2] })).rejects.toThrow();
  });

  it("paginates private text, derives sender/sample flags, and exposes no email", async () => {
    const { ids, alice, bob } = await setup();
    const conversationId = await alice.mutation(m("startConversation"), { otherUserId: ids[1], listingId: "home" });
    for (const body of ["First", "Second", "  Third  "]) await alice.mutation(m("send"), { conversationId, body });
    const first = await bob.query(q("thread"), { conversationId, paginationOpts });
    const second = await bob.query(q("messages"), { conversationId, paginationOpts: { numItems: 2, cursor: first.continueCursor } });
    expect(first.page.map((x: { body: string }) => x.body)).toEqual(["Third", "Second"]);
    expect(second.page.map((x: { body: string }) => x.body)).toEqual(["First"]);
    expect(second.isDone).toBe(true);
    expect(first.page[0]).toMatchObject({ senderUserId: ids[0], isMine: false, isSample: true });
    const inbox = await bob.query(q("inbox"), {});
    expect(inbox[0]).toMatchObject({ otherDisplayName: "Alice", lastMessage: "Third", listing: { id: "home" } });
    expect(JSON.stringify({ inbox, first, second })).not.toContain("private.example");
    await expect(bob.mutation(m("sendMessage"), { conversationId, body: "Fake", senderId: ids[0] })).rejects.toThrow();
    await expect(bob.mutation(m("sendMessage"), { conversationId, body: "Fake", isSample: true })).rejects.toThrow();
    for (const body of [" ", "x".repeat(2001), "bad\u0000text"]) await expect(bob.mutation(m("sendMessage"), { conversationId, body })).rejects.toThrow();
    await bob.mutation(m("sendMessage"), { conversationId, body: "x".repeat(2000) });
  });

  it("counts unread per recipient independently of timestamp ties and markRead is idempotent", async () => {
    const { ids, alice, bob } = await setup();
    const conversationId = await alice.mutation(m("startConversation"), { otherUserId: ids[1] });
    await alice.mutation(m("sendMessage"), { conversationId, body: "One" });
    await alice.mutation(m("sendMessage"), { conversationId, body: "Two" });
    expect(await alice.query(q("unreadTotal"), {})).toBe(0);
    expect(await bob.query(q("unreadCount"), {})).toBe(2);
    await bob.mutation(m("sendMessage"), { conversationId, body: "Reply" });
    expect(await bob.query(q("unreadTotal"), {})).toBe(2);
    expect(await alice.query(q("unreadTotal"), {})).toBe(1);
    await bob.mutation(m("markRead"), { conversationId });
    await bob.mutation(m("markRead"), { conversationId });
    expect(await bob.query(q("unreadTotal"), {})).toBe(0);
    await alice.mutation(m("sendMessage"), { conversationId, body: "Next" });
    expect(await bob.query(q("unreadTotal"), {})).toBe(1);
  });

  it("blocks starts/sends both ways, reveals only the user's own block, and supports unblock", async () => {
    const { ids, alice, bob } = await setup();
    const conversationId = await alice.mutation(m("startConversation"), { otherUserId: ids[1] });
    await alice.mutation(m("block"), { userId: ids[1] });
    await alice.mutation(m("block"), { userId: ids[1] });
    expect((await alice.query(q("inbox"), {}))[0].isBlockedByMe).toBe(true);
    expect((await bob.query(q("inbox"), {}))[0].isBlockedByMe).toBe(false);
    await expect(bob.mutation(m("startConversation"), { otherUserId: ids[0] })).rejects.toThrow("Conversation not available");
    await expect(bob.mutation(m("sendMessage"), { conversationId, body: "No" })).rejects.toThrow("Conversation not available");
    await expect(alice.mutation(m("sendMessage"), { conversationId, body: "No" })).rejects.toThrow("Conversation not available");
    await bob.mutation(m("unblock"), { userId: ids[0] });
    await expect(bob.mutation(m("sendMessage"), { conversationId, body: "Still blocked" })).rejects.toThrow();
    await alice.mutation(m("unblock"), { userId: ids[1] });
    await bob.mutation(m("sendMessage"), { conversationId, body: "Allowed" });
  });

  it("deduplicates reports, refuses self-reports, and cascades private data at account deletion", async () => {
    const { t, ids, alice, bob, carol } = await setup();
    const conversationId = await alice.mutation(m("startConversation"), { otherUserId: ids[1] });
    const messageId = await alice.mutation(m("sendMessage"), { conversationId, body: "Report fixture" });
    await expect(alice.mutation(m("reportMessage"), { messageId })).rejects.toThrow("own message");
    expect(await bob.mutation(m("reportMessage"), { messageId })).toMatchObject({ alreadyReported: false });
    expect(await bob.mutation(m("reportMessage"), { messageId })).toMatchObject({ alreadyReported: true });
    expect((await bob.query(q("thread"), { conversationId, paginationOpts })).page[0].hasReported).toBe(true);
    await bob.mutation(m("markRead"), { conversationId });
    await alice.mutation(m("block"), { userId: ids[1] });
    const kept = await bob.mutation(m("startConversation"), { otherUserId: ids[2] });
    await carol.mutation(m("sendMessage"), { conversationId: kept, body: "Keep" });
    await t.run(ctx => deleteConversationsForUser(ctx, ids[0]));
    const rows = await t.run(async ctx => ({ conversations: await ctx.db.query("conversations").collect(), messages: await ctx.db.query("messages").collect(), reads: await ctx.db.query("reads").collect(), reports: await ctx.db.query("contentReports").collect(), blocks: await ctx.db.query("userBlocks").collect() }));
    expect(rows.conversations.map(c => c._id)).toEqual([kept]);
    expect(rows.messages.map(m => m.body)).toEqual(["Keep"]);
    expect(rows.reads).toEqual([]); expect(rows.reports).toEqual([]); expect(rows.blocks).toEqual([]);
  });

  it("enforces sender-wide minute/day caps and a daily new-conversation cap", async () => {
    const { t, ids, alice } = await setup();
    const conversationId = await alice.mutation(m("startConversation"), { otherUserId: ids[1] });
    await t.run(async ctx => {
      for (let i = 0; i < 20; i++) await ctx.db.insert("messages", { conversationId, senderId: ids[0], body: "Fixture", createdAt: Date.now(), isSample: false });
    });
    await expect(alice.mutation(m("sendMessage"), { conversationId, body: "Over minute" })).rejects.toThrow("limit");
    await t.run(async ctx => {
      for (const row of await ctx.db.query("messages").collect()) await ctx.db.delete(row._id);
      for (let i = 0; i < 200; i++) await ctx.db.insert("messages", { conversationId, senderId: ids[0], body: "Fixture", createdAt: Date.now() - 120000, isSample: false });
    });
    await expect(alice.mutation(m("sendMessage"), { conversationId, body: "Over day" })).rejects.toThrow("limit");
    await t.run(async ctx => {
      for (let i = 0; i < 9; i++) await ctx.db.insert("conversations", { userA: ids[0], userB: ids[1], contextListingId: `fixture-${i}`, lastMessage: "", lastMessageAt: Date.now(), unreadA: 0, unreadB: 0, startedBy: ids[0], startedAt: Date.now() });
    });
    expect(await alice.mutation(m("startConversation"), { otherUserId: ids[1] })).toBe(conversationId);
    await expect(alice.mutation(m("startConversation"), { otherUserId: ids[2] })).rejects.toThrow("10 new conversations");
  });
});
