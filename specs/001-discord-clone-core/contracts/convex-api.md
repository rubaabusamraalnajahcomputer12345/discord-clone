# Convex Function Contracts: Discord Clone Core

This project has no separate REST/GraphQL API — the "interface" exposed
to the frontend is the set of typed Convex queries and mutations below,
called directly from React via `useQuery`/`useMutation`. Every function
is typed end-to-end from `convex/schema.ts` (Type Safety End-to-End); every
function marked **Auth** enforces caller identity + resource authorization
via `convex/lib/authz.ts` (Security Basics) before touching data.

Conventions: queries are read-only and reactive (subscribed via
`useQuery`); mutations are the only write path. Args/returns are
illustrative TypeScript shapes, not literal code.

Paginated queries (`messages.listPage`, `directMessages.listPage`) follow
Convex's standard pagination convention (verified current — see
research.md §8): the query takes a `paginationOpts: PaginationOptions`
arg (built with `paginationOptsValidator` from `convex/server`) alongside
its other args, and returns `{ page: T[]; isDone: boolean; continueCursor: string }`.
The client calls these via `usePaginatedQuery` (from `convex/react`, not
plain `useQuery`), which manages the cursor and exposes
`{ results, status, loadMore }` — not the ad-hoc `{ page, nextCursor }`
shape used in an earlier draft of this contract.

## users.ts

| Function | Kind | Args | Returns | Auth |
|---|---|---|---|---|
| `updateProfile` | mutation | `{ displayName?: string; avatarUrl?: string }` | `void` | caller updates only their own user row |
| `getCurrentUser` | query | `{}` | `User \| null` | caller's own identity only |

## presence.ts

| Function | Kind | Args | Returns | Auth |
|---|---|---|---|---|
| `heartbeat` | mutation | `{}` | `void` | caller upserts only their own presence row |
| `listForServer` | query | `{ serverId: Id<"servers"> }` | `Array<{ userId, displayName, avatarUrl, online }>` | caller must be a member of `serverId` |

## servers.ts

| Function | Kind | Args | Returns | Auth |
|---|---|---|---|---|
| `create` | mutation | `{ name: string; imageUrl?: string }` | `Id<"servers">` | any authenticated user; creates owner membership + `#general` channel atomically |
| `rename` | mutation | `{ serverId, name: string }` | `void` | caller must be `ownerId` of `serverId` |
| `generateInvite` | mutation | `{ serverId }` | `{ inviteCode: string }` | caller must be `ownerId` |
| `joinByInvite` | mutation | `{ inviteCode: string }` | `Id<"servers">` | any authenticated user; 404-equivalent if code doesn't resolve to a server |
| `leave` | mutation | `{ serverId }` | `void` | member leaves; if caller is `ownerId`, cascades full server deletion (FR-010a) |
| `removeMember` | mutation | `{ serverId, userId }` | `void` | caller must be `ownerId`; cannot remove self via this path (use `leave`) |
| `listForCurrentUser` | query | `{}` | `Array<Server>` | caller's own memberships only |
| `get` | query | `{ serverId }` | `Server` | caller must be a member |

## serverMembers.ts

| Function | Kind | Args | Returns | Auth |
|---|---|---|---|---|
| `list` | query | `{ serverId }` | `Array<{ userId, displayName, avatarUrl, isOwner }>` | caller must be a member |

## channels.ts

| Function | Kind | Args | Returns | Auth |
|---|---|---|---|---|
| `create` | mutation | `{ serverId, name: string; type: "text" \| "voice" }` | `Id<"channels">` | caller must be `ownerId` of `serverId` |
| `rename` | mutation | `{ channelId, name: string }` | `void` | caller must be `ownerId` of the parent server |
| `remove` | mutation | `{ channelId }` | `void` | caller must be `ownerId`; cascades message + call deletion (FR-014) |
| `list` | query | `{ serverId }` | `Array<Channel & { connectedUserIds: Id<"users">[] }>` | caller must be a member; voice channels include live `callParticipants` for FR-032 |

## messages.ts

| Function | Kind | Args | Returns | Auth |
|---|---|---|---|---|
| `send` | mutation | `{ channelId, content: string }` | `Id<"messages">` | caller must be a member of the channel's server; content validated (FR-016a) |
| `edit` | mutation | `{ messageId, content: string }` | `void` | caller must be the message's `authorId` (FR-019) |
| `remove` | mutation | `{ messageId }` | `void` | caller must be the message's `authorId` |
| `listPage` | query | `{ channelId, paginationOpts: PaginationOptions }` | `{ page: Array<Message & { authorDisplayName: string; authorAvatarUrl: string }>; isDone: boolean; continueCursor: string }` | caller must be a member; newest-first, paginated via `usePaginatedQuery`; author name/avatar denormalized server-side so FR-018 needs no separate per-author lookup (FR-021) |

## directMessageThreads.ts

