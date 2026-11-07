import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { deleteConversationsForUser } from "./messages";
import { normalizeEmail } from "./lib/email";

/**
 * Run once with the deploy that normalizes sign in, or accounts created with capitals cannot sign in.
 * Safe to rerun. A clash means one person made two accounts: both stay and the raw ids are returned for a human.
 */
export const normalizeAccountEmails = internalMutation({
  args: {},
  handler: async (ctx) => {
    const accounts = await ctx.db.query("authAccounts").collect();
    const passwords = accounts.filter((a) => a.provider === "password");
    const taken = new Set(passwords.map((a) => a.providerAccountId));
    const clashes: string[] = [];
    let changed = 0;
    for (const account of passwords) {
      const email = normalizeEmail(account.providerAccountId);
      if (email === account.providerAccountId) continue;
      if (taken.has(email)) {
        clashes.push(account.providerAccountId);
        continue;
      }
      taken.add(email);
      await ctx.db.patch(account._id, { providerAccountId: email });
      await ctx.db.patch(account.userId, { email });
      changed++;
    }
    return { changed, clashes };
  },
});

export const deleteTestAccounts = internalMutation({
  args: {
    emails: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const targetEmails = args.emails ?? [
      "qa+7i2xlq@example.com",
      "qa+zout6w@example.com",
      "e2e-check-1794016950179@example.com",
    ];

    const results: {
      email: string;
      found: boolean;
      userId?: string;
      deletedRecords: Record<string, number>;
    }[] = [];

    for (const email of targetEmails) {
      const deletedRecords: Record<string, number> = {};
      const user = await ctx.db
        .query("users")
        .filter((q) => q.eq(q.field("email"), email))
        .first();

      if (!user) {
        results.push({ email, found: false, deletedRecords: {} });
        continue;
      }

      const userId = user._id;

      // 1. Delete profiles
      const profiles = await ctx.db
        .query("profiles")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect();
      for (const p of profiles) await ctx.db.delete(p._id);
      deletedRecords.profiles = profiles.length;

      // 2. Delete saved listings
      const saved = await ctx.db
        .query("saved")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
      for (const s of saved) await ctx.db.delete(s._id);
      deletedRecords.saved = saved.length;

      // 3. Delete comments
      const comments = await ctx.db
        .query("comments")
        .filter((q) => q.eq(q.field("userId"), userId))
        .collect();
      for (const c of comments) await ctx.db.delete(c._id);
      deletedRecords.comments = comments.length;

      // 4. Delete contentReports
      const reports = await ctx.db
        .query("contentReports")
        .filter((q) => q.eq(q.field("userId"), userId))
        .collect();
      for (const r of reports) await ctx.db.delete(r._id);
      deletedRecords.contentReports = reports.length;

      // 5. Delete posts
      const posts = await ctx.db
        .query("posts")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect();
      for (const po of posts) await ctx.db.delete(po._id);
      deletedRecords.posts = posts.length;

      // 6. Delete postLikes
      const postLikes = await ctx.db
        .query("postLikes")
        .filter((q) => q.eq(q.field("userId"), userId))
        .collect();
      for (const pl of postLikes) await ctx.db.delete(pl._id);
      deletedRecords.postLikes = postLikes.length;

      // 7. Delete roommateProfiles
      const roommateProfiles = await ctx.db
        .query("roommateProfiles")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect();
      for (const rp of roommateProfiles) await ctx.db.delete(rp._id);
      deletedRecords.roommateProfiles = roommateProfiles.length;

      // 8. Delete roommate connections
      const connFrom = await ctx.db
        .query("connections")
        .withIndex("by_from", (q) => q.eq("fromUserId", userId))
        .collect();
      for (const c of connFrom) await ctx.db.delete(c._id);
      const connTo = await ctx.db
        .query("connections")
        .withIndex("by_to", (q) => q.eq("toUserId", userId))
        .collect();
      for (const c of connTo) await ctx.db.delete(c._id);
      deletedRecords.connections = connFrom.length + connTo.length;

      // 9. Delete campaigns
      const campaigns = await ctx.db
        .query("campaigns")
        .withIndex("by_advertiser", (q) => q.eq("advertiserUserId", userId))
        .collect();
      for (const ca of campaigns) await ctx.db.delete(ca._id);
      deletedRecords.campaigns = campaigns.length;

      // 10. Delete authAccounts
      const accounts = await ctx.db
        .query("authAccounts")
        .filter((q) => q.eq(q.field("userId"), userId))
        .collect();
      for (const a of accounts) await ctx.db.delete(a._id);
      deletedRecords.authAccounts = accounts.length;

      // 11. Delete authSessions
      const sessions = await ctx.db
        .query("authSessions")
        .filter((q) => q.eq(q.field("userId"), userId))
        .collect();
      for (const s of sessions) await ctx.db.delete(s._id);
      deletedRecords.authSessions = sessions.length;

      // 12. Delete private messages & conversations
      while ((await deleteConversationsForUser(ctx, userId)) > 0);
      deletedRecords.conversations = 1;

      // 13. Delete user row itself
      await ctx.db.delete(userId);
      deletedRecords.users = 1;

      results.push({
        email,
        found: true,
        userId: userId.toString(),
        deletedRecords,
      });
    }

    return results;
  },
});
