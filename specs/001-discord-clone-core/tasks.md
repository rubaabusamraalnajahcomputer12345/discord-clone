---

description: "Task list for feature implementation"
---

# Tasks: Discord Clone Core

**Input**: Design documents from `/specs/001-discord-clone-core/`

**Prerequisites**: plan.md, spec.md, data-model.md, contracts/convex-api.md, research.md, quickstart.md (all present)

**Tests**: Not requested wholesale. Two tests are included anyway because the
project constitution (Testable Seams, non-negotiable) mandates at least one
smoke test for each of the two named critical flows — send message and join
call — plus pure-function unit tests for the Testable-Seams-designated helper
files (`authz.ts`, `validators.ts`, `callState.ts`).

**Organization**: Tasks are grouped by user story (P1–P4 from spec.md) so each
story is independently implementable and testable per the Incremental
Delivery principle.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an
  incomplete task in the same phase)
- **[Story]**: Which user story this task belongs to (US1–US4)
- File paths are exact, per plan.md's Project Structure

## Path Conventions

Single repo: Convex backend functions in `convex/` at repo root; React/Vite
frontend in `src/` at repo root; tests in `tests/`. (See plan.md § Project
Structure for the full tree.)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization — no app logic yet.

- [X] T001 Initialize Vite + React 18 + TypeScript project: `package.json`, `tsconfig.json` (strict mode), `vite.config.ts`, `index.html`, placeholder `src/main.tsx`
- [X] T002 [P] Configure Tailwind CSS: `tailwind.config.ts`, PostCSS config, `src/styles/index.css` with the Discord-like dark theme tokens (server rail, sidebar, chat pane, member list color/spacing scale)
- [X] T003 [P] Configure Vitest + React Testing Library test runner (`vitest.config.ts` or Vite test block, `tests/unit/`, `tests/smoke/` directories scaffolded)
- [X] T004 Initialize Convex project (`npx convex dev` scaffolding, `convex/_generated`, `.env.local` template documented, `.gitignore` entries for `.env.local` and `convex/_generated`) — code scaffolding done; `npx convex dev` itself still needs to be run interactively by a human (requires browser login) to generate `convex/_generated` and link a deployment
- [X] T005 [P] Install React Router and scaffold the route shell in `src/App.tsx` (placeholder routes for login, server view, DM view)

**Checkpoint**: `npm run dev` boots an empty shell app; `npx convex dev` connects.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared backend/frontend infrastructure every user story depends on.

**⚠️ CRITICAL**: No user story task may start until this phase is complete.

- [X] T006 Define `convex/schema.ts`: `authTables` spread plus all app tables (`users` profile fields, `presence`, `servers`, `serverMembers`, `channels`, `messages`, `directMessageThreads`, `directMessages`, `typingIndicators`, `calls`, `callParticipants`, `signals`) with every index from data-model.md
- [X] T007 Install and wire Convex Auth: `npm install @convex-dev/auth @auth/core@0.41.1`; create `convex/auth.config.ts`, `convex/auth.ts` (password provider with `profile()` callback setting `displayName`/`avatarUrl`), `convex/http.ts`; set `convex/tsconfig.json` (`skipLibCheck`, `moduleResolution: "Bundler"`)
- [X] T008 [P] Wire `ConvexReactClient` + `ConvexAuthProvider` in `src/main.tsx` (replaces plain `ConvexProvider`)
- [X] T009 [P] Implement `convex/lib/authz.ts`: shared caller-resolution (`auth.getUserId(ctx)`, the object returned from `convexAuth()` in `convex/auth.ts` — corrected from an earlier, inaccurate research.md claim of a top-level `getAuthUserId`/`getAuthSessionId` export, which does not exist in the installed `@convex-dev/auth@0.0.54`) plus membership/ownership/participancy check helpers, reused by every function in contracts/convex-api.md
- [X] T010 [P] Implement `convex/lib/validators.ts`: display-name/server-name/channel-name length checks, message content non-empty + ≤4000-char check (FR-016a), shared by `messages.ts` and `directMessages.ts`
- [X] T011 [P] Implement `convex/lib/callState.ts`: pure functions for call-open-on-first-join, call-close-on-empty, and reject-at-4-participants transitions (FR-027) — Testable Seams, no Convex context dependency
- [X] T012 Scaffold `convex/crons.ts` with an empty `cronJobs()` registration point (individual sweep jobs added by later stories)
- [X] T013 [P] Build an auth-gated layout wrapper in `src/lib/routeGuard.tsx` using `useConvexAuth` (redirects unauthenticated users to `/login`)

