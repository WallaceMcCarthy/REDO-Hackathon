import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import schema from "./schema";

const mods = {
  "./zillowPreviews.ts": () => import("./zillowPreviews"),
  "./_generated/server.js": () => import("./_generated/server.js"),
  "./_generated/api.js": () => import("./_generated/api.js"),
};
const fetchRef = makeFunctionReference<"action">("zillowPreviews:fetch");
const getRef = makeFunctionReference<"query">("zillowPreviews:get");
const viewerKey = "test-viewer";

async function setup() {
  const t = convexTest(schema, mods);
  await t.run(async ctx => {
    await ctx.db.insert("cities", { id: "provo", name: "Provo", county: "Utah", lat: 40, lng: -111, population: 1, blurb: "x" });
    await ctx.db.insert("listings", { id: "h1", cityId: "provo", kind: "home", name: null, address: "123 Main St", lat: 40, lng: -111, value: 1, rent: null, beds: null, sqft: null, yearBuilt: null, units: null, propertyType: null, source: "s", sourceUrl: "u", year: 2025 });
  });
  return t;
}
const okBody = { status: "success", data: { title: "123 Main", url: "https://www.zillow.com/homedetails/1_zpid/", image: { url: "https://photos.zillowstatic.com/a.jpg" } } };
const respond = (body: unknown, ok = true) => Promise.resolve({ ok, json: () => Promise.resolve(body) } as Response);

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => { fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it("calls Microlink once, stores the result, then serves it from cache", async () => {
  const t = await setup();
  fetchMock.mockImplementation(() => respond(okBody));
  expect(await t.query(getRef, { listingId: "h1" })).toBeNull();
  const r = await t.action(fetchRef, { listingId: "h1", viewerKey });
  expect(r).toMatchObject({ status: "ok", imageUrl: "https://photos.zillowstatic.com/a.jpg", pageUrl: "https://www.zillow.com/homedetails/1_zpid/" });
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock.mock.calls[0][0]).toBe(`https://api.microlink.io/?url=${encodeURIComponent("https://www.zillow.com/homes/123-Main-St%2C-Provo%2C-UT_rb/")}`);
  expect(await t.query(getRef, { listingId: "h1" })).toMatchObject({ status: "ok" });
  await t.action(fetchRef, { listingId: "h1", viewerKey });
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("stores errors (no immediate retry) for non-success responses and network failures", async () => {
  const t = await setup();
  fetchMock.mockImplementation(() => respond({ status: "fail" }, false));
  expect((await t.action(fetchRef, { listingId: "h1", viewerKey }))?.status).toBe("error");
  expect((await t.action(fetchRef, { listingId: "h1", viewerKey }))?.status).toBe("error");
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const t2 = await setup();
  fetchMock.mockImplementation(() => Promise.reject(new Error("timeout")));
  expect((await t2.action(fetchRef, { listingId: "h1", viewerKey }))?.status).toBe("error");
});

it("returns null for unknown listings and uses the pro endpoint with a key", async () => {
  const t = await setup();
  expect(await t.action(fetchRef, { listingId: "nope", viewerKey })).toBeNull();
  expect(fetchMock).not.toHaveBeenCalled();
  vi.stubEnv("MICROLINK_API_KEY", "secret");
  fetchMock.mockImplementation(() => respond(okBody));
  await t.action(fetchRef, { listingId: "h1", viewerKey });
  expect(fetchMock.mock.calls[0][0]).toContain("https://pro.microlink.io/");
  expect(fetchMock.mock.calls[0][1].headers).toEqual({ "x-api-key": "secret" });
});

it("refuses to call out once 45 calls happened in 24h", async () => {
  const t = await setup();
  await t.run(async ctx => {
    for (let i = 0; i < 45; i++) await ctx.db.insert("zillowPreviews", { listingId: `x${i}`, requestUrl: "u", pageUrl: null, imageUrl: null, title: null, fetchedAt: Date.now() - 1000, status: "no_image" });
  });
  const r = await t.action(fetchRef, { listingId: "h1", viewerKey });
  expect(r?.status).toBe("error");
  expect(fetchMock).not.toHaveBeenCalled();
  expect(await t.query(getRef, { listingId: "h1" })).toBeNull();
});

it("limits one anonymous viewer to ten uncached preview fetches per hour", async () => {
  const t = await setup();
  fetchMock.mockImplementation(() => respond(okBody));
  await t.run(async ctx => {
    for (let i = 2; i <= 11; i++) {
      await ctx.db.insert("listings", { id: `h${i}`, cityId: "provo", kind: "home", name: null, address: `${i} Main St`, lat: 40, lng: -111, value: 1, rent: null, beds: null, sqft: null, yearBuilt: null, units: null, propertyType: null, source: "s", sourceUrl: "u", year: 2025 });
    }
  });
  for (let i = 1; i <= 10; i++) await t.action(fetchRef, { listingId: `h${i}`, viewerKey });
  const blocked = await t.action(fetchRef, { listingId: "h11", viewerKey });
  expect(fetchMock).toHaveBeenCalledTimes(10);
  expect(blocked?.status).toBe("error");
  expect(await t.query(getRef, { listingId: "h11" })).toBeNull();
});
