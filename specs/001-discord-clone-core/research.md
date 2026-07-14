# Phase 0 Research: Discord Clone Core

All Technical Context fields were fully specified by the user-provided
tech stack description — no unresolved `NEEDS CLARIFICATION` markers
remain. The items below record the concrete decisions and their
rationale so Phase 1 design has a settled foundation.

> **Verified against current documentation on 2026-07-14** (see §8):
> Convex Auth setup, Convex React hook APIs, and RTCPeerConnection
> negotiation patterns were re-checked against live docs since this area
> moves quickly. §2 and §5 below have been updated in place with the
> exact current package versions, file names, and API calls; §8 records
> what was checked and cites sources.

## 1. Testing framework

**Decision**: Vitest for unit tests, `convex-test` for exercising Convex
queries/mutations against a real in-memory Convex backend, and React
Testing Library for the two constitution-mandated smoke tests (send
message, join call).

**Rationale**: Vitest is the native test runner for Vite projects (shared
config/transform pipeline, no extra bundler setup). `convex-test` is
Convex's own testing package — it runs actual schema-validated
mutations/queries in-memory, which satisfies the constitution's Testable
Seams requirement that critical-flow tests "exercise the real seam, not a
mock of it." React Testing Library is added only for the two required
smoke tests, not for broad UI test coverage (Simplicity First).

**Alternatives considered**: Jest — mature but needs extra config to work
smoothly with Vite/ESM and offers no advantage here. Playwright
end-to-end — heavier setup (real browser automation, WebRTC device
mocking) that isn't justified for v1's smoke-test bar; revisit only if a
future iteration needs true cross-browser call testing.

## 2. WebRTC signaling transport

**Decision**: A `signals` Convex table holds outbound SDP offers/answers
and ICE candidates, keyed by `callId` and `toUserId`. The sending peer
inserts a row via a mutation; the receiving peer subscribes with
`useQuery` filtered to `(callId, toUserId)` and applies each new signal
to its `RTCPeerConnection` as it arrives. Consumed/stale rows are deleted
by the same cron that sweeps stale presence/typing rows.

**Rationale**: This is the mechanism the user explicitly specified to
replace a dedicated signaling server. It fits Real-Time Correctness for
free (Convex subscriptions), and keeps the whole app on one platform
(Simplicity First) instead of standing up and operating a Socket.io
process.

**Alternatives considered**: A separate WebSocket signaling server — more
infrastructure to run/deploy, and duplicates the reactive-subscription
behavior Convex already provides. A third-party WebRTC SDK (LiveKit,
Twilio Video) — explicitly rejected by the user; it would hide the
peer-connection mechanics this project is meant to demonstrate and add
an external paid dependency.

### 2a. Negotiation pattern — Perfect Negotiation (verified current, 2026-07-14)

**Decision**: Each pairwise connection in the full mesh uses the
[Perfect Negotiation](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Perfect_negotiation)
pattern, MDN's current canonical approach for two-way, either-side-can-
renegotiate WebRTC connections:

