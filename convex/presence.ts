import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireServerMembership, requireUserId } from "./lib/authz";

// Heartbeat + staleness pattern (research.md §4): a user is "online" while
// their last heartbeat is within this window; no separate offline write path.
const ONLINE_WINDOW_MS = 20_000;

export const heartbeat = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const existing = await ctx.db
      .query("presence")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    const now = Date.now();
    if (existing === null) {
      await ctx.db.insert("presence", { userId, lastSeenAt: now });
    } else {
      await ctx.db.patch(existing._id, { lastSeenAt: now });
    }
  },
});

export const listForServer = query({
  args: { serverId: v.id("servers") },
  handler: async (ctx, { serverId }) => {
    await requireServerMembership(ctx, serverId);
    const members = await ctx.db
      .query("serverMembers")
      .withIndex("by_server", (q) => q.eq("serverId", serverId))
      .collect();
    const now = Date.now();
    return await Promise.all(
      members.map(async (member) => {
        const [user, presenceRow] = await Promise.all([
          ctx.db.get(member.userId),
          ctx.db
            .query("presence")
            .withIndex("by_user", (q) => q.eq("userId", member.userId))
            .unique(),
        ]);
        return {
          userId: member.userId,
          displayName: user?.displayName ?? "Unknown",
          avatarUrl: user?.avatarUrl ?? "",
          online: presenceRow !== null && now - presenceRow.lastSeenAt < ONLINE_WINDOW_MS,
        };
      }),
    );
  },
});
