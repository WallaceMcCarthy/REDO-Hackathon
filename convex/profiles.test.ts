import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { describe, expect, it } from "vitest";
import schema from "./schema";

const modules = {
  "./profiles.ts": () => import("./profiles"),
  "./_generated/server.js": () => import("./_generated/server.js"),
};
const refs = {
  getMe: makeFunctionReference<"query">("profiles:getMe"),
  update: makeFunctionReference<"mutation">("profiles:updateProfile"),
};

async function setup() {
  const t = convexTest(schema, modules);
  const userId = await t.run(async (ctx) => ctx.db.insert("users", { email: "alice@example.test" }));
  const alice = t.withIdentity({ subject: `${userId}|test-session` });
  return { t, alice };
}

describe("profiles.updateProfile", () => {
  it("rejects unauthenticated writes", async () => {
    const { t } = await setup();
    await expect(t.mutation(refs.update, { displayName: "Alice" })).rejects.toThrow("Sign in");
  });

  it("trims displayName and rejects empty or oversized names", async () => {
    const { alice } = await setup();
    await alice.mutation(refs.update, { displayName: "  Real Name  " });
    expect((await alice.query(refs.getMe, {}))?.displayName).toBe("Real Name");
    await expect(alice.mutation(refs.update, { displayName: "   " })).rejects.toThrow("1-40 characters");
    await expect(alice.mutation(refs.update, { displayName: "x".repeat(41) })).rejects.toThrow("1-40 characters");
  });

  it("rejects negative or non-finite budget and household, but allows clearing with null", async () => {
    const { alice } = await setup();
    await expect(alice.mutation(refs.update, { budget: -1 })).rejects.toThrow("Budget");
    await expect(alice.mutation(refs.update, { budget: Number.NaN })).rejects.toThrow("Budget");
    await expect(alice.mutation(refs.update, { household: -1 })).rejects.toThrow("Household");
    await expect(alice.mutation(refs.update, { household: 2.5 })).rejects.toThrow("Household");

    await alice.mutation(refs.update, { budget: 400_000, household: 3 });
    let me = await alice.query(refs.getMe, {});
    expect(me?.budget).toBe(400_000);
    expect(me?.household).toBe(3);

    await alice.mutation(refs.update, { budget: null, household: null });
    me = await alice.query(refs.getMe, {});
    expect(me?.budget).toBeNull();
    expect(me?.household).toBeNull();
  });

  it("rejects absurdly large budget/household", async () => {
    const { alice } = await setup();
    await expect(alice.mutation(refs.update, { budget: 1e9 })).rejects.toThrow("Budget");
    await expect(alice.mutation(refs.update, { household: 21 })).rejects.toThrow("Household");
  });
});