**Checkpoint**: Schema deploys via `npx convex dev`; signing in/out works end-to-end with no app screens yet.

---

## Phase 3: User Story 1 - Chat in a Server (Priority: P1) 🎯 MVP

**Goal**: Sign up, create/join a server via invite link, and exchange
real-time text messages in `#general` with edit/delete/typing-indicators/
infinite scroll.

**Independent Test**: Two accounts sign up; one creates a server and shares
an invite link; the other joins; both exchange messages in `#general` and
see them appear live (spec.md Independent Test, US1).

### Implementation for User Story 1

- [X] T014 [P] [US1] `users.ts`: `updateProfile` mutation + `getCurrentUser` query in `convex/users.ts` (FR-002)
- [X] T015 [P] [US1] `presence.ts`: `heartbeat` mutation + `listForServer` query in `convex/presence.ts` (FR-003)
- [X] T016 [US1] `servers.ts`: `create` mutation (atomically inserts owner `serverMembers` row + auto-created `#general` channel) + `listForCurrentUser`/`get` queries in `convex/servers.ts` (FR-004, FR-005)
- [X] T017 [US1] `servers.ts`: `generateInvite` + `joinByInvite` mutations in `convex/servers.ts` (FR-006)
- [X] T018 [P] [US1] `serverMembers.ts`: `list` query in `convex/serverMembers.ts` (FR-007)
- [X] T019 [US1] `channels.ts`: `list` query (includes `connectedUserIds` field, populated later in US3) in `convex/channels.ts` (FR-012)
- [X] T020 [US1] `messages.ts`: `send`/`edit`/`remove` mutations + `listPage` paginated query with denormalized `authorDisplayName`/`authorAvatarUrl` in `convex/messages.ts` (FR-016, FR-016a, FR-017, FR-018, FR-019, FR-020, FR-021)
- [X] T021 [P] [US1] `typingIndicators.ts`: `ping` mutation + `listForChannel` query in `convex/typingIndicators.ts` (FR-022, channel-only per spec's FR-025 scope)
- [X] T022 [US1] Add `sweepStalePresence` + `sweepStaleTyping` scheduled mutations to `convex/crons.ts`
- [X] T023 [P] [US1] `usePresenceHeartbeat` hook in `src/hooks/usePresenceHeartbeat.ts` (calls `presence.heartbeat` on a ~10s interval while the tab is active)
- [X] T024 [P] [US1] `useTypingHeartbeat` hook in `src/hooks/useTypingHeartbeat.ts` (debounced `typingIndicators.ping` on keystroke)
- [X] T025 [US1] Signup/login page in `src/routes/LoginPage.tsx` using `useAuthActions` (FR-001)
- [X] T026 [US1] Server rail + create-server modal in `src/components/servers/ServerRail.tsx`, `src/components/servers/CreateServerModal.tsx`
- [X] T027 [US1] Invite panel + join-by-invite route in `src/components/servers/InvitePanel.tsx`, `src/routes/JoinInvitePage.tsx`
- [X] T028 [US1] Member sidebar in `src/components/members/MemberList.tsx`, `MemberItem.tsx`, `PresenceDot.tsx` (merges `serverMembers.list` + `presence.listForServer` client-side)
- [X] T029 [US1] Channel list + header in `src/components/channels/ChannelList.tsx`, `ChannelHeader.tsx` (text channels only at this point)
- [X] T030 [US1] Message list with newest-first infinite scroll in `src/components/messages/MessageList.tsx` via `usePaginatedQuery(messages.listPage)` (FR-021)
- [X] T031 [US1] Message item with edit/delete controls + "edited" marker in `src/components/messages/MessageItem.tsx` (FR-018, FR-019, FR-020)
- [X] T032 [US1] Message composer (validated, wired to typing heartbeat) + profile settings page in `src/components/messages/MessageComposer.tsx`, `src/routes/ProfileSettingsPage.tsx` (FR-002, FR-016a)
- [X] T033 [US1] Typing indicator display in `src/components/messages/TypingIndicator.tsx` using `typingIndicators.listForChannel`
- [X] T034 [P] [US1] Unit tests for `convex/lib/validators.ts` in `tests/unit/validators.test.ts` (Vitest — Testable Seams)
- [X] T035 [US1] Constitution-mandated smoke test for the send-message flow in `tests/smoke/send-message.smoke.test.tsx` (`convex-test` + RTL, exercises the real `messages.send` mutation, not a mock)

**Checkpoint**: User Story 1 fully functional and independently testable/
demoable. Per constitution Definition of Done: run `npm run typecheck`
(zero errors) and the Vitest suite (T034, T035 passing) before moving on —
main must build and run cleanly at this checkpoint, not just at the end.

---

## Phase 4: User Story 2 - Manage Server & Channels (Priority: P2)

**Goal**: Server owner renames the server, creates/renames/deletes text and
voice channels, and removes members.

**Independent Test**: As the owner of an existing server (from US1), create a
text and a voice channel, rename the server and a channel, delete a channel,
and remove a member — verify each change propagates to remaining members
immediately (spec.md Independent Test, US2).

### Implementation for User Story 2

- [X] T036 [P] [US2] `servers.ts`: `rename`, `leave` (cascading full-server delete, FR-010a), `removeMember` mutations in `convex/servers.ts` (FR-008, FR-009, FR-010)
- [X] T037 [P] [US2] `channels.ts`: `create`, `rename`, `remove` mutations (cascading message + call deletion) in `convex/channels.ts` (FR-011, FR-013, FR-014, FR-015)
- [X] T038 [US2] Server settings modal (rename, leave) in `src/components/servers/ServerSettingsModal.tsx` (FR-008)
- [X] T039 [US2] Channel settings modal (create/rename/delete, text + voice) in `src/components/channels/ChannelSettingsModal.tsx` (FR-011, FR-013, FR-014)
- [X] T040 [US2] Member removal UI + owner-only action gating in `src/components/members/MemberItem.tsx` (update), `src/components/members/MemberActions.tsx` (FR-009, FR-010, FR-015)
- [X] T041 [P] [US2] Unit tests for owner-only authorization paths in `tests/unit/authz.test.ts` (Vitest)

**Checkpoint**: User Stories 1 and 2 both work independently; a voice
channel now exists as a fixture for US3. Per constitution Definition of
Done: run `npm run typecheck` (zero errors) and the Vitest suite (T041
passing) before moving on.

---

## Phase 5: User Story 3 - Voice & Video Calls in a Channel (Priority: P3)

**Goal**: Join a voice channel's live call with working mic/camera toggles
and speaking/muted indicators, full-mesh WebRTC via Convex-relayed signaling.

**Independent Test**: Two members join the same voice channel from separate
sessions; confirm video tiles, mic/camera toggles, speaking/muted
indicators, and the channel list's connected-members display all update
live (spec.md Independent Test, US3). Then run quickstart.md Scenario 3
steps 6-7 with a 3rd and 4th participant to confirm the full-mesh topology
holds at the FR-027 cap and that a 5th join attempt is rejected — the
2-participant case alone doesn't exercise FR-027/SC-005's "up to 4" bound.

**Note**: This story needs a voice channel to exist, which requires US2's
`channels.create` (T037) — so while independently *testable*, it is not
independently *buildable* before US2.

### Implementation for User Story 3

- [X] T042 [US3] `calls.ts`: `getActiveForScope` query + `getOrCreateActiveForScope` internal mutation in `convex/calls.ts` (FR-026)
- [X] T043 [US3] `callParticipants.ts`: `join`, `leave`, `heartbeat`, `setMicCamera` mutations + `list` query in `convex/callParticipants.ts` (FR-026, FR-027, FR-028, FR-031); `leave` MUST use `callState.ts` (T011) to detect when it empties the call and, if so, set `calls.endedAt` AND delete that call's remaining `signals` rows immediately in the same mutation — not deferred to the T045 cron, per data-model.md's "immediately on call end" lifecycle note
- [X] T044 [US3] `signals.ts`: `send` mutation + `listInbox` query with `since` cursor in `convex/signals.ts`
- [X] T045 [US3] Add `sweepStaleCallParticipants` scheduled mutation to `convex/crons.ts` (grace-period cleanup, closes emptied calls, deletes remaining signals — FR-031a)
- [X] T046 [P] [US3] `RTCPeerConnection` factory + Perfect Negotiation handshake (polite/impolite roles, `makingOffer`/`ignoreOffer` glare handling, `restartIce()` on `connectionState === "failed"`) in `src/lib/webrtc/peerConnection.ts` (research.md §2a)
- [X] T047 [US3] `useCall` hook in `src/hooks/useCall.ts`: orchestrates `callParticipants.join`/`leave`/`heartbeat`, diffs `callParticipants.list` to open/close per-peer connections via T046, drives `signals.send`/`listInbox` with a locally-tracked `since` cursor
- [X] T048 [P] [US3] Local speaking detector (Web Audio `AnalyserNode` per remote track, no Convex writes) in `src/lib/webrtc/speakingDetector.ts` (FR-030)
- [X] T049 [US3] Voice channel panel, video tiles, and call controls in `src/components/calls/VoiceChannelPanel.tsx`, `VideoTile.tsx`, `CallControls.tsx` (FR-028, FR-029, FR-030, FR-031)
- [X] T050 [US3] Update `src/components/channels/ChannelList.tsx` (from US1/T029) to show connected members per voice channel via `channels.list`'s `connectedUserIds` (FR-032)
- [X] T051 [P] [US3] Unit tests for `convex/lib/callState.ts` transitions in `tests/unit/callState.test.ts` (Vitest — Testable Seams)
- [X] T052 [US3] Constitution-mandated smoke test for the join-call flow in `tests/smoke/join-call.smoke.test.tsx` (`convex-test`, exercises the real `callParticipants.join` mutation and resulting participant list, not a mock)

**Checkpoint**: User Stories 1–3 all independently functional, including the
4-participant/reject-at-5 validation above. Per constitution Definition of
Done: run `npm run typecheck` (zero errors) and the Vitest suite (T051, T052
passing) before moving on.

---

## Phase 6: User Story 4 - Direct Messages (Priority: P4)

**Goal**: Open a 1-on-1 DM with a shared-server member, with the same
real-time/edit/delete behavior as channel messages, and start a 1-on-1
video call from the DM.

**Independent Test**: Two users sharing a server open a DM, exchange/edit/
delete messages in real time, and start a video call from the DM (spec.md
Independent Test, US4).

**Note**: DM messaging (T053–T055) depends only on US1 (shared-server check
reuses `serverMembers`). DM calling (T056) depends on US3's call
infrastructure (T042–T048).

### Implementation for User Story 4

- [ ] T053 [US4] `directMessageThreads.ts`: `getOrCreate` mutation (validates the two users share ≥1 server) + `listForCurrentUser` query in `convex/directMessageThreads.ts` (FR-023)
- [ ] T054 [US4] `directMessages.ts`: `send`/`edit`/`remove` mutations + `listPage` paginated query with denormalized author fields in `convex/directMessages.ts` (FR-024, FR-025)
- [ ] T055 [US4] DM list + thread view in `src/components/dm/DmList.tsx`, `DmThreadView.tsx` (reuses `MessageList`/`MessageItem`/`MessageComposer` patterns from US1) (FR-023, FR-025)
- [ ] T056 [US4] Wire a "start call" entry point from the DM thread, reusing `callParticipants.join`/`useCall` with a thread scope, in `src/components/dm/DmThreadView.tsx` (update), `src/components/calls/CallControls.tsx` (update) (FR-033)

**Checkpoint**: All four user stories independently functional — full spec
scope delivered. Per constitution Definition of Done: run `npm run
typecheck` (zero errors) and the full Vitest suite before moving to Polish.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Constitution gates and final validation across all stories.

- [ ] T057 [P] Run the quickstart.md validation scenarios end-to-end and record results
- [ ] T058 [P] `npm run typecheck` (`tsc --noEmit`) across `src/` and `convex/` with zero errors (Type Safety End-to-End gate)
- [ ] T059 Cross-check every mutation/query in contracts/convex-api.md against its actual `convex/lib/authz.ts` usage — no function skips the shared authorization helper (Security Basics gate)
- [ ] T060 [P] Add in-UI messaging for call-connection failure (STUN-only/no-TURN limitation from plan.md Constraints) so strict-NAT failures are explained, not silent
- [ ] T061 Run the SC-009 scale check from quickstart.md's non-functional checks (several dozen concurrent sessions across a handful of servers); confirm SC-002/SC-003/SC-005 latency targets still hold under that load, not just in the 2-4-user story walkthroughs

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories.
- **US1 (Phase 3)**: Depends on Foundational only.
- **US2 (Phase 4)**: Depends on Foundational + US1 (operates on servers/channels/members US1 creates).
- **US3 (Phase 5)**: Depends on Foundational + US1; needs a voice channel, which requires US2's `channels.create` (T037) as a test fixture.
- **US4 (Phase 6)**: DM messaging (T053–T055) depends on Foundational + US1; DM calling (T056) additionally depends on US3 (T042–T048).
- **Polish (Phase 7)**: Depends on all implemented stories.

### Within Each User Story

- Backend (Convex functions) before frontend components that call them.
- Shared/base components (e.g. `ChannelList` in US1) before later stories update them in place (US3's T050).
- Story complete and checkpointed before moving to the next priority.

### Parallel Opportunities

- All Setup [P] tasks (T002, T003, T005) run together after T001.
- Foundational [P] tasks (T008–T011, T013) run together once T006/T007 land.
- Within US1: T014, T015, T018, T021, T023, T024 touch disjoint files and can run in parallel; T016→T017→T019→T020 touch shared/dependent files and run in sequence.
- Within US2: T036 and T037 touch different files and run in parallel; T041 runs in parallel with either.
- Within US3: T046 and T048 are disjoint client-side files and run in parallel with the T042→T043→T044→T045 backend sequence; T051 runs in parallel with frontend tasks.
- Within US4: T053→T054 are sequential (same-domain build-up); T055/T056 follow.

---

## Parallel Example: User Story 1

```bash
# Launch independent US1 backend tasks together:
Task: "users.ts updateProfile/getCurrentUser in convex/users.ts"
Task: "presence.ts heartbeat/listForServer in convex/presence.ts"
Task: "serverMembers.ts list in convex/serverMembers.ts"
Task: "typingIndicators.ts ping/listForChannel in convex/typingIndicators.ts"

# Launch independent US1 frontend hooks together:
Task: "usePresenceHeartbeat hook in src/hooks/usePresenceHeartbeat.ts"
Task: "useTypingHeartbeat hook in src/hooks/useTypingHeartbeat.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (blocks everything)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: run the US1 quickstart scenario independently
5. Demo: signup, server creation, invite, live chat

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. + User Story 1 → test independently → demo (MVP!)
3. + User Story 2 → test independently → demo (adds server/channel management, and a voice-channel fixture for US3)
4. + User Story 3 → test independently → demo (adds voice/video calling)
5. + User Story 4 → test independently → demo (adds DMs, including calling — reuses US3's call stack)
6. Polish → constitution gates confirmed clean

---

## Notes

- [P] tasks = different files, no dependency on an incomplete task in the same phase
- [Story] label maps each task to its user story for traceability
- The two constitution-mandated smoke tests (T035, T052) exercise real Convex mutations via `convex-test`, not mocks, per Testable Seams
- Commit after each task or logical group; verify the app still builds and runs before moving on (Incremental Delivery)
- **Every story checkpoint (end of Phase 3/4/5/6) requires a passing `npm run typecheck` and the story's Vitest tasks green** — not just the final Polish-phase typecheck (T058) — per the constitution's per-story Definition of Done
- Avoid: cross-story same-file edits without a noted dependency, vague task descriptions, skipping the authz helper in any new mutation/query
