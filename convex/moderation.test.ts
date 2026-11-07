import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import schema from "./schema";

const modules = {
  "./moderation.ts": () => import("./moderation"),
  "./_generated/server.js": () => import("./_generated/server.js"),
};
const moderateComment = makeFunctionReference<"action">("moderation:moderateComment");
const moderateCampaign = makeFunctionReference<"action">("moderation:moderateCampaign");

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function reply(scores: Partial<Record<string, number>> = {}) {
  const keys = ["hate_or_harassment", "fair_housing", "sexual_content", "violence_or_illegal", "scam_or_phishing", "spam", "contact_info_leak"];
  return { model: "jev-1.14.0", answers: Object.fromEntries(keys.map((k) => [k, { type: "noul", noul: scores[k] ?? 0.01 }])) };
}

async function setupComment(body = "Great neighborhood!") {
  const t = convexTest(schema, modules);
  const userId = await t.run((ctx) => ctx.db.insert("users", { email: "fixture@example.test" }));
  const commentId = await t.run((ctx) =>
    ctx.db.insert("comments", { targetType: "town", targetId: "provo", userId, body, parentId: null, reports: 0, hidden: false, isSample: false }),
  );
  return { t, commentId };
}

async function setupCampaign(title = "Great Bakery", body = "Come eat!") {
  const t = convexTest(schema, modules);
  const now = Date.now();
  const campaignId = await t.run((ctx) =>
    ctx.db.insert("campaigns", {
      kind: "pin", title, body, url: "https://example.test", status: "active",
      startsAt: now, endsAt: now + 86_400_000, impressions: 0, clicks: 0, isSample: false,
    }),
  );
  return { t, campaignId };
}

describe("moderateComment", () => {
  it("does nothing when disabled (default/no behavior change)", async () => {
    vi.stubEnv("JEV_MODERATION_ENABLED", "false");
    const { t, commentId } = await setupComment();
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await t.action(moderateComment, { commentId });
    expect(fetcher).not.toHaveBeenCalled();
    const comment = await t.run((ctx) => ctx.db.get(commentId));
    expect(comment?.hidden).toBe(false);
    expect(comment?.moderationReasons).toBeUndefined();
  });

  it("leaves an allowed comment visible and records empty reasons", async () => {
    vi.stubEnv("JEV_MODERATION_ENABLED", "true");
    vi.stubEnv("JEV_API_KEY", "fixture-key-never-real");
    const { t, commentId } = await setupComment();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(reply()), { status: 200 })));
    await t.action(moderateComment, { commentId });
    const comment = await t.run((ctx) => ctx.db.get(commentId));
    expect(comment?.hidden).toBe(false);
    expect(comment?.moderationReasons).toEqual([]);
  });

  it("hides a rejected comment and records the reasons", async () => {
    vi.stubEnv("JEV_MODERATION_ENABLED", "true");
    vi.stubEnv("JEV_API_KEY", "fixture-key-never-real");
    const { t, commentId } = await setupComment("call me at 555-1234 instead of using the app");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(reply({ contact_info_leak: 0.95 })), { status: 200 })));
    await t.action(moderateComment, { commentId });
    const comment = await t.run((ctx) => ctx.db.get(commentId));
    expect(comment?.hidden).toBe(true);
    expect(comment?.moderationReasons).toEqual(["contact_info_leak"]);
  });

  it("fails safe on a provider error: leaves hidden unchanged, flags for review", async () => {
    vi.stubEnv("JEV_MODERATION_ENABLED", "true");
    vi.stubEnv("JEV_API_KEY", "fixture-key-never-real");
    const { t, commentId } = await setupComment();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("boom", { status: 500 })));
    await t.action(moderateComment, { commentId });
    const comment = await t.run((ctx) => ctx.db.get(commentId));
    expect(comment?.hidden).toBe(false);
    expect(comment?.moderationFlag).toBe("review");
  });

  it("never leaks the API key into stored data", async () => {
    vi.stubEnv("JEV_MODERATION_ENABLED", "true");
    vi.stubEnv("JEV_API_KEY", "fixture-key-never-real");
    const { t, commentId } = await setupComment();
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(reply({ spam: 0.9 })), { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    await t.action(moderateComment, { commentId });
    expect(fetcher.mock.calls[0][0]).toBe("https://api.typesafe.ai/v1/systemone");
    expect(fetcher.mock.calls[0][1].headers.Authorization).toBe("Bearer fixture-key-never-real");
    const stored = await t.run((ctx) => ctx.db.get(commentId));
    expect(JSON.stringify(stored)).not.toContain("fixture-key");
  });
});

describe("moderateCampaign", () => {
  it("does nothing when disabled", async () => {
    vi.stubEnv("JEV_MODERATION_ENABLED", "false");
    const { t, campaignId } = await setupCampaign();
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await t.action(moderateCampaign, { campaignId });
    expect(fetcher).not.toHaveBeenCalled();
    const campaign = await t.run((ctx) => ctx.db.get(campaignId));
    expect(campaign?.status).toBe("active");
  });

  it("pulls a held/rejected active campaign back to pending_review", async () => {
    vi.stubEnv("JEV_MODERATION_ENABLED", "true");
    vi.stubEnv("JEV_API_KEY", "fixture-key-never-real");
    const { t, campaignId } = await setupCampaign("Free money!!", "wire us your deposit today");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(reply({ scam_or_phishing: 0.9 })), { status: 200 })));
    await t.action(moderateCampaign, { campaignId });
    const campaign = await t.run((ctx) => ctx.db.get(campaignId));
    expect(campaign?.status).toBe("pending_review");
    expect(campaign?.moderationReasons).toEqual(["scam_or_phishing"]);
  });

  it("does not resurrect a campaign that already expired on its own", async () => {
    vi.stubEnv("JEV_MODERATION_ENABLED", "true");
    vi.stubEnv("JEV_API_KEY", "fixture-key-never-real");
    const { t, campaignId } = await setupCampaign();
    await t.run((ctx) => ctx.db.patch(campaignId, { status: "expired" }));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(reply({ spam: 0.95 })), { status: 200 })));
    await t.action(moderateCampaign, { campaignId });
    const campaign = await t.run((ctx) => ctx.db.get(campaignId));
    expect(campaign?.status).toBe("expired");
    expect(campaign?.moderationReasons).toEqual(["spam"]);
  });

  it("fails safe on a provider error: leaves status unchanged, flags for review", async () => {
    vi.stubEnv("JEV_MODERATION_ENABLED", "true");
    vi.stubEnv("JEV_API_KEY", "fixture-key-never-real");
    const { t, campaignId } = await setupCampaign();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    await t.action(moderateCampaign, { campaignId });
    const campaign = await t.run((ctx) => ctx.db.get(campaignId));
    expect(campaign?.status).toBe("active");
    expect(campaign?.moderationFlag).toBe("review");
  });
});
