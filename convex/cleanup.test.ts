import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { describe, expect, it } from "vitest";
import schema from "./schema";

const modules = {
  "./cleanup.ts": () => import("./cleanup"),
  "./messages.ts": () => import("./messages"),
  "./_generated/server.js": () => import("./_generated/server.js"),
};

const deleteTestAccountsRef = makeFunctionReference<"mutation">("cleanup:deleteTestAccounts");

describe("cleanup:deleteTestAccounts", () => {
  it("deletes user and associated profile and saved rows", async () => {
    const t = convexTest(schema, modules);

    // Seed test users
    const userId1 = await t.run(async (ctx) => {
      const uId = await ctx.db.insert("users", { email: "qa+7i2xlq@example.com" });
      await ctx.db.insert("profiles", {
        userId: uId,
        displayName: "QA Test User 1",
        cityId: "salt-lake-city",
        moveBy: null,
        budget: 500000,
        household: 2,
        isSample: false,
      });
      await ctx.db.insert("saved", { userId: uId, listingId: "home-1" });
      return uId;
    });

    const userId2 = await t.run(async (ctx) => {
      const uId = await ctx.db.insert("users", { email: "qa+zout6w@example.com" });
      await ctx.db.insert("profiles", {
        userId: uId,
        displayName: "QA Test User 2",
        cityId: "provo",
        moveBy: null,
        budget: null,
        household: null,
        isSample: false,
      });
      return uId;
    });

    // Run cleanup
    const result = await t.mutation(deleteTestAccountsRef, {});

    expect(result).toHaveLength(3);
    const res1 = result.find((r: any) => r.email === "qa+7i2xlq@example.com");
    const res2 = result.find((r: any) => r.email === "qa+zout6w@example.com");
    const res3 = result.find((r: any) => r.email === "e2e-check-1794016950179@example.com");

    expect(res1?.found).toBe(true);
    expect(res1?.deletedRecords.users).toBe(1);
    expect(res1?.deletedRecords.profiles).toBe(1);
    expect(res1?.deletedRecords.saved).toBe(1);

    expect(res2?.found).toBe(true);
    expect(res2?.deletedRecords.users).toBe(1);
    expect(res2?.deletedRecords.profiles).toBe(1);

    expect(res3?.found).toBe(false);

    // Verify database no longer contains users
    const usersRemaining = await t.run(async (ctx) => {
      const u1 = await ctx.db.get(userId1);
      const u2 = await ctx.db.get(userId2);
      const profiles = await ctx.db.query("profiles").collect();
      const saved = await ctx.db.query("saved").collect();
      return { u1, u2, profilesCount: profiles.length, savedCount: saved.length };
    });

    expect(usersRemaining.u1).toBeNull();
    expect(usersRemaining.u2).toBeNull();
    expect(usersRemaining.profilesCount).toBe(0);
    expect(usersRemaining.savedCount).toBe(0);
  });

  it("accepts custom target emails", async () => {
    const t = convexTest(schema, modules);

    const customUserId = await t.run(async (ctx) => {
      return ctx.db.insert("users", { email: "custom-test@example.com" });
    });

    const result = await t.mutation(deleteTestAccountsRef, {
      emails: ["custom-test@example.com"],
    });

    expect(result).toHaveLength(1);
    expect(result[0].found).toBe(true);
    expect(result[0].deletedRecords.users).toBe(1);

    const check = await t.run(async (ctx) => ctx.db.get(customUserId));
    expect(check).toBeNull();
  });
});
