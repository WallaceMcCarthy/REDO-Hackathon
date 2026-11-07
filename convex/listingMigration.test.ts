import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { expect, it } from "vitest";
import schema from "./schema";
import apartments from "../data/listings/apartments.json";
import migration from "../data/listings/apartments_id_migration.json";

it("previews and migrates only verified identities, preserves threads and deduplicates saved records", async () => {
  const mapping = migration.mappings.find(row => !row.collisionBetweenReleases && apartments.some(a => a.id === row.newStableId))!;
  const target = apartments.find(row => row.id === mapping.newStableId)!;
  const other = migration.mappings.find(row => !row.collisionBetweenReleases && row.oldId !== mapping.oldId && row.newStableId !== target.id && apartments.some(a => a.id === row.newStableId))!;
  const otherTarget = apartments.find(row => row.id === other.newStableId)!;
  const collision = migration.mappings.find(row => row.collisionBetweenReleases)!;
  const t = convexTest(schema, { "./listingMigration.ts": () => import("./listingMigration"), "./_generated/server.js": () => import("./_generated/server.js") });
  await t.run(async ctx => {
    const a = await ctx.db.insert("users", { email: "a@example.test" }), b = await ctx.db.insert("users", { email: "b@example.test" });
    await ctx.db.insert("listings", { ...target, id: mapping.oldId, kind: "apartment" });
    // A reused positional ID with the wrong coordinates must never carry references over.
    await ctx.db.insert("listings", { ...otherTarget, id: other.oldId, kind: "apartment", lat: otherTarget.lat + 0.01 });
    await ctx.db.insert("listings", { ...target, id: collision.oldId, kind: "apartment" });
    await ctx.db.insert("saved", { userId: a, listingId: mapping.oldId });
    await ctx.db.insert("saved", { userId: a, listingId: target.id });
    await ctx.db.insert("saved", { userId: b, listingId: mapping.oldId });
    await ctx.db.insert("saved", { userId: b, listingId: other.oldId });
    await ctx.db.insert("saved", { userId: b, listingId: collision.oldId });
    const root = await ctx.db.insert("comments", { targetType: "listing", targetId: mapping.oldId, userId: a, body: "Root", parentId: null, reports: 0, hidden: false, isSample: false });
    await ctx.db.insert("comments", { targetType: "listing", targetId: mapping.oldId, userId: b, body: "Reply", parentId: root, reports: 0, hidden: false, isSample: false });
    await ctx.db.insert("conversations", { userA: a, userB: b, contextListingId: mapping.oldId, startedBy: a, startedAt: 1, lastMessage: "Private", lastMessageAt: 1, unreadA: 0, unreadB: 1 });
  });
  const ref = makeFunctionReference<"mutation">("listingMigration:migrateLegacyApartmentReferences");
  const preview = await t.mutation(ref, {});
  expect(preview).toMatchObject({ dryRun: true, verifiedMappings: 1, savedUpdated: 1, savedDeduplicated: 1, commentsUpdated: 2, conversationContextsUpdated: 1, unresolvedSaved: 2, unresolvedComments: 0, unresolvedConversationContexts: 0 });
  const savedBefore = await t.run(ctx => ctx.db.query("saved").collect());
  expect(savedBefore).toHaveLength(5);
  expect(savedBefore.filter(s => s.listingId === mapping.oldId)).toHaveLength(2);
  const applied = await t.mutation(ref, { dryRun: false });
  expect(applied).toEqual({ ...preview, dryRun: false });
  const after = await t.run(async ctx => ({ saved: await ctx.db.query("saved").collect(), comments: await ctx.db.query("comments").collect(), conversations: await ctx.db.query("conversations").collect() }));
  expect(after.saved).toHaveLength(4);
  expect(after.saved.filter(s => s.listingId === target.id)).toHaveLength(2);
  expect(after.saved.some(s => s.listingId === collision.oldId)).toBe(true);
  expect(after.saved.some(s => s.listingId === other.oldId)).toBe(true);
  expect(after.comments.every(c => c.targetId === target.id)).toBe(true);
  expect(after.comments.find(c => c.body === "Reply")?.parentId).toBe(after.comments.find(c => c.body === "Root")?._id);
  expect(after.conversations[0]).toMatchObject({ contextListingId: target.id, lastMessage: "Private", unreadB: 1 });
  expect(await t.mutation(ref, { dryRun: false })).toMatchObject({ savedUpdated: 0, savedDeduplicated: 0, commentsUpdated: 0, conversationContextsUpdated: 0 });
});

it("reports unresolved references after a reseed without inferring identity from the dictionary alone", async () => {
  const mapping = migration.mappings.find(row => !row.collisionBetweenReleases && apartments.some(a => a.id === row.newStableId))!;
  const target = apartments.find(row => row.id === mapping.newStableId)!;
  const t = convexTest(schema, { "./listingMigration.ts": () => import("./listingMigration"), "./_generated/server.js": () => import("./_generated/server.js") });
  await t.run(async ctx => {
    const a = await ctx.db.insert("users", {}), b = await ctx.db.insert("users", {});
    await ctx.db.insert("listings", { ...target, kind: "apartment" });
    await ctx.db.insert("saved", { userId: a, listingId: mapping.oldId });
    await ctx.db.insert("comments", { targetType: "listing", targetId: mapping.oldId, userId: a, body: "Preserve", parentId: null, reports: 0, hidden: false, isSample: false });
    await ctx.db.insert("conversations", { userA: a, userB: b, contextListingId: mapping.oldId, startedBy: a, startedAt: 1, lastMessage: "Private", lastMessageAt: 1, unreadA: 0, unreadB: 0 });
  });
  const ref = makeFunctionReference<"mutation">("listingMigration:migrateLegacyApartmentReferences");
  expect(await t.mutation(ref, { dryRun: false })).toMatchObject({ verifiedMappings: 0, savedUpdated: 0, commentsUpdated: 0, conversationContextsUpdated: 0, unresolvedSaved: 1, unresolvedComments: 1, unresolvedConversationContexts: 1 });
  expect((await t.run(ctx => ctx.db.query("saved").collect()))[0].listingId).toBe(mapping.oldId);
});
