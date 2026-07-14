import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireServerMembership, requireServerOwner, requireUserId } from "./lib/authz";
import { validateServerName } from "./lib/validators";
import { deleteChannelWithChildren } from "./channels";

function generateInviteCode(): string {
  // Opaque, unguessable token (data-model.md); native Web Crypto UUID with
  // dashes stripped keeps invite URLs compact.
  return crypto.randomUUID().replace(/-/g, "");
}

// FR-004, FR-005: create a server; the creator becomes owner and a default
// `#general` text channel is created atomically in the same mutation.
export const create = mutation({
  args: { name: v.string(), imageUrl: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const name = validateServerName(args.name);
    const now = Date.now();

    const serverId = await ctx.db.insert("servers", {
      name,
      imageUrl: args.imageUrl,
      ownerId: userId,
      inviteCode: generateInviteCode(),
      createdAt: now,
    });
    await ctx.db.insert("serverMembers", { serverId, userId, joinedAt: now });
    await ctx.db.insert("channels", {
      serverId,
      name: "general",
      type: "text",
      createdAt: now,
    });

    return serverId;
  },
});

// FR-008: owner renames the server.
export const rename = mutation({
  args: { serverId: v.id("servers"), name: v.string() },
  handler: async (ctx, args) => {
    await requireServerOwner(ctx, args.serverId);
    const name = validateServerName(args.name);
    await ctx.db.patch(args.serverId, { name });
  },
});

// FR-009, FR-010, FR-015: owner removes another member. Self-removal goes
// through `leave` (which additionally cascades if the caller is the owner).
export const removeMember = mutation({
  args: { serverId: v.id("servers"), userId: v.id("users") },
  handler: async (ctx, args) => {
    const ownerId = await requireServerOwner(ctx, args.serverId);
    if (args.userId === ownerId) {
      throw new Error("The owner cannot remove themselves; use leave instead");
    }
    const membership = await ctx.db
      .query("serverMembers")
      .withIndex("by_server_and_user", (q) =>
        q.eq("serverId", args.serverId).eq("userId", args.userId),
      )
      .unique();
    if (membership === null) {
      throw new Error("That user is not a member of this server");
    }
    await ctx.db.delete(membership._id);
  },
});

// FR-010, FR-010a: a member leaves. Because there is no ownership transfer,
// when the owner leaves the entire server is torn down — every channel (with
// its messages/calls) and every membership — in this one mutation.
export const leave = mutation({
  args: { serverId: v.id("servers") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const server = await ctx.db.get(args.serverId);
    if (server === null) {
      throw new Error("Server not found");
    }
    const membership = await ctx.db
      .query("serverMembers")
      .withIndex("by_server_and_user", (q) =>
        q.eq("serverId", args.serverId).eq("userId", userId),
      )
      .unique();
    if (membership === null) {
      throw new Error("You are not a member of this server");
    }

    if (server.ownerId === userId) {
      const channels = await ctx.db
        .query("channels")
        .withIndex("by_server", (q) => q.eq("serverId", args.serverId))
        .collect();
      for (const channel of channels) {
        await deleteChannelWithChildren(ctx, channel._id);
      }
      const members = await ctx.db
        .query("serverMembers")
        .withIndex("by_server", (q) => q.eq("serverId", args.serverId))
        .collect();
      for (const member of members) {
        await ctx.db.delete(member._id);
      }
      await ctx.db.delete(args.serverId);
    } else {
      await ctx.db.delete(membership._id);
    }
  },
});

// FR-006: return the server's (non-expiring, reusable) invite link.
export const generateInvite = mutation({
  args: { serverId: v.id("servers") },
  handler: async (ctx, { serverId }) => {
    await requireServerOwner(ctx, serverId);
    const server = await ctx.db.get(serverId);
    if (server === null) {
      throw new Error("Server not found");
    }
    return { inviteCode: server.inviteCode };
  },
});

export const joinByInvite = mutation({
  args: { inviteCode: v.string() },
  handler: async (ctx, { inviteCode }) => {
    const userId = await requireUserId(ctx);
    const server = await ctx.db
      .query("servers")
      .withIndex("by_inviteCode", (q) => q.eq("inviteCode", inviteCode))
      .unique();
    if (server === null) {
      throw new Error("Invite link is invalid or the server no longer exists");
    }
    const existing = await ctx.db
      .query("serverMembers")
      .withIndex("by_server_and_user", (q) =>
        q.eq("serverId", server._id).eq("userId", userId),
      )
      .unique();
    if (existing === null) {
      await ctx.db.insert("serverMembers", {
        serverId: server._id,
        userId,
        joinedAt: Date.now(),
      });
    }
    return server._id;
  },
});

export const listForCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const memberships = await ctx.db
      .query("serverMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const servers = await Promise.all(
      memberships.map((membership) => ctx.db.get(membership.serverId)),
    );
    return servers.filter((server): server is NonNullable<typeof server> => server !== null);
  },
});

export const get = query({
  args: { serverId: v.id("servers") },
  handler: async (ctx, { serverId }) => {
    await requireServerMembership(ctx, serverId);
    const server = await ctx.db.get(serverId);
    if (server === null) {
      throw new Error("Server not found");
    }
    return server;
  },
});
