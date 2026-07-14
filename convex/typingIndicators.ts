import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireChannelMembership } from "./lib/authz";

// A typer is shown as "typing" while their last ping is within this window;
// the sweep cron (T022, added to crons.ts) deletes rows older than this.
const TYPING_STALE_MS = 5_000;

export const ping = mutation({
  args: { channelId: v.id("channels") },
  handler: async (ctx, args) => {
    const { userId } = await requireChannelMembership(ctx, args.channelId);
    const existing = await ctx.db
      .query("typingIndicators")
      .withIndex("by_channel", (q) => q.eq("channelId", args.channelId))
      .filter((q) => q.eq(q.field("userId"), userId))
      .unique();
    const now = Date.now();
    if (existing === null) {
      await ctx.db.insert("typingIndicators", {
        channelId: args.channelId,
        userId,
        updatedAt: now,
      });
    } else {
      await ctx.db.patch(existing._id, { updatedAt: now });
    }
  },
});

export const listForChannel = query({
  args: { channelId: v.id("channels") },
  handler: async (ctx, args) => {
    const { userId: callerId } = await requireChannelMembership(ctx, args.channelId);
    const now = Date.now();
    const rows = await ctx.db
      .query("typingIndicators")
      .withIndex("by_channel", (q) => q.eq("channelId", args.channelId))
      .collect();
    return rows
      .filter((row) => row.userId !== callerId && now - row.updatedAt < TYPING_STALE_MS)
      .map((row) => ({ userId: row.userId }));
  },
});
