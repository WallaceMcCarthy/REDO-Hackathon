import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { describe, expect, it } from "vitest";
import { validateHttpsUrl } from "./ads";
import schema from "./schema";
import { AD_CATEGORY_IDS } from "./lib/adCategories";
import { buildSampleAds } from "./sampleAds";
import { SAMPLE_CAMPAIGNS } from "./sampleData";

const TOWN_COUNT = 42;
const NOW = Date.UTC(2026, 10, 6);
const ads = buildSampleAds(NOW);
const count = (kind: string) => ads.filter((a) => a.kind === kind).length;

describe("sample ads generator", () => {
  it("has the expected volume and covers all 42 towns", () => {
    expect(count("pin")).toBeGreaterThanOrEqual(80);
    expect(count("featured")).toBeGreaterThanOrEqual(25);
    expect(count("job")).toBeGreaterThanOrEqual(35);
    expect(new Set(ads.map((a) => a.cityId)).size).toBe(TOWN_COUNT);
  });

  it("is deterministic and has unique titles and urls", () => {
    expect(buildSampleAds(NOW)).toEqual(ads);
    expect(new Set(ads.map((a) => a.title)).size).toBe(ads.length);
    expect(new Set(ads.map((a) => a.url)).size).toBe(ads.length);
  });

  it("never reuses a title from the hand-written campaigns", () => {
    const hand = new Set(SAMPLE_CAMPAIGNS.map((c) => c.title));
    expect(ads.filter((a) => hand.has(a.title))).toEqual([]);
  });

  it("is valid, fake, in Utah, active across the coming months, with sane stats", () => {
    for (const a of ads) {
      expect(a.isSample).toBe(true);
      expect(AD_CATEGORY_IDS).toContain(a.category);
      expect(a.imageUrl).toBe(`/sample-ads/${a.category}.svg`);
      expect("advertiserUserId" in a).toBe(false);
      expect([a.lat, a.lng, a.impressions, a.clicks].every(Number.isFinite)).toBe(true);
      expect(validateHttpsUrl(a.url)).toContain("https://example.com/");
      expect(a.title.length).toBeGreaterThanOrEqual(3);
      expect(a.title.length).toBeLessThanOrEqual(80);
      expect(a.body.length).toBeLessThanOrEqual(300);
      expect(a.lat).toBeGreaterThan(36.9);
      expect(a.lat).toBeLessThan(42.1);
      expect(a.lng).toBeGreaterThan(-114.1);
      expect(a.lng).toBeLessThan(-108.9);
      expect(a.startsAt).toBeLessThanOrEqual(NOW);
      expect(a.endsAt - NOW).toBeGreaterThan(59 * 24 * 3600 * 1000);
      expect(Number.isInteger(a.impressions) && Number.isInteger(a.clicks)).toBe(true);
      expect(a.impressions).toBeGreaterThan(0);
      const ctr = a.clicks / a.impressions;
      expect(ctr).toBeGreaterThan(0);
      expect(ctr).toBeLessThan(0.1);
      if (a.kind === "job") expect(a.body).toMatch(/Pay \$\d+k?-\$\d+k?\/(hr|yr)/);
    }
  });
});

describe("seedSampleContent", () => {
  it("converges on rerun instead of duplicating", async () => {
    const t = convexTest(schema, {
      "./sampleData.ts": () => import("./sampleData"),
      "./_generated/server.js": () => import("./_generated/server.js"),
    });
    const seed = makeFunctionReference<"mutation">("sampleData:seedSampleContent");
    const total = () => t.run(async (ctx: any) => (await ctx.db.query("campaigns").collect()).length);
    await t.run(async (ctx: any) => {
      for (const id of new Set(SAMPLE_CAMPAIGNS.map((c) => c.cityId)))
        await ctx.db.insert("cities", { id, name: id, county: "x", lat: 40.5, lng: -111.9, population: 1, blurb: "x" });
    });
    await t.mutation(seed as any, {});
    const first = await total();
    await t.mutation(seed as any, {});
    expect(await total()).toBe(first);
    expect(first).toBe(ads.length + SAMPLE_CAMPAIGNS.length);
    const rows = await t.run(async (ctx: any) => ctx.db.query("campaigns").collect());
    expect(rows.every((r: any) => r.isSample && r.status === "active" && !("advertiserUserId" in r))).toBe(true);
    expect(new Set(rows.map((r: any) => r.title)).size).toBe(rows.length);
    const comments = await t.run(async (ctx: any) => ctx.db.query("comments").collect());
    const profiles = await t.run(async (ctx: any) => ctx.db.query("profiles").collect());
    expect(comments.length).toBe(6);
    expect(profiles.length).toBe(6);
    const users = await t.run(async (ctx: any) => ctx.db.query("users").collect());
    expect(users.every((u: any) => u.email.endsWith("@example.com"))).toBe(true);
    expect(profiles.every((p: any) => p.isSample && p.displayName.endsWith("(Sample)"))).toBe(true);
    expect(comments.every((c: any) => profiles.some((p: any) => p.userId === c.userId))).toBe(true);
    expect(rows.some((r: any) => r.title === "Apply to REDO!" && r.kind === "job")).toBe(true);
  });
});
