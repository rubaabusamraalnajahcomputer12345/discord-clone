import { v, type Infer } from "convex/values";

// Shared discriminated-union validator for a call/thing scoped to either a
// voice channel or a DM thread — mirrors the `scope` field in schema.ts.
// Defined once here so calls.ts, callParticipants.ts, and authz.ts all agree
// on the exact shape (channel scope = US3; thread scope = US4/FR-033).
export const scopeValidator = v.union(
  v.object({ kind: v.literal("channel"), channelId: v.id("channels") }),
  v.object({ kind: v.literal("thread"), threadId: v.id("directMessageThreads") }),
);

export type CallScope = Infer<typeof scopeValidator>;
