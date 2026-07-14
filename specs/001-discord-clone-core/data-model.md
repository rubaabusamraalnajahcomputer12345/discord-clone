# Data Model: Discord Clone Core

Defined in `convex/schema.ts`. Every table lists the indexes needed for
its access patterns (Type Safety End-to-End: this schema is the single
typed source of truth — no untyped reads/writes).

## users

Extends Convex Auth's built-in `authTables.users` with app-specific
profile fields.

| Field | Type | Notes |
|---|---|---|
| `_id` | `Id<"users">` | Provided by Convex |
| `email` | `string` | Provided by Convex Auth (password provider) |
| `displayName` | `string` | FR-001, FR-002 — set at signup, editable |
| `avatarUrl` | `string` | FR-002 — defaults to a generated placeholder at signup |

**Indexes**: none beyond Convex Auth's defaults (looked up by `_id` via
`ctx.auth.getUserIdentity()`).

**Validation**: `displayName` non-empty, reasonable max length (e.g. 50
chars) — enforced in `convex/lib/validators.ts`.

## presence

| Field | Type | Notes |
|---|---|---|
| `userId` | `Id<"users">` | FR-003 |
| `lastSeenAt` | `number` (ms epoch) | Updated by heartbeat mutation |

**Indexes**: `by_user` on `userId` (upsert/lookup).

**Derived state (not stored)**: "online" = `now - lastSeenAt < ~20s`,
computed at read time in the query, not persisted — avoids a second
write path that could drift from the heartbeat.

## servers

| Field | Type | Notes |
|---|---|---|
| `name` | `string` | FR-004, FR-008 |
| `imageUrl` | `string \| undefined` | FR-004, optional |
| `ownerId` | `Id<"users">` | FR-004 — single owner, no transfer (FR-010a) |
| `inviteCode` | `string` | FR-006 — opaque unguessable token |
| `createdAt` | `number` | |

**Indexes**: `by_owner` on `ownerId`; `by_inviteCode` on `inviteCode`
(unique lookup for invite-link consumption).

**Validation**: `name` non-empty, max length (e.g. 100 chars).

**Lifecycle**: created with owner (FR-004) → renamed (FR-008) → deleted
entirely when the owner leaves or their account is deleted (FR-010a),
cascading delete of its channels, serverMembers, and messages.

## serverMembers

| Field | Type | Notes |
|---|---|---|
| `serverId` | `Id<"servers">` | |
| `userId` | `Id<"users">` | |
| `joinedAt` | `number` | |

**Indexes**: `by_server` on `serverId` (member/presence sidebar list,
FR-007); `by_user` on `userId` (which servers a user belongs to — used to
gate DM creation, FR-023); `by_server_and_user` on `(serverId, userId)`
(membership/ownership checks, removal, FR-009).

**Validation**: uniqueness of `(serverId, userId)` enforced at the
mutation layer (check-then-insert) since Convex indexes aren't unique
constraints.

## channels

| Field | Type | Notes |
|---|---|---|
| `serverId` | `Id<"servers">` | |
| `name` | `string` | FR-011, FR-013 |
| `type` | `"text" \| "voice"` | FR-011 |
| `createdAt` | `number` | |

**Indexes**: `by_server` on `serverId` (channel list, FR-012);
`by_server_and_type` on `(serverId, type)` (voice-channel list for the
connected-members display, FR-032).

**Validation**: `name` non-empty, max length (e.g. 80 chars).

**Lifecycle**: created (FR-011, `#general` auto-created per FR-005 at
server creation) → renamed (FR-013) → deleted, cascading delete of its
`messages` (and ending any active `call`) (FR-014).

## messages

| Field | Type | Notes |
|---|---|---|
| `channelId` | `Id<"channels">` | |
| `authorId` | `Id<"users">` | |
| `content` | `string` | FR-016a — non-empty, ≤4000 chars |
| `editedAt` | `number \| undefined` | FR-020 — set on edit, undefined until then |
| `createdAt` | `number` | |

**Indexes**: `by_channel` on `(channelId, createdAt)` (newest-first
paginated history, FR-021).

**Validation**: `content` trimmed non-empty and ≤4000 chars (FR-016a),
shared with `directMessages` via one validator function.

**Read-time join for FR-018**: the table itself stays normalized
(`authorId` only) — `messages.listPage` joins each row against `users`
at read time to attach `authorDisplayName`/`authorAvatarUrl` before
returning the page, matching the denormalize-on-read pattern already
used by `presence.listForServer` and `callParticipants.list`.

**Lifecycle**: created (FR-016) → optionally edited, setting `editedAt`
(FR-019, FR-020) → deleted (hard delete) by its author only (FR-019), or
cascade-deleted with its channel (FR-014).

## directMessageThreads

| Field | Type | Notes |
|---|---|---|
| `userAId` | `Id<"users">` | Lower of the two user IDs (canonical order) |
| `userBId` | `Id<"users">` | Higher of the two user IDs |
| `createdAt` | `number` | |

**Indexes**: `by_participants` on `(userAId, userBId)` (get-or-create
lookup, FR-023).

