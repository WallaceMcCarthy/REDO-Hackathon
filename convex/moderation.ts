import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { moderationRequest, interpretModeration, type ModerationJudgment } from "./lib/moderation";

declare const process: { env: Record<string, string | undefined> };

/** Separate flag and quota from jev.ts's JEV_PREFERENCES_ENABLED by design (#99, edward-aurora msg 688). */
const enabled = () => process.env.JEV_MODERATION_ENABLED === "true" && !!process.env.JEV_API_KEY;

async function judge(
  kind: "ad" | "comment",
  text: string,
  imageUrl?: string | null,
): Promise<{ status: "judged"; judgment: ModerationJudgment } | { status: "unavailable" }> {
  const request = moderationRequest(kind, text, imageUrl);
  try {
    const response = await fetch("https://api.typesafe.ai/v1/systemone", {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Bearer ${process.env.JEV_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(request.body),
    });
    if (!response.ok) throw new Error("Provider request failed");
    return { status: "judged", judgment: interpretModeration(await response.json()) };
  } catch {
    // Do not surface provider error bodies: they can echo submitted text or credentials.
    return { status: "unavailable" };
  }
}

export const getCommentForModeration = internalQuery({
  args: { commentId: v.id("comments") },
  handler: (ctx, { commentId }) => ctx.db.get(commentId),
});

export const getCampaignForModeration = internalQuery({
  args: { campaignId: v.id("campaigns") },
  handler: (ctx, { campaignId }) => ctx.db.get(campaignId),
});

export const applyCommentJudgment = internalMutation({
  args: { commentId: v.id("comments"), judgment: v.object({ verdict: v.string(), reasons: v.array(v.string()), model: v.string() }) },
  handler: async (ctx, { commentId, judgment }) => {
    const patch: Record<string, unknown> = { moderationReasons: judgment.reasons };
    if (judgment.verdict !== "allow") patch.hidden = true;
    await ctx.db.patch(commentId, patch);
  },
});

export const applyCampaignJudgment = internalMutation({
  args: { campaignId: v.id("campaigns"), judgment: v.object({ verdict: v.string(), reasons: v.array(v.string()), model: v.string() }) },
  handler: async (ctx, { campaignId, judgment }) => {
    const patch: Record<string, unknown> = { moderationReasons: judgment.reasons };
    // Only a still-active, not-yet-expired ad is pulled back for review: a
    // free ad that already ended on its own shouldn't be resurrected into
    // "pending_review" by a late-arriving judgment.
    if (judgment.verdict !== "allow") {
      const campaign = await ctx.db.get(campaignId);
      if (campaign?.status === "active") patch.status = "pending_review";
    }
    await ctx.db.patch(campaignId, patch);
  },
});

export const flagCommentForReview = internalMutation({
  args: { commentId: v.id("comments") },
  handler: (ctx, { commentId }) => ctx.db.patch(commentId, { moderationFlag: "review" as const }),
});

export const flagCampaignForReview = internalMutation({
  args: { campaignId: v.id("campaigns") },
  handler: (ctx, { campaignId }) => ctx.db.patch(campaignId, { moderationFlag: "review" as const }),
});

/**
 * Scheduled (not awaited) from social.ts's addComment, so the public mutation's
 * shape and the frontend never change. A comment is briefly visible until this
 * runs (typically well under a second); fail-safe: a provider error leaves
 * `hidden` exactly as it was (existing behaviour) and only sets moderationFlag
 * for a human to check, never auto-allows or auto-blocks on our own guess.
 */
export const moderateComment = internalAction({
  args: { commentId: v.id("comments") },
  handler: async (ctx, { commentId }) => {
    if (!enabled()) return;
    const comment = await ctx.runQuery(internal.moderation.getCommentForModeration, { commentId });
    if (!comment) return;
    const result = await judge("comment", comment.body);
    if (result.status === "unavailable") {
      await ctx.runMutation(internal.moderation.flagCommentForReview, { commentId });
      return;
    }
    await ctx.runMutation(internal.moderation.applyCommentJudgment, { commentId, judgment: result.judgment });
  },
});

/** Scheduled from ads.ts's publishCampaign (the free, no-payment path only). See moderateComment for the fail-safe rationale. */
export const moderateCampaign = internalAction({
  args: { campaignId: v.id("campaigns") },
  handler: async (ctx, { campaignId }) => {
    if (!enabled()) return;
    const campaign = await ctx.runQuery(internal.moderation.getCampaignForModeration, { campaignId });
    if (!campaign) return;
    const result = await judge("ad", `${campaign.title}\n\n${campaign.body}`, campaign.imageUrl);
    if (result.status === "unavailable") {
      await ctx.runMutation(internal.moderation.flagCampaignForReview, { campaignId });
      return;
    }
    await ctx.runMutation(internal.moderation.applyCampaignJudgment, { campaignId, judgment: result.judgment });
  },
});
