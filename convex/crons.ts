import { cronJobs } from "convex/server";
import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { closeCall } from "./callParticipants";

// Presence rows are considered "online" while fresh (see presence.ts's
// ONLINE_WINDOW_MS); this sweep just bounds table size for rows that have
// gone stale well past that window, rather than gating online/offline
// itself (that's computed at read time).
const PRESENCE_TRIM_MS = 60_000;
const TYPING_STALE_MS = 5_000;
// FR-031a grace period: clients heartbeat ~every 10s, so a participant whose
// last heartbeat is older than this is treated as dropped (crashed tab, lost
// network) and removed even though they never sent an explicit `leave`.
const CALL_PARTICIPANT_STALE_MS = 15_000;

export const sweepStalePresence = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - PRESENCE_TRIM_MS;
    const rows = await ctx.db.query("presence").collect();
    for (const row of rows) {
      if (row.lastSeenAt < cutoff) {
        await ctx.db.delete(row._id);
      }
    }
  },
});

export const sweepStaleTyping = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - TYPING_STALE_MS;
    const rows = await ctx.db.query("typingIndicators").collect();
    for (const row of rows) {
      if (row.updatedAt < cutoff) {
        await ctx.db.delete(row._id);
      }
    }
  },
});

// FR-031a: remove call participants whose heartbeat has gone stale (dropped
// without an explicit leave), then close any call they emptied — clearing its
// signals via the same `closeCall` used by the explicit-leave path.
export const sweepStaleCallParticipants = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - CALL_PARTICIPANT_STALE_MS;
    const rows = await ctx.db.query("callParticipants").collect();
    const affectedCallIds = new Set<Id<"calls">>();
    for (const row of rows) {
      if (row.lastHeartbeatAt < cutoff) {
        affectedCallIds.add(row.callId);
        await ctx.db.delete(row._id);
      }
    }
    for (const callId of affectedCallIds) {
      const remaining = await ctx.db
        .query("callParticipants")
        .withIndex("by_call", (q) => q.eq("callId", callId))
        .collect();
      if (remaining.length === 0) {
        await closeCall(ctx, callId);
      }
    }
  },
});

const crons = cronJobs();

crons.interval(
  "sweep stale presence",
  { seconds: 30 },
  internal.crons.sweepStalePresence,
  {},
);
crons.interval(
  "sweep stale typing indicators",
  { seconds: 10 },
  internal.crons.sweepStaleTyping,
  {},
);

crons.interval(
  "sweep stale call participants",
  { seconds: 10 },
  internal.crons.sweepStaleCallParticipants,
  {},
);

export default crons;
