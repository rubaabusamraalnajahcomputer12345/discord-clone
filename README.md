# Discord Clone

A real-time, Discord-style chat and calling app: servers with text & voice
channels, live messaging, presence & typing indicators, full-mesh WebRTC
voice/video calls (up to 4 people), and 1-on-1 direct messages with calling.

Built with **React + Vite** on the front end and **[Convex](https://convex.dev)**
as the reactive backend (database, server functions, auth, and cron jobs).
Real-time sync is powered by Convex's reactive queries — no manual websockets
or polling.

---

## Features

- **Accounts** — email/password signup & login (Convex Auth), editable
  display name and avatar.
- **Servers & channels** — create servers, share invite links, create/rename/
  delete text and voice channels (owner-only), remove members, leave (owner
  leaving cascades a full server delete).
- **Real-time chat** — send/edit/delete messages, "edited" markers, typing
  indicators, online presence, newest-first infinite scroll.
- **Voice & video calls** — join a voice channel's call, mic/camera toggles,
  local speaking indicators, muted indicators, live "who's connected"
  display. Full-mesh WebRTC (up to 4 participants) signaled through Convex.
- **Direct messages** — 1-on-1 DMs with shared-server members, same
  edit/delete behavior as channels, plus 1-on-1 video calls from a DM.

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | React 18, TypeScript (strict), Vite, React Router, Tailwind CSS |
| Backend | Convex (queries/mutations, scheduled crons) |
| Auth | `@convex-dev/auth` (password provider) |
| Realtime calls | Browser WebRTC (full mesh) + MDN Perfect Negotiation, STUN only |
| Testing | Vitest + `convex-test` (in-memory backend) |

---

## Prerequisites

- **Node.js 20 LTS** (or newer) and **npm**
- A free **[Convex account](https://dashboard.convex.dev)** — the CLI will
  prompt you to log in / create a deployment on first run (opens a browser)

---

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Provision the Convex backend

```bash
npx convex dev
```

On first run this logs you in (via browser), creates a dev deployment,
generates `convex/_generated/`, and writes `CONVEX_DEPLOYMENT` +
`VITE_CONVEX_URL` into `.env.local`. Leave it running — it hot-reloads and
redeploys backend functions as you edit them.

### 3. Set up authentication keys (one-time)

Convex Auth signs its own JWTs, so the deployment needs a key pair. The
easiest way is the auth CLI, which generates and sets `JWT_PRIVATE_KEY` +
`JWKS` on your deployment for you:

```bash
npx @convex-dev/auth
```

> **Important:** `JWT_PRIVATE_KEY` is a **deployment** environment variable
> (server-side secret) — never put it in `.env.local` or commit it. Verify
> the deployment vars with `npx convex env list`. For production, set keys on
> the prod deployment separately (`npx @convex-dev/auth --prod`).

### 4. Start the frontend

In a second terminal:

```bash
npm run dev
```

Open the printed URL (default **http://localhost:5173**). Sign up, create a
server, and you're in.

### Trying it with two users

Open a **second browser window in incognito/private mode** (a separate session
= a separate user). Sign up as a second person, join via an invite link, and
you'll see messages, presence, and calls sync live between the two windows.
For voice/video, **use headphones** to avoid mic echo; note that two tabs on
one machine may not be able to grab the same webcam simultaneously.

---

## Environment variables

`.env.local` (git-ignored) holds **client** config — see `.env.local.example`:

| Variable | Where | Purpose |
|---|---|---|
| `VITE_CONVEX_URL` | client (`.env.local`) | Convex deployment URL the browser connects to (public) |
| `CONVEX_DEPLOYMENT` | CLI (`.env.local`) | Which deployment `npx convex dev` targets |
| `JWT_PRIVATE_KEY`, `JWKS` | **deployment env** | Auth token signing/verification — set via `npx @convex-dev/auth`, never in `.env.local` |

---

## Available scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the Vite dev server |
| `npm run convex:dev` | Start the Convex backend dev loop (alias for `convex dev`) |
| `npm run build` | Type-check and build the production bundle |
| `npm run preview` | Preview the production build locally |
| `npm run typecheck` | `tsc --noEmit` across `src/` and `convex/` |
| `npm test` | Run the Vitest suite once |
| `npm run test:watch` | Run Vitest in watch mode |

Run **both** `npx convex dev` and `npm run dev` together during development.

---

## Project structure

```
convex/                    # Backend (Convex functions + schema)
  schema.ts                # All tables + indexes
  auth.ts, auth.config.ts, http.ts   # Convex Auth wiring
  users.ts, presence.ts    # Profiles & online presence
  servers.ts, serverMembers.ts, channels.ts   # Servers & channels
  messages.ts, typingIndicators.ts             # Channel chat
  directMessageThreads.ts, directMessages.ts   # DMs
  calls.ts, callParticipants.ts, signals.ts    # Calls & WebRTC signaling
  crons.ts                 # Stale-data sweeps (presence/typing/call participants)
  lib/
    authz.ts               # Shared caller-identity + authorization helpers
    validators.ts          # Pure input validators
    callState.ts           # Pure call-capacity/lifecycle logic
    scope.ts               # Channel/thread scope validator

src/                       # Frontend (React)
  main.tsx, App.tsx        # Entry + routes
  routes/                  # Page-level components (login, server, DM, profile)
  components/              # UI by domain: servers, channels, members,
                           #   messages, calls, dm
  hooks/                   # usePresenceHeartbeat, useTypingHeartbeat, useCall
  lib/webrtc/              # peerConnection (Perfect Negotiation), speakingDetector
  styles/                  # Tailwind theme

tests/
  unit/                    # Pure-function unit tests (validators, authz, callState)
  smoke/                   # End-to-end mutation smoke tests (send message, join call)

specs/                     # Spec-Kit design docs (spec, plan, data-model, contracts)
```

---

## Testing

```bash
npm test          # unit + smoke tests (convex-test in-memory backend)
npm run typecheck # zero TypeScript errors
```

The smoke tests exercise the **real** Convex mutations (not mocks) against an
in-memory backend, covering the two critical flows: sending a message and
joining a call (including the 4-participant cap).

There is also a lightweight scale probe against a live deployment:

```bash
node scripts/scaleProbe.mjs   # requires the dev deployment to be running
```

It creates ~25 authenticated users, seeds ~300 messages, and measures read
latency (including under concurrent writes).

---

## Known limitations

- **STUN only, no TURN relay.** Calls connect peer-to-peer using a public STUN
  server. On restrictive/symmetric-NAT networks a connection can fail; the UI
  surfaces this ("Connection lost") rather than failing silently. Add a TURN
  server for robust connectivity across all networks.
- **Calls are capped at 4 participants** (full-mesh topology). Larger calls
  would need an SFU.
- Typing indicators are channel-only (DMs don't have them, by design).

---

## How it works (brief)

- **Realtime:** every read is a Convex reactive query (`useQuery` /
  `usePaginatedQuery`); mutations are the only write path, and subscribed
  components update automatically — no polling.
- **Presence/typing/calls:** heartbeat mutations keep lightweight "liveness"
  rows fresh; Convex cron jobs sweep stale rows so queries stay cheap.
- **Calls:** each pair of participants opens a direct `RTCPeerConnection`.
  Offers/answers/ICE candidates are relayed through the `signals` table (Convex
  as the signaling channel). "Who's speaking" is derived locally per stream via
  the Web Audio API — no server round-trip.
- **Authorization:** every server function resolves the caller server-side and
  checks membership/ownership/participancy via `convex/lib/authz.ts` before
  touching data.

---

## License

Educational project — no license specified.
