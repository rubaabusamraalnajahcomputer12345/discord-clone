import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireServerMembership, requireServerOwner } from "./lib/authz";
import { validateChannelName } from "./lib/validators";

// FR-012: list a server's channels. `connectedUserIds` is a real,
// live-populated field starting in US3 (T050) once calls/callParticipants
// exist; this phase only needs channels to be visible, so it's a
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

// FR-011: owner creates a text or voice channel in their server.
export const create = mutation({
  args: {
    serverId: v.id("servers"),
    name: v.string(),
    type: v.union(v.literal("text"), v.literal("voice")),
  },
  handler: async (ctx, args) => {
    await requireServerOwner(ctx, args.serverId);
    const name = validateChannelName(args.name);
    return await ctx.db.insert("channels", {
      serverId: args.serverId,
      name,
      type: args.type,
      createdAt: Date.now(),
    });
  },
});

// FR-013: owner renames a channel.
export const rename = mutation({
  args: { channelId: v.id("channels"), name: v.string() },
  handler: async (ctx, args) => {
    const channel = await ctx.db.get(args.channelId);
    if (channel === null) {
      throw new Error("Channel not found");
    }
    await requireServerOwner(ctx, channel.serverId);
    const name = validateChannelName(args.name);
    await ctx.db.patch(args.channelId, { name });
  },
});

// FR-014: owner deletes a channel; its messages and any active call
// (participants + signals) are cascade-deleted in the same mutation.
export const remove = mutation({
  args: { channelId: v.id("channels") },
  handler: async (ctx, args) => {
    const channel = await ctx.db.get(args.channelId);
    if (channel === null) {
      throw new Error("Channel not found");
    }
    await requireServerOwner(ctx, channel.serverId);
    await deleteChannelWithChildren(ctx, args.channelId);
  },
});

// Cascade a call's children then the call row (data-model.md: a call and
// its callParticipants/signals are torn down together). Not a registered
// Convex function — a plain helper reused by the cascades below.
async function deleteCallWithChildren(
  ctx: MutationCtx,
  callId: Id<"calls">,
): Promise<void> {
  const participants = await ctx.db
    .query("callParticipants")
    .withIndex("by_call", (q) => q.eq("callId", callId))
    .collect();
  for (const participant of participants) {
    await ctx.db.delete(participant._id);
  }
  const signals = await ctx.db
    .query("signals")
    .withIndex("by_call_and_to", (q) => q.eq("callId", callId))
    .collect();
  for (const signal of signals) {
    await ctx.db.delete(signal._id);
  }
  await ctx.db.delete(callId);
}

/**
 * FR-014: delete a channel and everything hanging off it — messages,
 * typing indicators, and any channel-scoped calls (with their participants
 * and signals). Exported (non-registered) so `servers.leave` can reuse it
 * when tearing down an entire server (FR-010a) without duplicating the
 * cascade logic.
 */
export async function deleteChannelWithChildren(
  ctx: MutationCtx,
  channelId: Id<"channels">,
): Promise<void> {
  const messages = await ctx.db
    .query("messages")
    .withIndex("by_channel", (q) => q.eq("channelId", channelId))
    .collect();
  for (const message of messages) {
    await ctx.db.delete(message._id);
  }

  const typing = await ctx.db
    .query("typingIndicators")
    .withIndex("by_channel", (q) => q.eq("channelId", channelId))
    .collect();
  for (const row of typing) {
    await ctx.db.delete(row._id);
  }

  const calls = await ctx.db
    .query("calls")
    .withIndex("by_channel", (q) => q.eq("scope.channelId", channelId))
    .collect();
  for (const call of calls) {
    await deleteCallWithChildren(ctx, call._id);
  }

  await ctx.db.delete(channelId);
}
