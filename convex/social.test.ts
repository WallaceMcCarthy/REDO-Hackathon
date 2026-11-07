import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { describe, expect, it } from "vitest";
import schema from "./schema";

const modules = {
  "./social.ts": () => import("./social"),
  "./posts.ts": () => import("./posts"),
  "./_generated/server.js": () => import("./_generated/server.js"),
};
const refs = {
  toggle: makeFunctionReference<"mutation">("social:toggleSaved"),
  saved: makeFunctionReference<"query">("social:mySaved"),
  ids: makeFunctionReference<"query">("social:savedIds"),
  add: makeFunctionReference<"mutation">("social:addComment"),
  comments: makeFunctionReference<"query">("social:comments"),
  remove: makeFunctionReference<"mutation">("social:deleteComment"),
  report: makeFunctionReference<"mutation">("social:reportComment"),
};

async function setup() {
  const t = convexTest(schema, modules);
  const users = await t.run(async (ctx) => {
    const ids = [];
    for (const name of ["Alice", "Bob", "Carol", "Dana"]) {
      const userId = await ctx.db.insert("users", { email: `${name.toLowerCase()}@example.test` });
      await ctx.db.insert("profiles", { userId, displayName: name, cityId: null, moveBy: null, budget: null, household: null, isSample: false });
      ids.push(userId);
    }
    for (const id of ["provo", "orem"]) {
      await ctx.db.insert("cities", { id, name: id, county: "Utah", lat: 40, lng: -111, population: 100, blurb: "Fixture" });
    }
    const listing = {
      id: "county-parcel-1", cityId: "provo", kind: "home" as const, name: null, address: "Fixture address",
      lat: 40, lng: -111, value: 300000, rent: null, beds: null, sqft: 1500,
      yearBuilt: 1980, units: 1, propertyType: "Residential", source: "Fixture assessor record", sourceUrl: "https://example.test/source", year: 2025,
    };
    await ctx.db.insert("listings", listing);
    await ctx.db.insert("listings", { ...listing, id: "county-parcel-2" });
    return ids;
  });
  const [alice, bob, carol, dana] = users.map((id) => t.withIdentity({ subject: `${id}|test-session` }));
  return { t, users, alice, bob, carol, dana };
}

