import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Shared discriminated union for anything scoped to either a text/voice
// channel or a DM thread (calls, typing indicators use the channel-only
// half of this per FR-022/FR-025's actual scope — see data-model.md).
const channelScope = v.object({
  kind: v.literal("channel"),
  channelId: v.id("channels"),
});
const threadScope = v.object({
  kind: v.literal("thread"),
  threadId: v.id("directMessageThreads"),
});

export default defineSchema({
  ...authTables,

  // Extends Convex Auth's default `users` table (name/image/email/... are
  // the fields authTables.users already defines) with app-specific profile
  // fields required by FR-001/FR-002.
  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    displayName: v.string(),
    avatarUrl: v.string(),
  }).index("email", ["email"]),

  presence: defineTable({
    userId: v.id("users"),
    lastSeenAt: v.number(),
  }).index("by_user", ["userId"]),

  servers: defineTable({
    name: v.string(),
    imageUrl: v.optional(v.string()),
    ownerId: v.id("users"),
    inviteCode: v.string(),
    createdAt: v.number(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_inviteCode", ["inviteCode"]),

  serverMembers: defineTable({
    serverId: v.id("servers"),
    userId: v.id("users"),
    joinedAt: v.number(),
  })
    .index("by_server", ["serverId"])
    .index("by_user", ["userId"])
    .index("by_server_and_user", ["serverId", "userId"]),

  channels: defineTable({
    serverId: v.id("servers"),
    name: v.string(),
    type: v.union(v.literal("text"), v.literal("voice")),
    createdAt: v.number(),
  })
    .index("by_server", ["serverId"])
    .index("by_server_and_type", ["serverId", "type"]),

  messages: defineTable({
    channelId: v.id("channels"),
    authorId: v.id("users"),
    content: v.string(),
    editedAt: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_channel", ["channelId", "createdAt"]),

  directMessageThreads: defineTable({
    userAId: v.id("users"), // lower of the two user IDs (canonical order)
    userBId: v.id("users"), // higher of the two user IDs
    createdAt: v.number(),
  })
    .index("by_participants", ["userAId", "userBId"])
    // by_participants' `userAId` prefix already lists threads where the caller
    // is user A; this second index covers the user-B side so
    // `listForCurrentUser` can find all of a user's threads via two indexed
    // lookups instead of an unindexed scan (data-model.md listed only
    // by_participants, which is insufficient for the per-user listing query).
    .index("by_userB", ["userBId"]),

  directMessages: defineTable({
    threadId: v.id("directMessageThreads"),
    authorId: v.id("users"),
    content: v.string(),
    editedAt: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_thread", ["threadId", "createdAt"]),

  // Channel-only per FR-022; FR-025 does not extend typing indicators to
  // DMs (it cites FR-017-FR-021 only) — see data-model.md's scope note.
  typingIndicators: defineTable({
    channelId: v.id("channels"),
    userId: v.id("users"),
    updatedAt: v.number(),
  }).index("by_channel", ["channelId"]),

  calls: defineTable({
    scope: v.union(channelScope, threadScope),
    startedAt: v.number(),
    endedAt: v.optional(v.number()),
  })
    .index("by_channel", ["scope.channelId"])
    .index("by_thread", ["scope.threadId"]),

  callParticipants: defineTable({
    callId: v.id("calls"),
    userId: v.id("users"),
    joinedAt: v.number(),
    lastHeartbeatAt: v.number(),
    micOn: v.boolean(),
    cameraOn: v.boolean(),
    // No `isSpeaking` field: FR-030's speaking indicator is derived
    // entirely client-side from the already-connected WebRTC audio track
    // (see data-model.md's callParticipants note) — no Convex round-trip.
  })
    .index("by_call", ["callId"])
    .index("by_call_and_user", ["callId", "userId"]),

  signals: defineTable({
    callId: v.id("calls"),
    fromUserId: v.id("users"),
    toUserId: v.id("users"),
    type: v.union(
      v.literal("offer"),
      v.literal("answer"),
      v.literal("ice-candidate"),
    ),
    payload: v.string(),
    createdAt: v.number(),
  }).index("by_call_and_to", ["callId", "toUserId", "createdAt"]),
});
