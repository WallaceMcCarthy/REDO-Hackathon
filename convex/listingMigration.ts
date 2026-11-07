import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import apartments from "../data/listings/apartments.json";
import migration from "../data/listings/apartments_id_migration.json";

/** Run BEFORE replacing legacy apartment rows. Default is a read-only preview.
 * Never uses a nearby complex, a missing source row, or an ambiguous legacy ID.
 */
export const migrateLegacyApartmentReferences = internalMutation({
  args: { dryRun: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const dryRun = args.dryRun ?? true;
    const [listings, saves, comments, conversations] = await Promise.all([
      ctx.db.query("listings").collect(), ctx.db.query("saved").collect(),
      ctx.db.query("comments").collect(), ctx.db.query("conversations").collect(),
    ]);
    const sourceById = new Map(listings.map(row => [row.id, row]));
    const targetById = new Map(apartments.map(row => [row.id, row]));
    const verified = new Map<string, string>();
    const skipped = { crossReleaseCollision: 0, targetMissing: 0, storedSourceMissing: 0, sourceMismatch: 0 };
    const name = (value: string | null) => (value ?? "").trim().toLowerCase();
    for (const mapping of migration.mappings) {
      if (mapping.collisionBetweenReleases) { skipped.crossReleaseCollision++; continue; }
      const target = mapping.newStableId ? targetById.get(mapping.newStableId) : null;
      if (!target) { skipped.targetMissing++; continue; }
      const source = sourceById.get(mapping.oldId);
      if (!source) { skipped.storedSourceMissing++; continue; }
      if (source.kind !== "apartment" || name(source.name) !== name(target.name)
        || Math.abs(source.lat - target.lat) > 0.000001 || Math.abs(source.lng - target.lng) > 0.000001) {
        skipped.sourceMismatch++; continue;
      }
      verified.set(mapping.oldId, target.id);
    }
    const report = { dryRun, verifiedMappings: verified.size, skipped, savedUpdated: 0, savedDeduplicated: 0, commentsUpdated: 0, conversationContextsUpdated: 0, conversationContextsSkipped: 0 };
    const savedPairs = new Set(saves.map(row => `${row.userId}|${row.listingId}`));
    for (const row of saves) {
      const listingId = verified.get(row.listingId);
      if (!listingId) continue;
      const pair = `${row.userId}|${listingId}`;
      if (savedPairs.has(pair)) {
        report.savedDeduplicated++;
        if (!dryRun) await ctx.db.delete(row._id);
      } else {
        savedPairs.add(pair); report.savedUpdated++;
        if (!dryRun) await ctx.db.patch(row._id, { listingId });
      }
    }
    for (const row of comments) {
      const targetId = row.targetType === "listing" ? verified.get(row.targetId) : undefined;
      if (!targetId) continue;
      report.commentsUpdated++;
      if (!dryRun) await ctx.db.patch(row._id, { targetId });
    }
    const conversationPairs = new Set(conversations.map(row => `${row.userA}|${row.userB}|${row.contextListingId}`));
    for (const row of conversations) {
      const contextListingId = row.contextListingId ? verified.get(row.contextListingId) : undefined;
      if (!contextListingId) continue;
      const pair = `${row.userA}|${row.userB}|${contextListingId}`;
      // Preserve both private threads rather than guessing how to merge history.
      if (conversationPairs.has(pair)) { report.conversationContextsSkipped++; continue; }
      conversationPairs.add(pair); report.conversationContextsUpdated++;
      if (!dryRun) await ctx.db.patch(row._id, { contextListingId });
    }
    return report;
  },
});
