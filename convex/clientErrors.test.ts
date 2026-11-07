import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { expect, it } from "vitest";
import schema from "./schema";

const mods = {
  "./clientErrors.ts": () => import("./clientErrors"),
  "./_generated/server.js": () => import("./_generated/server.js"),
};
const report = makeFunctionReference<"mutation">("clientErrors:report");

it("keeps only five anonymous reports per session each minute", async () => {
  const t = convexTest(schema, mods);
  for (let i = 0; i < 6; i++) {
    await t.mutation(report, { sessionKey: "anonymous-session", source: "error", errorName: "TypeError" });
  }
  const count = await t.run(async ctx =>
    (await ctx.db.query("clientErrorReports").collect()).length,
  );
  expect(count).toBe(5);
});

it("rejects oversized report fields", async () => {
  const t = convexTest(schema, mods);
  await t.mutation(report, { sessionKey: "x".repeat(65), source: "boundary", errorName: "Error" });
  expect(await t.run(async ctx => (await ctx.db.query("clientErrorReports").collect()).length)).toBe(0);
});