describe("authenticated social endpoints", () => {
  it("rejects every unauthenticated write and keeps signed-out bookmarks empty", async () => {
    const { t, alice } = await setup();
    const commentId = await alice.mutation(refs.add, { targetType: "town", targetId: "provo", body: "A real comment" });
    await expect(t.mutation(refs.toggle, { listingId: "county-parcel-1" })).rejects.toThrow("Sign in");
    await expect(t.mutation(refs.add, { targetType: "town", targetId: "provo", body: "Unauthenticated" })).rejects.toThrow("Sign in");
    await expect(t.mutation(refs.remove, { commentId })).rejects.toThrow("Sign in");
    await expect(t.mutation(refs.report, { commentId })).rejects.toThrow("Sign in");
    expect(await t.query(refs.saved, {})).toMatchObject({ page: [], isDone: true });
    expect(await t.query(refs.ids, {})).toEqual([]);
  });

  it("isolates bookmarks by authenticated identity and supports cursor pagination", async () => {
    const { t, alice, bob } = await setup();
    await alice.mutation(refs.toggle, { listingId: "county-parcel-1" });
    await alice.mutation(refs.toggle, { listingId: "county-parcel-2" });
    expect(await bob.query(refs.ids, {})).toEqual([]);
    const first = await alice.query(refs.saved, { paginationOpts: { numItems: 1, cursor: null } });
    const second = await alice.query(refs.saved, { paginationOpts: { numItems: 1, cursor: first.continueCursor } });
    expect(first.page).toHaveLength(1);
    expect(second.page).toHaveLength(1);
    expect(first.page[0].listingId).not.toBe(second.page[0].listingId);
    expect(first.page[0].listing.value).toBe(300000);
    expect(first.page[0].listing.rentKind).toBeNull();
    await expect(alice.mutation(refs.toggle, { listingId: "nonexistent" })).rejects.toThrow("unavailable");
    await t.run(async (ctx) => {
      const listing = await ctx.db.query("listings").withIndex("by_listingId", (q) => q.eq("id", "county-parcel-1")).first();
      await ctx.db.delete(listing!._id);
    });
    // A stale source record can still be removed from a private saved list.
    expect(await alice.mutation(refs.toggle, { listingId: "county-parcel-1" })).toEqual({ saved: false });
    expect(await alice.query(refs.ids, {})).toEqual(["county-parcel-2"]);
  });

  it("rejects client-supplied identities and sample badges", async () => {
    const { t, users, alice } = await setup();
    await expect(alice.mutation(refs.toggle, { listingId: "county-parcel-1", userId: users[1] })).rejects.toThrow();
    await expect(alice.mutation(refs.add, { targetType: "town", targetId: "provo", body: "Fake sample", isSample: true })).rejects.toThrow();
    expect(await t.run((ctx) => ctx.db.query("saved").collect())).toEqual([]);
    expect(await t.run((ctx) => ctx.db.query("comments").collect())).toEqual([]);
  });

  it("rejects cross-target and nested replies, and projects public author names without emails", async () => {
    const { t, alice, bob } = await setup();
    const parentId = await alice.mutation(refs.add, { targetType: "town", targetId: "provo", body: "  Good question.  " });
    const replyId = await bob.mutation(refs.add, { targetType: "town", targetId: "provo", body: "Helpful answer.", parentId });
    await expect(bob.mutation(refs.add, { targetType: "town", targetId: "orem", body: "Wrong town", parentId })).rejects.toThrow("same discussion");
    await expect(bob.mutation(refs.add, { targetType: "town", targetId: "provo", body: "Too deep", parentId: replyId })).rejects.toThrow("one level");
    await expect(alice.mutation(refs.add, { targetType: "town", targetId: "missing", body: "Unknown town" })).rejects.toThrow("unavailable");
    const threads = await t.query(refs.comments, { targetType: "town", targetId: "provo" });
    expect(threads[0]).toMatchObject({ body: "Good question.", displayName: "Alice", canDelete: false, isSample: false });
    expect(threads[0].replies[0]).toMatchObject({ body: "Helpful answer.", displayName: "Bob" });
    expect(JSON.stringify(threads)).not.toContain("@example.test");
  });

  it("allows only the author to delete and retains other authors' replies as roots", async () => {
    const { t, alice, bob } = await setup();
    const parentId = await alice.mutation(refs.add, { targetType: "town", targetId: "provo", body: "Alice parent" });
    const replyId = await bob.mutation(refs.add, { targetType: "town", targetId: "provo", body: "Bob reply", parentId });
    await expect(bob.mutation(refs.remove, { commentId: parentId })).rejects.toThrow("own comment");
    await alice.mutation(refs.remove, { commentId: parentId });
    expect(await t.run((ctx) => ctx.db.get(parentId))).toBeNull();
    const threads = await t.query(refs.comments, { targetType: "town", targetId: "provo" });
    expect(threads).toHaveLength(1);
    expect(threads[0]).toMatchObject({ _id: replyId, body: "Bob reply", parentId: null });
  });

  it("counts distinct reporters once and hides a thread exactly on the third report", async () => {
    const { t, alice, bob, carol, dana } = await setup();
    const commentId = await alice.mutation(refs.add, { targetType: "town", targetId: "provo", body: "Reportable comment" });
    expect(await bob.mutation(refs.report, { commentId })).toEqual({ reported: true, hidden: false });
    expect(await bob.mutation(refs.report, { commentId })).toEqual({ reported: false, hidden: false });
    expect(await carol.mutation(refs.report, { commentId })).toEqual({ reported: true, hidden: false });
    expect(await dana.mutation(refs.report, { commentId })).toEqual({ reported: true, hidden: true });
    expect(await t.query(refs.comments, { targetType: "town", targetId: "provo" })).toEqual([]);
    const record = await t.run((ctx) => ctx.db.get(commentId));
    expect(record).toMatchObject({ reports: 3, hidden: true });
    expect(await t.run((ctx) => ctx.db.query("contentReports").collect())).toHaveLength(3);
    await expect(bob.mutation(refs.add, { targetType: "town", targetId: "provo", body: "Reply to hidden", parentId: commentId })).rejects.toThrow("unavailable");
    await alice.mutation(refs.remove, { commentId });
    expect(await t.run((ctx) => ctx.db.query("contentReports").collect())).toEqual([]);
  });

  it("rejects comments on hidden posts and removes comments/reports in the feed deletion cascade", async () => {
    const { t, users, alice, bob } = await setup();
    const postId = await t.run((ctx) => ctx.db.insert("posts", { cityId: "provo", userId: users[0], body: "A post", likes: 0, reports: 0, hidden: false, isSample: false }));
    const commentId = await alice.mutation(refs.add, { targetType: "post", targetId: postId, body: "On the post" });
    await bob.mutation(refs.report, { commentId });
    await t.run((ctx) => ctx.db.patch(postId, { hidden: true }));
    expect(await t.query(refs.comments, { targetType: "post", targetId: postId })).toEqual([]);
    await expect(bob.mutation(refs.add, { targetType: "post", targetId: postId, body: "On hidden post" })).rejects.toThrow("unavailable");
    await alice.mutation(makeFunctionReference<"mutation">("posts:remove"), { postId });
    expect(await t.run((ctx) => ctx.db.get(postId))).toBeNull();
    expect(await t.run((ctx) => ctx.db.query("comments").collect())).toEqual([]);
    expect(await t.run((ctx) => ctx.db.query("contentReports").collect())).toEqual([]);
  });
});
