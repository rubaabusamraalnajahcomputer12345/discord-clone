import { cronJobs } from "convex/server";
import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

// Presence rows are considered "online" while fresh (see presence.ts's
// ONLINE_WINDOW_MS); this sweep just bounds table size for rows that have
// gone stale well past that window, rather than gating online/offline
// itself (that's computed at read time).
const PRESENCE_TRIM_MS = 60_000;
const TYPING_STALE_MS = 5_000;

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

// US3 (T045) adds: crons.interval("sweep stale call participants", ...).

export default crons;
