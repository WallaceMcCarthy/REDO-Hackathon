import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { expect, it } from "vitest";
import schema from "./schema";

it("exposes every eligible roommate without contact data or a hidden twenty-person cutoff", async () => {
  const t = convexTest(schema, {
    "./roommates.ts": () => import("./roommates"),
    "./_generated/server.js": () => import("./_generated/server.js"),
  });
  const ids = await t.run(async ctx => {
    const ids = [];
    for (let i = 0; i < 32; i++) {
      const userId = await ctx.db.insert("users", { email: `person-${i}@example.test` });
      await ctx.db.insert("roommateProfiles", { userId, budgetMin: 800, budgetMax: 1200, cityIds: ["provo"], moveIn: 1800000000000, tags: [], active: true, isSample: false, bio: `Person ${i}`, contact: `private-${i}@example.test` });
      ids.push(userId);
    }
    return ids;
  });
  const ref = makeFunctionReference<"query">("roommates:matches");
  expect(await t.query(ref, {})).toEqual([]);
  const me = t.withIdentity({ subject: `${ids[0]}|fixture` });
  const matches = await me.query(ref, {});
  expect(matches).toHaveLength(31);
  expect(matches.some((m: { bio: string }) => m.bio === "Person 31")).toBe(true);
  for (const match of matches) {
    expect(match.contact).toBeUndefined();
    expect(match.userId).toBeUndefined();
    expect(match.email).toBeUndefined();
  }
});
