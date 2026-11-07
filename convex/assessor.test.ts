import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { expect, it } from "vitest";
import { findAssessorListing } from "./assessor";
import schema from "./schema";

const modules = { "./assessor.ts": () => import("./assessor"), "./_generated/server.js": () => import("./_generated/server.js") };
const townHomes = makeFunctionReference<"query">("assessor:townHomes");
const row = (n: number, cityId = "provo", value = n * 1000) => ({ id: `utah-${n}`, cityId, county: "Utah", address: `${n} Main St`, lat: 40, lng: -111, value, sqft: 1500, yearBuilt: 1980, units: 1, propertyType: "Residential", asOf: "2025-03-01" });
const upsert = makeFunctionReference<"mutation", { rows: ReturnType<typeof row>[] }>("assessor:upsertListings");

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
