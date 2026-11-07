import { v } from "convex/values";
import { mutation } from "./_generated/server";

const WINDOW_MS = 60_000;
const WINDOW_CAP = 5;

/** Store a small, anonymous diagnostic signal without accepting user content or URLs. */
export const report = mutation({
  args: {
    sessionKey: v.string(),
    source: v.union(v.literal("boundary"), v.literal("error"), v.literal("rejection")),
    errorName: v.string(),
  },
  handler: async (ctx, { sessionKey, source, errorName }) => {
    if (!sessionKey || sessionKey.length > 64 || !errorName || errorName.length > 80) return;
    const reportedAt = Date.now();
    const recent = await ctx.db
      .query("clientErrorReports")
      .withIndex("by_session_reportedAt", q => q.eq("sessionKey", sessionKey).gte("reportedAt", reportedAt - WINDOW_MS))
      .take(WINDOW_CAP);
    if (recent.length >= WINDOW_CAP) return;
    await ctx.db.insert("clientErrorReports", { sessionKey, source, errorName, reportedAt });
  },
});
