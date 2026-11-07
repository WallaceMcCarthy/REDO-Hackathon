import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { existsSync, readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import schema from "./schema";

const modules = {
  "./ads.ts": () => import("./ads"),
  "./sampleData.ts": () => import("./sampleData"),
  "./_generated/server.js": () => import("./_generated/server.js"),
};
const pins = makeFunctionReference<"query">("ads:getActivePins");
const featured = makeFunctionReference<"query">("ads:getActiveFeatured");
const seed = makeFunctionReference<"mutation">("sampleData:seedSampleContent");

const DAY = 24 * 3600 * 1000;
const cities: any[] = JSON.parse(readFileSync("data/cities.json", "utf8"));
const ad = { body: "A short pitch", url: "https://example.com/a", startsAt: 0, status: "active", impressions: 0, clicks: 0 };

async function seeded() {
  const t = convexTest(schema, modules);
  const userId = await t.run(async (ctx: any) => {
    for (const c of cities) await ctx.db.insert("cities", c);
    return ctx.db.insert("users", { email: "advertiser@example.test" });
  });
  const real = (row: object) => ({ ...ad, advertiserUserId: userId, isSample: false, endsAt: Date.now() + DAY, ...row });
  return { t, real };
}

const titles = (rows: any[]) => rows.map((r) => r.title);

afterEach(() => vi.restoreAllMocks());

describe("public ad reads", () => {
  it("a town query returns only that town's ads and town-less ads", async () => {
    const { t, real } = await seeded();
    await t.run(async (ctx: any) => {
      for (const kind of ["pin", "job", "featured"]) {
        await ctx.db.insert("campaigns", real({ kind, title: `Local ${kind}`, cityId: "provo" }));
        await ctx.db.insert("campaigns", real({ kind, title: `Statewide ${kind}` }));
        await ctx.db.insert("campaigns", real({ kind, title: `Elsewhere ${kind}`, cityId: "moab" }));
      }
    });
    await t.mutation(seed, {});

    for (const [query, kinds] of [[pins, ["pin", "job"]], [featured, ["featured"]]] as [typeof pins, string[]][]) {
      const rows: any[] = await t.query(query, { cityId: "provo" });
      expect(rows.every((r) => kinds.includes(r.kind) && (r.cityId === "provo" || r.cityId === undefined))).toBe(true);
      expect(rows[0].title).toMatch(/^Local /);
      expect(titles(rows)).toEqual(expect.arrayContaining(kinds.map((k) => `Statewide ${k}`)));
    }
  });

  it("keeps real paid ads ahead of samples, in a town and statewide, even when samples were seeded later", async () => {
    const { t, real } = await seeded();
    await t.run(async (ctx: any) => {
      await ctx.db.insert("campaigns", real({ kind: "pin", title: "Paid pin", cityId: "salt-lake-city" }));
      await ctx.db.insert("campaigns", real({ kind: "featured", title: "Paid featured", cityId: "salt-lake-city" }));
    });
    await t.mutation(seed, {});

    for (const args of [{ cityId: "salt-lake-city" }, {}]) {
      expect((await t.query(pins, args))[0].title).toBe("Paid pin");
      expect((await t.query(featured, args))[0].title).toBe("Paid featured");
    }
  });

  it("hides ended ads and holds the caps in every town and statewide", async () => {
    const { t, real } = await seeded();
    await t.mutation(seed, {});
    await t.run(async (ctx: any) => {
      for (const kind of ["pin", "featured"]) {
        await ctx.db.insert("campaigns", real({ kind, title: "Ended local", cityId: "provo", endsAt: Date.now() - 1 }));
        await ctx.db.insert("campaigns", real({ kind, title: "Ended statewide", endsAt: Date.now() - 1 }));
      }
    });

    for (const args of [...cities.map((c) => ({ cityId: c.id })), {}]) {
      const shownPins: any[] = await t.query(pins, args);
      const shownFeatured: any[] = await t.query(featured, args);
      expect(shownPins.length).toBeGreaterThan(0);
      expect(shownPins.length).toBeLessThanOrEqual(8);
      expect(shownFeatured.length).toBeGreaterThan(0);
      expect(shownFeatured.length).toBeLessThanOrEqual(3);
      expect(titles([...shownPins, ...shownFeatured]).filter((title) => title.startsWith("Ended"))).toEqual([]);
    }
  });

  it("seeds all 300 sample rows with an image, a title, a description and a spot near their Utah town", async () => {
    const { t } = await seeded();
    await t.mutation(seed, {});
    const rows: any[] = await t.run((ctx: any) => ctx.db.query("campaigns").collect());
    expect(rows).toHaveLength(300);
    for (const row of rows) {
      const town = cities.find((c) => c.id === row.cityId);
      expect(existsSync(`public${row.imageUrl}`), row.title).toBe(true);
      expect(row.title.trim(), row.url).not.toBe("");
      expect(row.body.trim(), row.title).not.toBe("");
      expect(Number.isFinite(row.lat) && Number.isFinite(row.lng), row.title).toBe(true);
      expect(Math.abs(row.lat - town.lat), row.title).toBeLessThan(0.3);
      expect(Math.abs(row.lng - town.lng), row.title).toBeLessThan(0.3);
    }
  });

  it("rotates samples by day, stays stable within a day, and always keeps Apply to REDO", async () => {
    const { t } = await seeded();
    await t.mutation(seed, {});
    const start = Date.now();
    const on = async (day: number, args: object) => {
      vi.spyOn(Date, "now").mockReturnValue(start + day * DAY);
      return titles(await t.query(pins, args));
    };

    for (const args of [{ cityId: "salt-lake-city" }, {}]) {
      const today = await on(0, args);
      expect(await on(0, args)).toEqual(today);
      expect(today[0]).toBe("Apply to REDO!");
      const week = await Promise.all([1, 2, 3].map(async (day) => (await on(day, args)).join()));
      expect(new Set([today.join(), ...week]).size).toBeGreaterThan(1);
    }
  });
});
