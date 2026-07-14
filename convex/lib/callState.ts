// Pure functions, no Convex context — directly unit-testable (constitution:
// Testable Seams). Reused by callParticipants.ts's join/leave mutations.

/** FR-027: hard cap of 4 simultaneous participants per call. */
export const MAX_CALL_PARTICIPANTS = 4;

/** Whether a new participant may join a call currently holding this many people. */
export function canJoinCall(activeParticipantCount: number): boolean {
  return activeParticipantCount < MAX_CALL_PARTICIPANTS;
}

/**
 * Whether removing one participant empties the call, given the participant
 * count *before* that removal. When true, the caller (`callParticipants.leave`,
 * or the stale-heartbeat cron) must also close the call (`calls.endedAt`) and
 * delete its remaining `signals` rows immediately — see data-model.md.
 */
export function willCallBecomeEmpty(participantCountBeforeLeaving: number): boolean {
  return participantCountBeforeLeaving <= 1;
}