**Validation**: at creation time, confirm the two users share at least
one `serverMembers` row's `serverId` (FR-023); reject otherwise.

## directMessages

Same shape and validation as `messages`, scoped to a thread instead of a
channel.

| Field | Type | Notes |
|---|---|---|
| `threadId` | `Id<"directMessageThreads">` | |
| `authorId` | `Id<"users">` | |
| `content` | `string` | FR-016a (shared validator) |
| `editedAt` | `number \| undefined` | FR-025 |
| `createdAt` | `number` | |

**Indexes**: `by_thread` on `(threadId, createdAt)` (FR-025 — same
newest-first pagination behavior as channel messages).

## typingIndicators

| Field | Type | Notes |
|---|---|---|
| `channelId` | `Id<"channels">` | FR-022 — channel-only; FR-025 does not extend typing indicators to DMs (it cites FR-017–FR-021 only), so no thread/DM variant exists here |
| `userId` | `Id<"users">` | |
| `updatedAt` | `number` | |

**Indexes**: `by_channel` on `channelId`.

**Lifecycle**: upserted on keystroke (debounced client-side); considered
active while `updatedAt` is within a few seconds; swept by the stale-data
cron otherwise (FR-022).

> **Scope note**: an earlier draft of this table included a DM/thread
> variant. Removed — FR-022 scopes typing indicators to channels only,
> and FR-025 (DM parity with channel messaging) explicitly cites FR-017
> through FR-021, deliberately excluding FR-022. Add a thread variant
> back only if a future spec revision extends typing indicators to DMs.

## calls

| Field | Type | Notes |
|---|---|---|
| `scope` | `{ kind: "channel"; channelId: Id<"channels"> } \| { kind: "thread"; threadId: Id<"directMessageThreads"> }` | FR-026, FR-033 |
| `startedAt` | `number` | |
| `endedAt` | `number \| undefined` | undefined while active |

**Indexes**: `by_channel` on `channelId`; `by_thread` on `threadId` (both
used to find/create the active call for a given voice channel or DM,
FR-026, FR-033).

**Lifecycle**: created when the first participant joins a channel/thread
with no active call (FR-026) → ends (`endedAt` set) when its last
`callParticipants` row is removed (explicit leave, FR-031, or grace-period
expiry, FR-031a).

## callParticipants

| Field | Type | Notes |
|---|---|---|
| `callId` | `Id<"calls">` | |
| `userId` | `Id<"users">` | |
| `joinedAt` | `number` | |
| `lastHeartbeatAt` | `number` | Drives the FR-031a grace-period sweep |
| `micOn` | `boolean` | FR-028 — authoritative "muted" state (a receiver can't reliably distinguish muted from silent via audio alone, so this stays server state) |
| `cameraOn` | `boolean` | FR-028 |

**Indexes**: `by_call` on `callId` (participant list/tiles, FR-029,
FR-032); `by_call_and_user` on `(callId, userId)` (join/leave/toggle
idempotency).

> **FR-030 "speaking" indicator is intentionally NOT stored here.** In
> the full-mesh topology every participant already receives every other
> participant's raw audio track directly over their own
> `RTCPeerConnection` — "who's speaking" is derived client-side per
> remote stream via a Web Audio `AnalyserNode`, entirely locally, with no
> Convex write/read round-trip. Routing it through this table would add
> write load and latency for information the receiving peer already has
> from the media stream itself. The "muted" half of FR-030 is still
> covered by `micOn` above, since that genuinely needs to be authoritative
> shared state.

**Validation**: joining is rejected once a call's `callParticipants` count
reaches 4 (FR-027).

**Lifecycle**: created on join (FR-026) → mic/camera fields updated in
place (FR-028) → removed on explicit leave (FR-031) or
by the stale-heartbeat cron after the ~10s grace period (FR-031a); if this
removal empties the call, the parent `calls` row is closed (`endedAt`
set).

## signals

| Field | Type | Notes |
|---|---|---|
| `callId` | `Id<"calls">` | |
| `fromUserId` | `Id<"users">` | |
| `toUserId` | `Id<"users">` | |
| `type` | `"offer" \| "answer" \| "ice-candidate"` | |
| `payload` | `string` (JSON-encoded SDP or ICE candidate) | |
| `createdAt` | `number` | |

**Indexes**: `by_call_and_to` on `(callId, toUserId)` (each peer
subscribes only to signals addressed to it).

**Lifecycle**: inserted by the sending peer's client; the receiving
peer's `useQuery` subscription (via `signals.listInbox`, filtered by a
client-tracked `since` cursor — see contracts/convex-api.md) applies each
new row once, without re-processing already-applied rows on subsequent
re-fires. Rows are swept by the same cron that cleans up stale
presence/typing/call rows, and immediately on call end.

## Cross-cutting authorization rule

Every mutation/query above that reads or writes Server/Channel/Message/
DirectMessage/Call data MUST first resolve the caller's identity via
`ctx.auth.getUserIdentity()` and check the relevant `serverMembers` (or
thread-participant / call-participant) row before proceeding — implemented
once in `convex/lib/authz.ts` and reused everywhere (constitution:
Security Basics, No silent auth bypass).
