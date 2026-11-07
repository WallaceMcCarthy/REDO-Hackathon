import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { expect, it } from "vitest";
import { findAssessorListing } from "./assessor";
import schema from "./schema";

const modules = { "./assessor.ts": () => import("./assessor"), "./social.ts": () => import("./social"), "./messages.ts": () => import("./messages"), "./_generated/server.js": () => import("./_generated/server.js") };
const townHomes = makeFunctionReference<"query">("assessor:townHomes");
const row = (n: number, cityId = "provo", value = n * 1000) => ({ id: `utah-${n}`, cityId, county: "Utah", address: `${n} Main St`, lat: 40, lng: -111, value, sqft: 1500, yearBuilt: 1980, units: 1, propertyType: "Residential", asOf: "2025-03-01" });
const upsert = makeFunctionReference<"mutation", { rows: ReturnType<typeof row>[] }>("assessor:upsertListings");
const toggleSaved = makeFunctionReference<"mutation">("social:toggleSaved"), mySaved = makeFunctionReference<"query">("social:mySaved");
const addComment = makeFunctionReference<"mutation">("social:addComment"), comments = makeFunctionReference<"query">("social:comments");
const startConversation = makeFunctionReference<"mutation">("messages:startConversation"), myConversations = makeFunctionReference<"query">("messages:myConversations");

async function homesOfEverySource() {
  const t = convexTest(schema, modules);
  await t.mutation(upsert, { rows: [row(5), row(6), { ...row(7), id: "market:for_sale:gone" }] });
  const users = await t.run(async ctx => {
    await ctx.db.insert("listings", { id: "utah-6", cityId: "provo", kind: "home", name: null, address: "Sample copy", lat: 40, lng: -111, value: 300000, rent: null, beds: null, sqft: null, yearBuilt: null, units: null, propertyType: null, source: "Sample record", sourceUrl: "https://example.test", year: 2025 });
    await ctx.db.insert("marketListings", { rcId: "live", market: "for_sale", address: "Live address", city: "Provo", zip: null, lat: 40, lng: -111, price: 400000, beds: 3, baths: 2, sqft: 1500, yearBuilt: 2000, propertyType: "Single Family", listedDate: "2026-11-01", daysOnMarket: 6, cityId: "provo", residential: true, sortYearBuilt: 2000, importedAt: 1 });
    return [await ctx.db.insert("users", {}), await ctx.db.insert("users", {})];
  });
  return { other: users[1], alice: t.withIdentity({ subject: `${users[0]}|fixture` }), t };
}

it("converges on retry and updates a changed parcel in place", async () => {
  const t = convexTest(schema, modules);
  const rows = [row(1), row(2)];
  expect(await t.mutation(upsert, { rows })).toEqual({ inserted: 2, updated: 0, unchanged: 0 });
  expect(await t.mutation(upsert, { rows })).toEqual({ inserted: 0, updated: 0, unchanged: 2 });
  expect(await t.mutation(upsert, { rows: [{ ...row(1), value: 999 }] })).toEqual({ inserted: 0, updated: 1, unchanged: 0 });
  expect(await t.run(ctx => ctx.db.query("assessorListings").collect())).toHaveLength(2);
  await expect(t.mutation(upsert, { rows: Array.from({ length: 1001 }, (_, n) => row(n)) })).rejects.toThrow("at most 1000");
});

it("pages one town cheapest first, within budget, without other towns or oversized pages", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(upsert, { rows: [...Array.from({ length: 150 }, (_, n) => row(150 - n)), row(900, "orem", 1)] });
  const first = await t.query(townHomes, { cityId: "provo", paginationOpts: { numItems: 5000, cursor: null } });
  expect(first.page).toHaveLength(100);
  expect(first.page.slice(0, 2).map((home: { value: number }) => home.value)).toEqual([1000, 2000]);
  expect(first.isDone).toBe(false);
  const second = await t.query(townHomes, { cityId: "provo", paginationOpts: { numItems: 100, cursor: first.continueCursor } });
  expect(second.page).toHaveLength(50);
  expect(second.isDone).toBe(true);
  const capped = await t.query(townHomes, { cityId: "provo", maxValue: 3000, paginationOpts: { numItems: 50, cursor: null } });
  expect(capped.page.map((home: { id: string }) => home.id)).toEqual(["utah-1", "utah-2", "utah-3"]);
});

it("labels rows as dated assessor records and resolves public ids", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(upsert, { rows: [row(5)] });
  const home = await t.run(ctx => findAssessorListing(ctx, "utah-5"));
  expect(home).toMatchObject({ id: "utah-5", kind: "home", value: 5000, rent: null, beds: null, year: 2025, source: "UGRC Utah County assessor LIR; records as of 2025-03-01" });
  expect(home!.sourceUrl).toContain("Parcels_Utah_LIR");
  expect(decodeURIComponent(home!.sourceUrl.replaceAll("+", " "))).toContain("PARCEL_ID='5'");
  expect(home).not.toHaveProperty("owner");
  expect(await t.run(ctx => findAssessorListing(ctx, "utah-missing"))).toBeNull();
});

it.each([
  ["a parcel outside the sample", "utah-5", { address: "5 Main St", value: 5000, source: "UGRC Utah County assessor LIR; records as of 2025-03-01", rentKind: null }],
  ["a sample home, which stays on its listings row", "utah-6", { address: "Sample copy", source: "Sample record" }],
  ["a live market listing", "market:for_sale:live", { address: "Live address", market: "for_sale" }],
])("saves, comments on and messages about %s", async (_, listingId, fields) => {
  const { alice, other } = await homesOfEverySource();
  expect(await alice.mutation(toggleSaved, { listingId })).toEqual({ saved: true });
  const saved = await alice.query(mySaved, {});
  expect(saved.page[0]).toMatchObject({ listingId, listing: { id: listingId, cityId: "provo", ...fields } });
  await alice.mutation(addComment, { targetType: "listing", targetId: listingId, body: "Is this one still around?" });
  expect(await alice.query(comments, { targetType: "listing", targetId: listingId })).toMatchObject([{ body: "Is this one still around?" }]);
  await alice.mutation(startConversation, { otherUserId: other, listingId });
  expect(await alice.query(myConversations, {})).toMatchObject([{ contextListingId: listingId, listing: { id: listingId, ...fields } }]);
  expect(await alice.mutation(toggleSaved, { listingId })).toEqual({ saved: false });
});

it.each(["utah-missing", "market:for_sale:gone"])("still refuses %s, which no lookup resolves", async listingId => {
  const { alice, other } = await homesOfEverySource();
  await expect(alice.mutation(toggleSaved, { listingId })).rejects.toThrow("This property record is unavailable");
  await expect(alice.mutation(addComment, { targetType: "listing", targetId: listingId, body: "Hello" })).rejects.toThrow("This discussion is unavailable");
  await expect(alice.mutation(startConversation, { otherUserId: other, listingId })).rejects.toThrow("This listing is not available.");
});

it("requires sign-in to save or message about a parcel", async () => {
  const { t, other } = await homesOfEverySource();
  await expect(t.mutation(toggleSaved, { listingId: "utah-5" })).rejects.toThrow();
  await expect(t.mutation(startConversation, { otherUserId: other, listingId: "utah-5" })).rejects.toThrow();
});
