import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireCallParticipant } from "./lib/authz";

const signalType = v.union(
  v.literal("offer"),
  v.literal("answer"),
  v.literal("ice-candidate"),
);

// WebRTC signaling relay (research §2): a peer posts an offer/answer/ICE
// candidate addressed to another participant. Both ends must be participants
// of the call.
export const send = mutation({
  args: {
    callId: v.id("calls"),
    toUserId: v.id("users"),
    type: signalType,
    payload: v.string(),
  },
  handler: async (ctx, args) => {
    const fromUserId = await requireCallParticipant(ctx, args.callId);
    const target = await ctx.db
      .query("callParticipants")
      .withIndex("by_call_and_user", (q) =>
        q.eq("callId", args.callId).eq("userId", args.toUserId),
      )
      .unique();
    if (target === null) {
      throw new Error("Recipient is not a participant of this call");
    }
    await ctx.db.insert("signals", {
      callId: args.callId,
      fromUserId,
      toUserId: args.toUserId,
      type: args.type,
      payload: args.payload,
      createdAt: Date.now(),
    });
  },
});

// Signals addressed to the caller, newer than the caller's locally-tracked
// `since` cursor (default 0). The client bumps `since` past each batch it
// applies so reactive re-fires don't reapply already-processed rows (see
// contracts/convex-api.md).
export const listInbox = query({
  args: { callId: v.id("calls"), since: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await requireCallParticipant(ctx, args.callId);
    const since = args.since ?? 0;
    return await ctx.db
      .query("signals")
      .withIndex("by_call_and_to", (q) =>
        q.eq("callId", args.callId).eq("toUserId", userId).gt("createdAt", since),
      )
      .collect();
  },
});
