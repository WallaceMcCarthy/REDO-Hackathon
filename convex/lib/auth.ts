/** Shared auth helpers: every later write imports requireUserId, never trusts a client-sent id. */
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "../_generated/dataModel";
import type { QueryCtx, MutationCtx } from "../_generated/server";

export async function getOptionalUserId(ctx: QueryCtx | MutationCtx): Promise<Id<"users"> | null> {
  return getAuthUserId(ctx);
}

export async function requireUserId(ctx: QueryCtx | MutationCtx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Sign in required");
  return userId;
}
