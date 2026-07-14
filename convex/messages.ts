import { mutation, query } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { requireChannelMembership, requireUserId } from "./lib/authz";
import { validateMessageContent } from "./lib/validators";

export const send = mutation({
  args: { channelId: v.id("channels"), content: v.string() },
  handler: async (ctx, args) => {
    const { userId } = await requireChannelMembership(ctx, args.channelId);
    const content = validateMessageContent(args.content);
    return await ctx.db.insert("messages", {
      channelId: args.channelId,
      authorId: userId,
      content,
      createdAt: Date.now(),
    });
  },
});

export const edit = mutation({
  args: { messageId: v.id("messages"), content: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const message = await ctx.db.get(args.messageId);
    if (message === null) {
      throw new Error("Message not found");
    }
    if (message.authorId !== userId) {
      throw new Error("Only the author can edit this message");
    }
    const content = validateMessageContent(args.content);
    await ctx.db.patch(args.messageId, { content, editedAt: Date.now() });
  },
});

export const remove = mutation({
  args: { messageId: v.id("messages") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const message = await ctx.db.get(args.messageId);
    if (message === null) {
      throw new Error("Message not found");
    }
    if (message.authorId !== userId) {
      throw new Error("Only the author can delete this message");
    }
    await ctx.db.delete(args.messageId);
  },
});

// FR-021: newest-first, paginated. FR-018: author name/avatar denormalized
// at read time (see data-model.md's read-time join note).
export const listPage = query({
  args: {
    channelId: v.id("channels"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    await requireChannelMembership(ctx, args.channelId);
    const result = await ctx.db
      .query("messages")
      .withIndex("by_channel", (q) => q.eq("channelId", args.channelId))
      .order("desc")
      .paginate(args.paginationOpts);
    const page = await Promise.all(
      result.page.map(async (message) => {
        const author = await ctx.db.get(message.authorId);
        return {
          ...message,
          authorDisplayName: author?.displayName ?? "Unknown",
          authorAvatarUrl: author?.avatarUrl ?? "",
        };
      }),
    );
    return { ...result, page };
  },
});
