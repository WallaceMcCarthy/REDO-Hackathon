/** Shared auth helpers: every later write imports requireUserId, never trusts a client-sent id. */
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "../_generated/dataModel";
import type { QueryCtx, MutationCtx } from "../_generated/server";

export async function getOptionalUserId(ctx: QueryCtx | MutationCtx): Promise<Id<"users"> | null> {
  const userId = await getAuthUserId(ctx);
  // A JWT stays valid until it expires, so it can outlive a deleted account.
  return userId && (await ctx.db.get(userId)) ? userId : null;
}

export async function requireUserId(ctx: QueryCtx | MutationCtx): Promise<Id<"users">> {
  const userId = await getOptionalUserId(ctx);
  if (!userId) throw new Error("Sign in required");
  return userId;
}
