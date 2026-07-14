import { query } from "./_generated/server";
import { v } from "convex/values";
import { requireServerMembership } from "./lib/authz";

export const list = query({
  args: { serverId: v.id("servers") },
  handler: async (ctx, { serverId }) => {
    await requireServerMembership(ctx, serverId);
    const server = await ctx.db.get(serverId);
    const members = await ctx.db
      .query("serverMembers")
      .withIndex("by_server", (q) => q.eq("serverId", serverId))
      .collect();
    return await Promise.all(
      members.map(async (member) => {
        const user = await ctx.db.get(member.userId);
        return {
          userId: member.userId,
          displayName: user?.displayName ?? "Unknown",
          avatarUrl: user?.avatarUrl ?? "",
          isOwner: server?.ownerId === member.userId,
        };
      }),
    );
  },
});
