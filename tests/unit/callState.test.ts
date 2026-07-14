import { describe, expect, it } from "vitest";
import {
  MAX_CALL_PARTICIPANTS,
  canJoinCall,
  willCallBecomeEmpty,
} from "../../convex/lib/callState";

describe("callState (Testable Seams)", () => {
  // FR-027: hard cap of 4 simultaneous participants.
  it("allows joining below the cap", () => {
    expect(canJoinCall(0)).toBe(true);
    expect(canJoinCall(MAX_CALL_PARTICIPANTS - 1)).toBe(true);
  });

  it("rejects joining at or above the cap", () => {
    expect(canJoinCall(MAX_CALL_PARTICIPANTS)).toBe(false);
    expect(canJoinCall(MAX_CALL_PARTICIPANTS + 1)).toBe(false);
  });

  // FR-031/FR-031a: the last participant leaving empties (and closes) the call.
  it("treats a call with one participant as emptying on leave", () => {
    expect(willCallBecomeEmpty(1)).toBe(true);
  });

  it("does not treat a multi-participant call as emptying on one leave", () => {
    expect(willCallBecomeEmpty(2)).toBe(false);
    expect(willCallBecomeEmpty(MAX_CALL_PARTICIPANTS)).toBe(false);
  });

  // Defensive: a 0 count (already empty) should still report empty.
  it("reports empty for a zero count", () => {
    expect(willCallBecomeEmpty(0)).toBe(true);
  });
});
