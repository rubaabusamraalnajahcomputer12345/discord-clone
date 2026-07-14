import { describe, expect, it } from "vitest";
import {
  MAX_MESSAGE_LENGTH,
  validateChannelName,
  validateDisplayName,
  validateMessageContent,
  validateServerName,
} from "../../convex/lib/validators";

describe("validators", () => {
  it("trims and accepts valid display names", () => {
    expect(validateDisplayName("  Alice  ")).toBe("Alice");
  });

  it("rejects empty or whitespace-only display names", () => {
    expect(() => validateDisplayName("   ")).toThrow();
  });

  it("rejects overly long server names", () => {
    expect(() => validateServerName("a".repeat(101))).toThrow();
  });

  it("accepts channel names at the boundary", () => {
    expect(validateChannelName("a".repeat(80))).toHaveLength(80);
  });

  it("rejects channel names past the boundary", () => {
    expect(() => validateChannelName("a".repeat(81))).toThrow();
  });

  // FR-016a
  it("rejects empty or whitespace-only messages", () => {
    expect(() => validateMessageContent("")).toThrow();
    expect(() => validateMessageContent("   \n\t ")).toThrow();
  });

  it("rejects messages over the 4000-character cap", () => {
    expect(() => validateMessageContent("a".repeat(MAX_MESSAGE_LENGTH + 1))).toThrow();
  });

  it("accepts messages at the 4000-character cap", () => {
    expect(validateMessageContent("a".repeat(MAX_MESSAGE_LENGTH))).toHaveLength(
      MAX_MESSAGE_LENGTH,
    );
  });
});
