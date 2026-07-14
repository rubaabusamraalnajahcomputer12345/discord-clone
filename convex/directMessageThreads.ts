import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { requireUserId } from "./lib/authz";

// Canonical participant order: the lexicographically smaller user ID is always
// userA, so a pair maps to exactly one (userAId, userBId) row regardless of who
// initiates (data-model.md).
function canonicalPair(
  a: Id<"users">,
  b: Id<"users">,
): [Id<"users">, Id<"users">] {
  return (a as string) < (b as string) ? [a, b] : [b, a];
}

// FR-023: open (or reuse) a 1-on-1 DM thread with another user. Allowed only
// when the two users share at least one server.
export const getOrCreate = mutation({
  args: { otherUserId: v.id("users") },
  handler: async (ctx, { otherUserId }) => {
    const userId = await requireUserId(ctx);
    if (otherUserId === userId) {
      throw new Error("You cannot start a conversation with yourself");
    }

    const myMemberships = await ctx.db
      .query("serverMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const myServerIds = new Set(myMemberships.map((m) => m.serverId as string));
    const theirMemberships = await ctx.db
      .query("serverMembers")
      .withIndex("by_user", (q) => q.eq("userId", otherUserId))
      .collect();
    const shareServer = theirMemberships.some((m) =>
      myServerIds.has(m.serverId as string),
    );
    if (!shareServer) {
      throw new Error("You can only message members you share a server with");
    }

    const [userAId, userBId] = canonicalPair(userId, otherUserId);
    const existing = await ctx.db
      .query("directMessageThreads")
      .withIndex("by_participants", (q) =>
        q.eq("userAId", userAId).eq("userBId", userBId),
      )
      .unique();
    if (existing !== null) {
      return existing._id;
    }
    return await ctx.db.insert("directMessageThreads", {
      userAId,
      userBId,
      createdAt: Date.now(),
    });
  },
});

// The caller's DM threads with the other participant's profile denormalized.
export const listForCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    // Two indexed lookups (caller-as-A via by_participants' prefix, caller-as-B
    // via by_userB) then merge — see the by_userB comment in schema.ts.
    const asUserA = await ctx.db
      .query("directMessageThreads")
      .withIndex("by_participants", (q) => q.eq("userAId", userId))
      .collect();
    const asUserB = await ctx.db
      .query("directMessageThreads")
      .withIndex("by_userB", (q) => q.eq("userBId", userId))
      .collect();

    const threads = [...asUserA, ...asUserB];
    return await Promise.all(
      threads.map(async (thread) => {
        const otherUserId =
          thread.userAId === userId ? thread.userBId : thread.userAId;
        const other = await ctx.db.get(otherUserId);
        return {
          threadId: thread._id,
          createdAt: thread.createdAt,
          otherUser: {
            userId: otherUserId,
            displayName: other?.displayName ?? "Unknown",
            avatarUrl: other?.avatarUrl ?? "",
          },
        };
      }),
    );
  },
});
