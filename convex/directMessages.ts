import { mutation, query } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { requireThreadParticipant, requireUserId } from "./lib/authz";
import { validateMessageContent } from "./lib/validators";

// FR-024/FR-025: DM messaging mirrors channel messaging (messages.ts), scoped
// to a thread and gated on thread participancy instead of server membership.
export const send = mutation({
  args: { threadId: v.id("directMessageThreads"), content: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireThreadParticipant(ctx, args.threadId);
    const content = validateMessageContent(args.content);
    return await ctx.db.insert("directMessages", {
      threadId: args.threadId,
      authorId: userId,
      content,
      createdAt: Date.now(),
    });
  },
});

export const edit = mutation({
  args: { messageId: v.id("directMessages"), content: v.string() },
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
  args: { messageId: v.id("directMessages") },
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

// FR-025: newest-first, paginated, author name/avatar denormalized at read
// time — same shape/behavior as messages.listPage.
export const listPage = query({
  args: {
    threadId: v.id("directMessageThreads"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    await requireThreadParticipant(ctx, args.threadId);
    const result = await ctx.db
      .query("directMessages")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
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
