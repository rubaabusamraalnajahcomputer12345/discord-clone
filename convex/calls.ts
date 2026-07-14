import { internalMutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { scopeValidator, type CallScope } from "./lib/scope";
import { requireScopeAccess } from "./lib/authz";

// Find the single active (not-yet-ended) call for a scope, or null. There is
// at most one active call per scope because `getOrCreateActiveForScope` below
// is the only creation path and reuses an existing active call.
async function findActiveCall(
  ctx: QueryCtx | MutationCtx,
  scope: CallScope,
): Promise<Doc<"calls"> | null> {
  if (scope.kind === "channel") {
    return await ctx.db
      .query("calls")
      .withIndex("by_channel", (q) => q.eq("scope.channelId", scope.channelId))
      .filter((q) => q.eq(q.field("endedAt"), undefined))
      .first();
  }
  return await ctx.db
    .query("calls")
    .withIndex("by_thread", (q) => q.eq("scope.threadId", scope.threadId))
    .filter((q) => q.eq(q.field("endedAt"), undefined))
    .first();
}

// FR-026: the active call for a voice channel or DM thread, if one exists.
export const getActiveForScope = query({
  args: { scope: scopeValidator },
  handler: async (ctx, { scope }) => {
    await requireScopeAccess(ctx, scope);
    return await findActiveCall(ctx, scope);
  },
});

// FR-026: resolve-or-create the active call for a scope. Internal — only
// called from `callParticipants.join`'s server-side logic (which has already
// authorized the caller), never from the client.
export const getOrCreateActiveForScope = internalMutation({
  args: { scope: scopeValidator },
  handler: async (ctx, { scope }): Promise<Id<"calls">> => {
    const existing = await findActiveCall(ctx, scope);
    if (existing !== null) {
      return existing._id;
    }
    return await ctx.db.insert("calls", { scope, startedAt: Date.now() });
  },
});
