# Implementation Plan: Discord Clone Core

**Branch**: `001-discord-clone-core` | **Date**: 2026-07-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-discord-clone-core/spec.md`

## Summary

A real-time chat and video-calling app modeled on Discord: users sign up,
create/join servers via invite link, chat in real time in text channels and
DMs (with edit/delete/typing indicators/infinite scroll), and join
voice/video calls (2-4 participants) in voice channels or 1-on-1 from a DM.

Technical approach: a single-repo React 18 + TypeScript + Vite frontend
styled with Tailwind (Discord-like dark theme, no component library),
backed entirely by Convex — Convex queries give the UI its real-time
subscriptions (no polling), Convex mutations handle all writes, and Convex
Auth (password provider) handles signup/login. Presence and typing
indicators are heartbeat-driven Convex tables cleaned up when stale. Voice
and video calls use native `RTCPeerConnection` in a full-mesh topology
(fine for up to 4 peers), with Google's public STUN servers and no TURN
server in v1; SDP/ICE signaling is exchanged by writing to a Convex
`signals` table and subscribing via `useQuery`, replacing a dedicated
signaling server (e.g. Socket.io).

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode), Node.js 20 LTS for
tooling/Convex dev runtime

**Primary Dependencies**: React 18, Vite, React Router, Tailwind CSS,
Convex (`convex` client/server SDK), `@convex-dev/auth` (Convex Auth,
password provider), native browser `RTCPeerConnection`/`MediaStream` APIs
(no WebRTC SDK)

**Storage**: Convex (document database + backend functions as a single
managed platform) — no separate database or ORM

**Testing**: Vitest (unit tests for pure logic — validators, permission
helpers, formatting) + `convex-test` (runs Convex queries/mutations against
a real in-memory Convex backend, not mocks) + React Testing Library (smoke
tests for the two constitution-mandated critical flows: send message, join
call)

**Target Platform**: Modern desktop web browsers (Chrome/Edge/Firefox/
Safari, current versions) with WebRTC support; mobile browsers are
best-effort only (mobile apps explicitly out of scope)

**Project Type**: Web application — single repo, Vite frontend at the
root with a `convex/` backend-functions directory (Convex's standard
layout, not a separate deployable service)

**Performance Goals**: Message delivery to an already-open view in <2s
(SC-002); presence/typing reflected within 5s (SC-003); joining an
in-progress call and seeing/hearing all participants within 5s (SC-005)

**Constraints**: WebRTC uses STUN only (`stun:stun.l.google.com:19302`),
no TURN server in v1 — calls between peers on strict/symmetric NAT
networks may fail to connect; full-mesh call topology hard-capped at 4
simultaneous participants (FR-027); message content capped at ~4000
characters, empty/whitespace-only rejected (FR-016a)

**Scale/Scope**: Small, single-class-project scale — dozens of concurrent
users total across a handful of servers, up to 4 participants per call
(SC-009); 4 user stories, 33 core functional requirements plus 3
clarification-driven additions (FR-010a, FR-016a, FR-031a)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment |
|---|---|
| I. Simplicity First | **Pass.** Stack is deliberately minimal: one BaaS (Convex) instead of a separate DB+API+WS server; no component library; native WebRTC instead of an SDK (LiveKit/Twilio explicitly rejected); signaling reuses Convex instead of standing up Socket.io. Every dependency below is named here, satisfying "no libraries beyond those in the plan." |
| II. Real-Time Correctness | **Pass.** All live data (messages, presence, typing, channel membership, call participants, signaling) is read via Convex `useQuery`, which is subscription-based by construction — there is no polling path available even by accident. |
| III. Type Safety End-to-End | **Pass.** TypeScript strict mode across `src/` and `convex/`; Convex schema (`convex/schema.ts`) is the single typed source of truth for all data access — Convex generates types from it, so there is no untyped query/mutation boundary. |
| IV. Security Basics | **Pass, with design obligation.** Every Convex mutation/query that touches a Server, Channel, Message, DM, or Call MUST call a shared authorization helper (`convex/lib/authz.ts`) that checks `ctx.auth.getUserIdentity()` plus the caller's `serverMembers`/ownership/participancy row before reading or writing. This is a Phase 1 design requirement, tracked in data-model.md and the contracts. |
| V. Incremental Delivery | **Pass.** Project structure and task decomposition (Phase 2) follow the spec's existing P1→P4 user-story priorities; each story is independently demoable per the spec's Independent Test sections. |
| VI. Testable Seams | **Pass, with design obligation.** Permission checks, message/name validators, and call-state transitions are plain functions in `convex/lib/` and `src/lib/`, callable from Vitest without a browser. `convex-test` exercises real mutations/queries (not mocks) for the send-message and join-call smoke tests specifically required by the constitution. |

No violations requiring justification — Complexity Tracking table is
intentionally left empty.

**Post-Phase 1 re-check**: data-model.md centralizes authorization
expectations in a single cross-cutting rule (`convex/lib/authz.ts`,
reused by every function in contracts/convex-api.md) rather than
duplicating checks per function, satisfying both Security Basics and the
Development Constraints' "No silent auth bypass" rule. The heartbeat/cron
pattern used for presence, typing, and call-participant staleness
(research.md §4, §7) is one shared mechanism reused three times, not
three bespoke ones — consistent with Simplicity First. No new violations
introduced during design; Complexity Tracking remains empty.

## Project Structure

### Documentation (this feature)

```text
specs/001-discord-clone-core/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   └── convex-api.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
discord-clone/
├── convex/
│   ├── schema.ts                 # All tables + indexes (single source of truth)
│   ├── auth.ts                   # Convex Auth config (password provider)
│   ├── auth.config.ts
│   ├── lib/
│   │   ├── authz.ts              # Shared auth/authorization helpers (Security Basics)
│   │   ├── validators.ts         # Message length/empty checks, name checks (Testable Seams)
│   │   └── callState.ts          # Pure call-state transition logic (open/close/capacity), Testable Seams
│   ├── users.ts                  # profile update, presence read helpers
│   ├── servers.ts                # create, rename, leave, invite-link generate/consume
│   ├── serverMembers.ts          # list members, remove member
│   ├── channels.ts                # create, rename, delete (text + voice)
│   ├── messages.ts                # send, edit, delete, paginated list (channel)
│   ├── directMessageThreads.ts   # get-or-create thread between two users
│   ├── directMessages.ts         # send, edit, delete, paginated list (DM)
│   ├── typingIndicators.ts       # upsert heartbeat, stale-cleanup query/cron
│   ├── presence.ts               # upsert heartbeat, stale-cleanup query/cron
│   ├── calls.ts                  # start/end call for a channel or DM thread
│   ├── callParticipants.ts       # join, leave, toggle mic/camera, heartbeat, stale-cleanup
│   ├── signals.ts                # write/read WebRTC offer/answer/ICE signaling rows
│   └── crons.ts                  # scheduled cleanup of stale presence/typing/call rows
├── src/
│   ├── main.tsx
│   ├── App.tsx                    # React Router route tree
│   ├── routes/                    # top-level route components (login, server, dm)
│   ├── components/
│   │   ├── servers/                # ServerRail, ServerSidebar, CreateServerModal, InvitePanel
│   │   ├── channels/                # ChannelList, ChannelHeader, ChannelSettingsModal
│   │   ├── messages/                # MessageList, MessageItem, MessageComposer, TypingIndicator
│   │   ├── members/                 # MemberList, MemberItem, PresenceDot
│   │   ├── calls/                    # VoiceChannelPanel, VideoTile, CallControls
│   │   ├── dm/                      # DmList, DmThreadView
│   │   └── ui/                      # Avatar, Button, Modal — small shared primitives only
│   ├── hooks/                       # usePresenceHeartbeat, useTypingHeartbeat, useCall (WebRTC)
│   ├── lib/                          # peerConnection helpers, formatting, route guards
│   └── styles/                      # Tailwind entry (index.css)
├── tests/
│   ├── unit/                        # validators, authz helpers, call-state transitions
│   └── smoke/                       # send-message.smoke.test.tsx, join-call.smoke.test.tsx
├── index.html
├── package.json
├── tailwind.config.ts
├── vite.config.ts
├── tsconfig.json
├── .env.local                       # Convex deployment URL, auth secrets (never committed)
└── .gitignore
```

**Structure Decision**: Single repo, single deployable frontend. Convex
functions live in `convex/` at the repo root (Convex's required
convention), the Vite/React app lives in `src/` at the repo root — no
separate `backend/`/`frontend/` split is needed because Convex is not a
service you author endpoints for in the traditional sense; it *is* the
backend runtime. `convex/lib/` holds the shared, unit-testable
authorization and validation logic required by Security Basics and
Testable Seams.

## Complexity Tracking

> No Constitution Check violations — this table is intentionally empty.
