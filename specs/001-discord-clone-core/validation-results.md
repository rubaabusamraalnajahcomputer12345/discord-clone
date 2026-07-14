# Quickstart Validation Results (T057)

Executed against the live `earnest-octopus-602` dev deployment + Vite dev
server, driven manually across two browser sessions (Alice / Bob).

| Scenario | Result | Notes |
|---|---|---|
| 1. Signup, server create, invite, real-time chat, typing, edit, delete (US1) | ✅ PASS | Confirms the JWT/auth fix; all real-time sync live, no refresh needed |
| 2. Server/channel management, owner-only gating, cascade delete, member removal (US2) | ✅ PASS | Non-owner correctly blocked from owner actions |
| 3. Voice & video call — join, video tiles, mic/camera toggle, speaking ring, mute icon, connected-members display, leave (US3) | ✅ PASS | Full WebRTC mesh verified live in-browser for the first time |
| 4. Direct messages — open DM, send/edit/delete, start DM call (US4) | ✅ PASS after fix | See bug below |

## Bug found & fixed during validation

**DM call controls (Leave / Mic / Camera) were unclickable.** The call
occupies a fixed-height box above the DM chat; the video-tile grid lacked
`min-h-0`, so it couldn't shrink and pushed the controls row out of its
container and underneath the message list, intercepting clicks. Fixed by
adding `min-h-0` to the grid and `shrink-0` to the controls row in
`CallStage.tsx` (also hardens the voice-channel call against short windows).

## T061 — SC-009 scale check

Ran `scripts/scaleProbe.mjs` against the live deployment: it creates 25 real
authenticated users, joins them to one server, seeds 300 messages, then samples
hot-query latency (25 runs each), including under a 20-way concurrent write
burst.

| Query | avg | p95 | max |
|---|---|---|---|
| messages.listPage (SC-002/008) | 168 ms | 214 ms | 307 ms |
| serverMembers.list (SC-003) | 180 ms | 256 ms | 260 ms |
| presence.listForServer (SC-003) | 167 ms | 202 ms | 223 ms |
| channels.list (SC-005 connected) | 157 ms | 175 ms | 187 ms |
| messages.listPage under 20-way write burst | 162 ms | 200 ms | 246 ms |

**Verdict: PASS.** At the target "dozens" scale, read latency holds around
~200 ms p95 (full cloud round-trip) and does not degrade under concurrent
writes — well within SC-002 (message delivery ~2 s), SC-003 (presence/typing),
and SC-005 (call join ~5 s).

**Honest caveat:** this measures one client's query latency against a populated
dataset plus a concurrent write burst — a strong proxy, but not dozens of
simultaneously-subscribed live browser tabs. Adequate for the small
student-project target ("dozens, not thousands"). The probe leaves ~25
timestamped test users + one server in the dev deployment (harmless).
