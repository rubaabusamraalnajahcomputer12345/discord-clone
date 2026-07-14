import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getOptionalUserId, requireUserId } from "./lib/authz";
import { validateDisplayName } from "./lib/validators";

// FR-002: update display name/avatar.
export const updateProfile = mutation({
  args: {
    displayName: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const patch: { displayName?: string; avatarUrl?: string } = {};
    if (args.displayName !== undefined) {
      patch.displayName = validateDisplayName(args.displayName);
    }
    if (args.avatarUrl !== undefined) {
      patch.avatarUrl = args.avatarUrl;
    }
    await ctx.db.patch(userId, patch);
  },
});

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getOptionalUserId(ctx);
    if (userId === null) {
      return null;
    }
    return await ctx.db.get(userId);
  },
});