| Function | Kind | Args | Returns | Auth |
|---|---|---|---|---|
| `getOrCreate` | mutation | `{ otherUserId }` | `Id<"directMessageThreads">` | caller and `otherUserId` must share ≥1 server (FR-023); rejected otherwise |
| `listForCurrentUser` | query | `{}` | `Array<{ threadId, otherUser }>` | caller's own threads only |

## directMessages.ts

| Function | Kind | Args | Returns | Auth |
|---|---|---|---|---|
| `send` | mutation | `{ threadId, content: string }` | `Id<"directMessages">` | caller must be a participant of `threadId` (FR-024) |
| `edit` | mutation | `{ messageId, content: string }` | `void` | caller must be the message's `authorId` |
| `remove` | mutation | `{ messageId }` | `void` | caller must be the message's `authorId` |
| `listPage` | query | `{ threadId, paginationOpts: PaginationOptions }` | `{ page: Array<DirectMessage & { authorDisplayName: string; authorAvatarUrl: string }>; isDone: boolean; continueCursor: string }` | caller must be a participant; paginated via `usePaginatedQuery`; author name/avatar denormalized server-side, matching `messages.listPage` |

## typingIndicators.ts

Channel-only (FR-022); DMs do not have typing indicators — FR-025 cites
only FR-017–FR-021 for DM parity, not FR-022.

| Function | Kind | Args | Returns | Auth |
|---|---|---|---|---|
| `ping` | mutation | `{ channelId }` | `void` | caller must be a member of the channel's server |
| `listForChannel` | query | `{ channelId }` | `Array<{ userId }>` (excludes caller) | caller must be a member |

## calls.ts

| Function | Kind | Args | Returns | Auth |
|---|---|---|---|---|
| `getActiveForScope` | query | `{ scope: ChannelScope \| ThreadScope }` | `Call \| null` | caller must have access to the scope |

`getOrCreateActiveForScope` is **not** a client-facing function — it's an
`internalMutation` (Convex's non-public function kind) called only from
`callParticipants.join`'s server-side logic, never from React. It's
listed under crons.ts-style internal functions below instead of here,
since this doc's stated scope is the interface exposed to the frontend.

## callParticipants.ts

| Function | Kind | Args | Returns | Auth |
|---|---|---|---|---|
| `join` | mutation | `{ scope: ChannelScope \| ThreadScope }` | `Id<"calls">` | caller must have access; rejected if the call already has 4 participants (FR-027) |
| `leave` | mutation | `{ callId }` | `void` | caller removes only their own participant row (FR-031); closes the call if now empty |
| `heartbeat` | mutation | `{ callId }` | `void` | caller updates only their own `lastHeartbeatAt` (feeds FR-031a sweep) |
| `setMicCamera` | mutation | `{ callId, micOn?: boolean; cameraOn?: boolean }` | `void` | caller updates only their own row (FR-028) |
| `list` | query | `{ callId }` | `Array<CallParticipant & { displayName, avatarUrl }>` | caller must be a participant |

Note: FR-030's "speaking" indicator is deliberately **not** a Convex
function — see data-model.md's `callParticipants` note. Each client
derives it locally per remote peer via a Web Audio `AnalyserNode` on the
already-connected `RTCPeerConnection` audio track, since the raw audio is
already flowing in the full mesh. Only the "muted" half of FR-030 goes
through `setMicCamera`/`list` above.

## signals.ts

| Function | Kind | Args | Returns | Auth |
|---|---|---|---|---|
| `send` | mutation | `{ callId, toUserId, type, payload: string }` | `void` | caller must be a participant of `callId`; `toUserId` must also be a participant |
| `listInbox` | query | `{ callId, since?: number }` | `Array<Signal>` (addressed to caller, `createdAt > since`) | caller must be a participant of `callId` |

`since` is the caller's locally-tracked `createdAt` of the last signal it
applied (default `0` on first call). Without this, the query would keep
returning the full historical set of signals for the call's lifetime on
every reactive re-fire, forcing the client to re-derive which rows are
new — with a real risk of reapplying a stale "offer" against an
already-stable connection and re-triggering unwanted renegotiation. The
client updates its local `since` value to the newest row's `createdAt`
after each batch it processes.

## crons.ts (internal — not called from the client)

| Function | Kind | Purpose |
|---|---|---|
| `sweepStalePresence` | scheduled mutation | Not "offline" until read time, but this cron trims very old rows to bound table size |
| `sweepStaleTyping` | scheduled mutation | Deletes `typingIndicators` rows past their staleness window |
| `sweepStaleCallParticipants` | scheduled mutation | Removes `callParticipants` past the ~10s grace period (FR-031a); closes emptied calls; deletes that call's remaining `signals` |
| `calls.getOrCreateActiveForScope` | internal mutation | Resolves-or-creates the active `calls` row for a channel/thread scope; called only by `callParticipants.join`, never from the client |
