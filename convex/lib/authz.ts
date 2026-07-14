import { auth } from "../auth";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type Ctx = QueryCtx | MutationCtx;

/**
 * Resolves the authenticated caller's user ID, or `null` if unauthenticated.
 *
 * Uses `auth.getUserId(ctx)` (returned from `convexAuth()` in `./auth.ts`) —
 * NOT a top-level `getAuthUserId` export from `@convex-dev/auth/server`,
 * which does not exist in the installed @convex-dev/auth version (0.0.54);
 * confirmed against the package's own .d.ts rather than assumed.
 */
export async function getOptionalUserId(ctx: Ctx): Promise<Id<"users"> | null> {
  return auth.getUserId(ctx);
}

/** Same as {@link getOptionalUserId}, but throws when unauthenticated. */
export async function requireUserId(ctx: Ctx): Promise<Id<"users">> {
  const userId = await getOptionalUserId(ctx);
  if (userId === null) {
    throw new Error("Not authenticated");
  }
  return userId;
}

export async function requireServerMembership(
  ctx: Ctx,
  serverId: Id<"servers">,
): Promise<Doc<"serverMembers">> {
  const userId = await requireUserId(ctx);
  const membership = await ctx.db
    .query("serverMembers")
    .withIndex("by_server_and_user", (q) =>
      q.eq("serverId", serverId).eq("userId", userId),
    )
    .unique();
  if (membership === null) {
    throw new Error("Not a member of this server");
  }
  return membership;
}

export async function requireServerOwner(
  ctx: Ctx,
  serverId: Id<"servers">,
): Promise<Id<"users">> {
  const userId = await requireUserId(ctx);
  const server = await ctx.db.get(serverId);
  if (server === null) {
    throw new Error("Server not found");
  }
  if (server.ownerId !== userId) {
    throw new Error("Only the server owner can perform this action");
  }
  return userId;
}

export async function requireThreadParticipant(
  ctx: Ctx,
  threadId: Id<"directMessageThreads">,
): Promise<Id<"users">> {
  const userId = await requireUserId(ctx);
  const thread = await ctx.db.get(threadId);
  if (thread === null) {
    throw new Error("Conversation not found");
  }
  if (thread.userAId !== userId && thread.userBId !== userId) {
    throw new Error("Not a participant of this conversation");
  }
  return userId;
}

/** Resolves a channel and confirms the caller is a member of its parent server. */
export async function requireChannelMembership(
  ctx: Ctx,
  channelId: Id<"channels">,
): Promise<{ userId: Id<"users">; channel: Doc<"channels"> }> {
  const channel = await ctx.db.get(channelId);
  if (channel === null) {
    throw new Error("Channel not found");
  }
  const membership = await requireServerMembership(ctx, channel.serverId);
  return { userId: membership.userId, channel };
}

export async function requireCallParticipant(
  ctx: Ctx,
  callId: Id<"calls">,
): Promise<Id<"users">> {
  const userId = await requireUserId(ctx);
  const participant = await ctx.db
    .query("callParticipants")
    .withIndex("by_call_and_user", (q) =>
      q.eq("callId", callId).eq("userId", userId),
    )
    .unique();
  if (participant === null) {
    throw new Error("Not a participant of this call");
  }
  return userId;
}
