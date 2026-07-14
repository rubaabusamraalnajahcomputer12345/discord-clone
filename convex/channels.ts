import { query } from "./_generated/server";
import { v } from "convex/values";
import { requireServerMembership } from "./lib/authz";
import type { Id } from "./_generated/dataModel";

// FR-012: list a server's channels. `connectedUserIds` is a real,
// live-populated field starting in US3 (T050) once calls/callParticipants
// exist; this phase (US1) only needs channels to be visible, so it's a
// static empty array here.
export const list = query({
  args: { serverId: v.id("servers") },
  handler: async (ctx, { serverId }) => {
    await requireServerMembership(ctx, serverId);
    const channels = await ctx.db
      .query("channels")
      .withIndex("by_server", (q) => q.eq("serverId", serverId))
      .collect();
    return channels.map((channel) => ({
      ...channel,
      connectedUserIds: [] as Id<"users">[],
    }));
  },
});