- Assign a fixed **polite**/**impolite** role per *pair* (e.g. the peer
  with the lexicographically smaller `userId` is polite) — with 4
  participants that's up to 6 pairwise roles, computed the same
  deterministic way on both ends so they always agree.
- On `onnegotiationneeded`, call `pc.setLocalDescription()`
  (parameterless form — it creates the correct offer/answer implicitly)
  and send the result through the `signals` table.
- Track a `makingOffer` flag around that call. On receiving a remote
  offer, compute `offerCollision = description.type === "offer" && (makingOffer || pc.signalingState !== "stable")`.
  - **Polite** peer on collision: proceed anyway — `setRemoteDescription()`
    implicitly rolls back its own pending offer.
  - **Impolite** peer on collision: set `ignoreOffer = true`, return
    without applying the remote description, and swallow the resulting
    `addIceCandidate` error for any candidates tied to the ignored offer.
- Queue/apply ICE candidates from `onicecandidate` via
  `pc.addIceCandidate()` as they arrive (trickle ICE); if `ignoreOffer`
  is true for the current offer, the corresponding candidate errors are
  expected and swallowed rather than surfaced.
- Monitor `pc.connectionState` (not `iceConnectionState`) via
  `connectionstatechange` to decide when a peer looks dropped — it
  aggregates ICE + DTLS state (`new/connecting/connected/disconnected/
  failed/closed`) and is the currently-recommended signal for this.
  `iceConnectionState` is watched separately only as the trigger for ICE
  restart.
- On `connectionState === "failed"` (and optionally prolonged
  `"disconnected"`), call `pc.restartIce()` — the current method for
  triggering an ICE restart (it flags the next `onnegotiationneeded`/
  `createOffer()` automatically); this replaces the older
  `pc.createOffer({ iceRestart: true })` pattern.

**Rationale**: This is still MDN's current recommended pattern (verified
2026-07-14) and directly solves the "who offers first" glare problem that
a naive offer/answer implementation hits as soon as more than 2 peers can
each independently trigger renegotiation — which is exactly the case in
this project's full mesh (each pairwise connection can be renegotiated
independently, e.g. when either side toggles camera/mic tracks).

**Alternatives considered**: A single hard-coded "caller always offers"
rule per pair — simpler, but breaks down the moment either side needs to
add/remove a media track after the initial connection (e.g. toggling
camera), which triggers `onnegotiationneeded` from whichever side changed
state; perfect negotiation handles that symmetrically without extra
bookkeeping.

**Known limitation to document in-app**: browsers now generate randomized
per-connection `.local` mDNS hostnames for ICE candidates instead of real
local IPs (privacy protection). This doesn't affect connectivity but
means local-network debugging won't show literal private IPs in SDP —
worth a one-line comment in the WebRTC helper code so it isn't mistaken
for a bug during development.

## 3. Call topology & capacity

**Decision**: Full-mesh WebRTC — every call participant opens a direct
`RTCPeerConnection` to every other participant. Hard-capped at 4
simultaneous participants (3 connections per peer at the cap).

**Rationale**: At 4 peers, full mesh's O(n²) connection count (max 6
connections total) is well within what a modern browser/laptop handles
for audio+video. Matches the user-specified acceptable topology and the
spec's clarified target scale (small, dozens of total users, ≤4 per
call).

**Alternatives considered**: An SFU (e.g. mediasoup, Janus) — would
support larger calls with lower per-client bandwidth, but requires
running and operating a separate media server, which is disproportionate
infrastructure for a 4-person cap and violates Simplicity First.

## 4. Presence & typing indicators

**Decision**: Heartbeat pattern. The client calls a lightweight mutation
roughly every 10 seconds while a tab is active to upsert its `presence`
row's `lastSeenAt`; a user is shown online while `lastSeenAt` is within a
short staleness window (e.g. ~15-20s) and offline otherwise. Typing
follows the same shape against `typingIndicators`, upserted on keystroke
(debounced) and considered stale after a few seconds of no update. A
Convex cron sweeps rows past their staleness window so queries stay cheap
and clients never need to distinguish "stale" from "absent."

**Rationale**: Convex does not expose raw socket connect/disconnect
lifecycle hooks to application code, so heartbeat + staleness is the
platform-idiomatic way to build presence — the same approach used in
Convex's own presence example patterns. It stays entirely within Convex
(no separate presence service), keeping Real-Time Correctness intact
since clients still read state via `useQuery`, not polling — the
heartbeat is a write, not the read path.

**Alternatives considered**: True connection-based presence (tracking
WebSocket open/close) — not exposed by Convex's client API, so not
available without dropping to a lower-level transport, which would
violate Simplicity First for a student project.

## 5. Authentication

**Decision**: Convex Auth with the password provider (`@convex-dev/auth`),
per the user's explicit instruction.

**Rationale**: First-party Convex integration; gives every Convex
function a typed way to resolve the caller for the Security Basics
authorization checks required by the constitution, with no custom
JWT/session code to write and maintain.

**Alternatives considered**: Hand-rolled email/password + JWT — more code
to write, test, and secure ourselves for no functional benefit over the
first-party solution.

**Exact packages/versions (verified current, 2026-07-14)**: Convex Auth is
still labeled **beta**. Install `npm install @convex-dev/auth @auth/core@0.41.1`
— `@auth/core@0.41.1` is a required peer dependency, not optional. Init
scaffolding can be generated with `npx @convex-dev/auth`.

**Backend files** (confirmed current):
- `convex/auth.config.ts` — exports `{ providers: [{ domain: process.env.CONVEX_SITE_URL, applicationID: "convex" }] }`.
- `convex/auth.ts` — `export const { auth, signIn, signOut, store } = convexAuth({ providers: [Password] })` (no `isAuthenticated` in this return value — corrected below), with `Password` imported as a **named** export from `@convex-dev/auth/providers/Password` (i.e. `import { Password } from ...`) — the package's own `.d.ts` doc-comment example shows a default import, but its actual declaration is `export declare function Password(...)`, a named export; the doc-comment is stale relative to the shipped code, confirmed by installing and typechecking against `@convex-dev/auth@0.0.54` directly.
- `convex/http.ts` — creates `httpRouter()` and calls `auth.addHttpRoutes(http)`.
- `convex/schema.ts` — still spreads `authTables` (from `@convex-dev/auth/server`) into `defineSchema({ ...authTables, ...appTables })`; this remains the current mechanism. Custom profile fields (`displayName`, `avatarUrl`) are added via the Password provider's `profile()` callback (e.g. `Password<DataModel>({ profile: (params) => ({ email: params.email, name: params.name, avatarUrl: params.avatarUrl }) })`), **not** by editing `authTables` directly.
- `convex/tsconfig.json` needs `skipLibCheck: true` and `moduleResolution: "Bundler"`.
- Dashboard/deployment env vars required: `SITE_URL`, `JWT_PRIVATE_KEY`, `JWKS`.

**Client-side** (confirmed current): `ConvexAuthProvider` (from
`@convex-dev/auth/react`) wraps the existing `ConvexReactClient` instance
in `main.tsx` and **replaces** the plain `ConvexProvider` for this
project (since we use Convex Auth). Hooks: `useAuthActions()` (from
`@convex-dev/auth/react`) for `signIn`/`signOut`, and `useConvexAuth()`
(from plain `convex/react`) for `isLoading`/`isAuthenticated`.

**Server-side identity — CORRECTED 2026-07-14 against the installed package**:
the original "verified" claim below (that `getAuthUserId(ctx)`/
`getAuthSessionId(ctx)` are top-level exports of `@convex-dev/auth/server`)
does not hold for the installed `@convex-dev/auth@0.0.54` — inspecting
`node_modules/@convex-dev/auth/dist/server/implementation.d.ts` directly
shows no such exports. The actual, confirmed-correct API: `convexAuth()`
(called once in `convex/auth.ts`) returns an `auth` object with
`auth.getUserId(ctx)` and `auth.getSessionId(ctx)` methods on it —
```ts
export const { auth, signIn, signOut, store } = convexAuth({ providers: [Password] });
```
`convex/lib/authz.ts` imports `{ auth }` from `../auth` and calls
`auth.getUserId(ctx)` directly; there is no separate top-level helper to
import. (`ctx.auth.getUserIdentity()` also still works as a lower-level
alternative, but `auth.getUserId(ctx)` is what the package's own code
comments document as the intended usage.) This is a reminder that even a
same-day "verified against docs" pass can drift from a specific installed
version — the installed `.d.ts` is more authoritative than a docs page for
pinning exact API shape.

**Gotchas** (from the `@convex-dev/auth` changelog, none blocking for this
project since it's Vite/React, not Next.js): the Next.js-specific
`convexAuthNextjsToken()`/`isAuthenticatedNextjs()` became async in a
recent release, and Next.js middleware's `createRouteMatcher` moved to a
less-expressive `path-to-regexp` version — neither applies here. One
relevant note: password-requirement validation was split out of the
`profile()` callback into a separate `validatePasswordRequirements`
option — use that if custom password rules are added later, rather than
validating inside `profile()`.

## 6. Styling & component strategy

**Decision**: Tailwind CSS utility classes only; no component library
(no Radix, shadcn/ui, MUI, etc.). Discord-like dark theme: fixed-width
server rail, channel sidebar, flexible chat pane, member list sidebar.

**Rationale**: Explicit user instruction; the UI surface (a handful of
panel types, message list, modals, video tiles) is small enough to
hand-roll without an abstraction layer, matching Simplicity First.

**Alternatives considered**: shadcn/ui — would speed up building
polished form controls/modals, but adds a dependency and generated-code
surface not named in the user's stack description; not adopted for v1.

## 7. Stale call-participant cleanup (grace period)

**Decision**: `callParticipants` rows carry a `lastHeartbeatAt` updated
alongside the same heartbeat tick used for presence while a participant
is in a call. The scheduled cleanup cron removes a participant's row if
`lastHeartbeatAt` is older than the clarified ~10-second grace period,
ending the call entirely once zero participants remain.

**Rationale**: Directly implements the clarified FR-031a behavior using
the same heartbeat + cron infrastructure already used for presence/typing
— no new mechanism required (Simplicity First).

**Alternatives considered**: Relying solely on `RTCPeerConnection`
connection-state events to detect drops client-side — useful as a UX
signal but not authoritative (a client can't be trusted to report its
own peers' state, and a fully-frozen tab won't fire events), so the
server-side heartbeat sweep remains the source of truth for "connected"
state shown to everyone else.

## 8. Documentation verification pass (2026-07-14)

Convex and WebRTC APIs move quickly enough that the decisions above were
re-checked against current official sources rather than trusted from
training data alone. Findings:

**Convex Auth setup** (§5, updated above) — confirmed current with one
addition: `@auth/core@0.41.1` is a required peer dependency not
previously listed, and `getAuthUserId(ctx)`/`getAuthSessionId(ctx)` (from
`@convex-dev/auth/server`) are the now-idiomatic way to resolve the
caller server-side, preferred over calling `ctx.auth.getUserIdentity()`
directly in `convex/lib/authz.ts`.
Sources: [Convex Auth setup](https://labs.convex.dev/auth/setup),
[manual setup](https://labs.convex.dev/auth/setup/manual),
[password provider](https://labs.convex.dev/auth/config/passwords),
[authorization](https://labs.convex.dev/auth/authz),
[Convex Auth overview](https://docs.convex.dev/auth/convex-auth),
[changelog](https://github.com/get-convex/convex-auth/blob/main/CHANGELOG.md),
[React API reference](https://labs.convex.dev/auth/api_reference/react).

**Convex React hooks** — confirmed unchanged: `useQuery`/`useMutation`
from `convex/react`, `ConvexReactClient` constructed with the deployment
URL string and passed to a provider (`ConvexAuthProvider` in our case,
per §5). For the newest-first infinite-scroll message history
(FR-021/FR-025, `messages.listPage`/`directMessages.listPage` in
contracts/convex-api.md), the concrete hook is **`usePaginatedQuery`**
(also from `convex/react`, unchanged name), used with the server-side
`paginationOptsValidator` cursor convention:
```ts
const { results, status, loadMore } = usePaginatedQuery(
  api.messages.listPage,
  { channelId },
  { initialNumItems: 30 },
);
```
`status` is one of `"LoadingFirstPage" | "CanLoadMore" | "LoadingMore" |
"Exhausted"`. This supersedes the ad-hoc `{ page, nextCursor }` return
shape sketched in the initial contract — the contract should be aligned
to Convex's standard paginated-query shape (`{ page, isDone,
continueCursor }` returned by a query built with `paginationOptsValidator`)
when contracts/convex-api.md is next touched. Cron jobs are unchanged:
`convex/crons.ts` using `cronJobs()` from `convex/server`.
Sources: [Convex React](https://docs.convex.dev/client/react),
[React API reference](https://docs.convex.dev/api/modules/react),
[Paginated Queries](https://docs.convex.dev/database/pagination),
[convex-js changelog](https://github.com/get-convex/convex-js/blob/main/CHANGELOG.md),
[Cron Jobs](https://docs.convex.dev/scheduling/cron-jobs).

**WebRTC negotiation/ICE patterns** (§2a, added above) — Perfect
Negotiation confirmed as MDN's current canonical pattern;
`pc.restartIce()` confirmed as the current ICE-restart method (superseding
`createOffer({iceRestart: true})`); `connectionState` confirmed as the
recommended signal for detecting a dropped peer over `iceConnectionState`.
Sources: [Perfect Negotiation](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Perfect_negotiation),
[restartIce()](https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/restartIce),
[connectionState](https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/connectionState),
[icecandidate event](https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/icecandidate_event),
[WebRTC protocols](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Protocols).
