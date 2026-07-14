import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { scopeValidator } from "./lib/scope";
import {
  requireCallParticipant,
  requireScopeAccess,
} from "./lib/authz";
import { canJoinCall, willCallBecomeEmpty } from "./lib/callState";

/**
 * Close a call and delete its remaining signals immediately (data-model.md:
 * signals are cleaned up "immediately on call end", not deferred to the
 * cron). Exported (non-registered) so the T045 stale-participant sweep can
 * reuse the exact same teardown.
 */
export async function closeCall(
  ctx: MutationCtx,
  callId: Id<"calls">,
): Promise<void> {
  const call = await ctx.db.get(callId);
  if (call !== null && call.endedAt === undefined) {
    await ctx.db.patch(callId, { endedAt: Date.now() });
  }
  const signals = await ctx.db
    .query("signals")
    .withIndex("by_call_and_to", (q) => q.eq("callId", callId))
    .collect();
  for (const signal of signals) {
    await ctx.db.delete(signal._id);
  }
}

// FR-026, FR-027: join the scope's active call (creating it on first join).
// Rejected when the call already holds MAX_CALL_PARTICIPANTS people; an
// existing participant rejoining just refreshes their heartbeat.
export const join = mutation({
  args: { scope: scopeValidator },
  handler: async (ctx, { scope }): Promise<Id<"calls">> => {
    const userId = await requireScopeAccess(ctx, scope);
    const callId: Id<"calls"> = await ctx.runMutation(
      internal.calls.getOrCreateActiveForScope,
      { scope },
    );

    const existing = await ctx.db
      .query("callParticipants")
      .withIndex("by_call_and_user", (q) =>
        q.eq("callId", callId).eq("userId", userId),
      )
      .unique();
    if (existing !== null) {
      await ctx.db.patch(existing._id, { lastHeartbeatAt: Date.now() });
      return callId;
    }

    const participants = await ctx.db
      .query("callParticipants")
      .withIndex("by_call", (q) => q.eq("callId", callId))
      .collect();
    if (!canJoinCall(participants.length)) {
      throw new Error("This call is full (maximum 4 participants)");
    }

    const now = Date.now();
    await ctx.db.insert("callParticipants", {
      callId,
      userId,
      joinedAt: now,
      lastHeartbeatAt: now,
      micOn: true,
      cameraOn: false,
    });
    return callId;
  },
});

// FR-031: leave the call; if this empties it, close it and clear signals
// immediately (via callState.willCallBecomeEmpty + closeCall).
export const leave = mutation({
  args: { callId: v.id("calls") },
  handler: async (ctx, { callId }) => {
    const userId = await requireCallParticipant(ctx, callId);
    const participants = await ctx.db
      .query("callParticipants")
      .withIndex("by_call", (q) => q.eq("callId", callId))
      .collect();
    const mine = participants.find((p) => p.userId === userId);
    if (mine) {
      await ctx.db.delete(mine._id);
    }
    if (willCallBecomeEmpty(participants.length)) {
      await closeCall(ctx, callId);
    }
  },
});

// Feeds the FR-031a grace-period sweep — caller refreshes only their row.
export const heartbeat = mutation({
  args: { callId: v.id("calls") },
  handler: async (ctx, { callId }) => {
    const userId = await requireCallParticipant(ctx, callId);
    const mine = await ctx.db
      .query("callParticipants")
      .withIndex("by_call_and_user", (q) =>
        q.eq("callId", callId).eq("userId", userId),
      )
      .unique();
    if (mine) {
      await ctx.db.patch(mine._id, { lastHeartbeatAt: Date.now() });
    }
  },
});

// FR-028: caller toggles only their own mic/camera state.
export const setMicCamera = mutation({
  args: {
    callId: v.id("calls"),
    micOn: v.optional(v.boolean()),
    cameraOn: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await requireCallParticipant(ctx, args.callId);
    const mine = await ctx.db
      .query("callParticipants")
      .withIndex("by_call_and_user", (q) =>
        q.eq("callId", args.callId).eq("userId", userId),
      )
      .unique();
    if (mine === null) {
      throw new Error("Not a participant of this call");
    }
    const patch: { micOn?: boolean; cameraOn?: boolean } = {};
    if (args.micOn !== undefined) {
      patch.micOn = args.micOn;
    }
    if (args.cameraOn !== undefined) {
      patch.cameraOn = args.cameraOn;
    }
    await ctx.db.patch(mine._id, patch);
  },
});

// FR-029/FR-032: participant list with denormalized name/avatar (read-time
// join, matching messages.listPage/presence.listForServer).
export const list = query({
  args: { callId: v.id("calls") },
  handler: async (ctx, { callId }) => {
    await requireCallParticipant(ctx, callId);
    const participants = await ctx.db
      .query("callParticipants")
      .withIndex("by_call", (q) => q.eq("callId", callId))
      .collect();
    return await Promise.all(
      participants.map(async (participant) => {
        const user = await ctx.db.get(participant.userId);
        return {
          ...participant,
          displayName: user?.displayName ?? "Unknown",
          avatarUrl: user?.avatarUrl ?? "",
        };
      }),
    );
  },
});
