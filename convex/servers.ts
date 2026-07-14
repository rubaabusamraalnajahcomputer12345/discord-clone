import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireServerMembership, requireServerOwner, requireUserId } from "./lib/authz";
import { validateServerName } from "./lib/validators";

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
