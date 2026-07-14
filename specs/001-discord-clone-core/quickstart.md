# Quickstart: Discord Clone Core

Validates the feature end-to-end once implemented. See
[data-model.md](./data-model.md) for schema details and
[contracts/convex-api.md](./contracts/convex-api.md) for the function
surface referenced below.

## Prerequisites

- Node.js 20 LTS, npm
- A Convex account (`npx convex dev` will prompt to log in / create a
  deployment on first run)
- Two browser sessions (or one regular + one incognito window) to act as
  two different users

## Setup

```bash
npm install
npx convex dev        # provisions/links a Convex dev deployment, generates convex/_generated
```

Copy the generated Convex deployment URL into `.env.local` (created by
`npx convex dev` if it doesn't already exist) — this file is gitignored
and never committed.

In a second terminal:

```bash
npm run dev            # starts the Vite dev server
```

## Validation Scenarios

Each scenario below maps directly to an Acceptance Scenario in
[spec.md](./spec.md); run them in order after implementation to confirm
the feature works end-to-end.

### 1. Signup, server creation, invite, real-time chat (User Story 1 — P1)

1. In browser A, sign up as "Alice" → confirm you land in the app
   authenticated, with a default avatar (FR-001, FR-002).
2. Create a server named "Study Group" → confirm a `#general` channel
   already exists and Alice is its only member (FR-004, FR-005).
3. Generate an invite link (`servers.generateInvite`) and copy it.
4. In browser B, sign up as "Bob", then open the invite link → confirm Bob
   joins "Study Group" and appears in the member sidebar as online
   (FR-006, FR-007).
5. In browser A, send a message in `#general` → confirm it appears in
   browser B within ~2 seconds with no refresh (FR-017, SC-002).
6. In browser B, start typing → confirm browser A shows a typing
   indicator that disappears when Bob stops/sends (FR-022).
7. In browser A, edit the sent message → confirm browser B shows the
   updated content marked "edited" without refreshing (FR-019, FR-020).
8. Delete the message in browser A → confirm it disappears in browser B
   in real time.
9. Seed or send at least ~300 messages in `#general` (a small script calling
   `messages.send` in a loop is fine — this is what SC-008 actually commits
   to, not just "a few dozen"), then scroll up in either browser → confirm
   older history loads incrementally without the UI becoming unresponsive
   (FR-021, SC-008).

### 2. Server & channel management (User Story 2 — P2)

1. As Alice (owner), create a new text channel and a new voice channel →
   confirm both appear immediately in Bob's channel list (FR-011,
   FR-012).
2. Rename the server and rename the new text channel → confirm Bob sees
   both new names without refreshing (FR-008, FR-013).
3. As Bob (non-owner), attempt to rename a channel or remove Alice →
   confirm both are rejected (FR-010, FR-015, SC-007).
4. As Alice, delete the new text channel → confirm it and its messages
   are gone for Bob (FR-014).
5. As Alice, remove Bob from the server → confirm Bob immediately loses
   access and disappears from the member sidebar (FR-009).

### 3. Voice & video call (User Story 3 — P3)

1. Re-invite Bob (new invite link) and have both Alice and Bob join the
   voice channel created above.
2. Confirm each sees the other's video tile (or placeholder if camera is
   off) within ~5 seconds of joining (FR-026, FR-029, SC-005).
3. Toggle mic/camera on each side → confirm the other browser reflects
   the change immediately (FR-028).
4. Speak into one browser's microphone → confirm the other shows a
   speaking indicator; mute it → confirm a muted indicator instead
   (FR-030).
5. Confirm the channel list (from either browser, outside the call view)
   shows both Alice and Bob as connected to that voice channel (FR-032).
6. **Bring in a 3rd and 4th account** ("Carol", "Dave") via new invite
   links and have both join the same voice channel → confirm all 4
   participants see/hear each other within ~5 seconds of joining, each
   sees 3 video tiles, and the channel list shows all 4 as connected
   (FR-027, SC-005 — this is the part of SC-005 the 2-person walkthrough
   above doesn't actually exercise).
7. Have a 5th account attempt to join the same voice channel → confirm
   the join is rejected/blocked once 4 participants are already connected
   (FR-027 cap enforcement).
8. Quit/kill one browser tab without clicking "leave" → confirm the other
   browsers keep that participant listed for ~10 seconds, then remove
   them (FR-031a).
9. Have all remaining participants click "leave" explicitly → confirm the
   call ends and the channel list no longer shows anyone connected
   (FR-031).

### 4. Direct messages (User Story 4 — P4)

1. As Alice, open a DM with Bob (must still share the server from
   scenario 1/2) → confirm a private conversation opens (FR-023).
2. Exchange, edit, and delete messages in the DM from both sides →
   confirm the same real-time/edit/delete behavior as channel messages
   (FR-025).
3. Start a video call from the DM → confirm it behaves like a voice
   channel call with the same controls (FR-033).
4. As a third user with no shared server with Alice, confirm no option to
   DM Alice is available (FR-023 negative case).

## Non-functional checks

- Confirm no view in the app requires a manual refresh to reflect a
  change made elsewhere (constitution: Real-Time Correctness) — this is
  implicit in every scenario above completing without a reload.
- **SC-009 (scale)**: open several dozen concurrent browser sessions
  (or a scripted loop of accounts) spread across a handful of servers —
  reasonable given the small student-project target is "dozens," not
  thousands — and confirm SC-002 (message delivery), SC-003 (presence/
  typing), and SC-005 (call join) latency targets still hold under that
  load, not just in the 2-4-user walkthroughs above.
- Confirm `npm run typecheck` (or equivalent `tsc --noEmit`) passes with
  zero errors before considering any user story done (constitution: Type
  Safety End-to-End, Incremental Delivery).
- Run the Vitest suite (`npm test`) — the send-message and join-call
  smoke tests must pass (constitution: Testable Seams).
