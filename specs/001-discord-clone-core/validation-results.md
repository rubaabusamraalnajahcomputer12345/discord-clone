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

## Remaining

- **T061 (SC-009 scale check)** — not executed; requires dozens of concurrent
  authenticated sessions. See tasks.md.
