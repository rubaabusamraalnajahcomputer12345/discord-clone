// Pure functions, no Convex context — directly unit-testable (constitution:
// Testable Seams). Reused by users.ts, servers.ts, channels.ts, messages.ts,
// and directMessages.ts.

export const MAX_DISPLAY_NAME_LENGTH = 50;
export const MAX_SERVER_NAME_LENGTH = 100;
export const MAX_CHANNEL_NAME_LENGTH = 80;
export const MAX_MESSAGE_LENGTH = 4000;

function assertNonEmptyTrimmed(
  value: string,
  label: string,
  maxLength: number,
): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error(`${label} cannot be empty`);
  }
  if (trimmed.length > maxLength) {
    throw new Error(`${label} must be ${maxLength} characters or fewer`);
  }
  return trimmed;
}

export function validateDisplayName(name: string): string {
  return assertNonEmptyTrimmed(name, "Display name", MAX_DISPLAY_NAME_LENGTH);
}

export function validateServerName(name: string): string {
  return assertNonEmptyTrimmed(name, "Server name", MAX_SERVER_NAME_LENGTH);
}

export function validateChannelName(name: string): string {
  return assertNonEmptyTrimmed(name, "Channel name", MAX_CHANNEL_NAME_LENGTH);
}

/** FR-016a: reject empty/whitespace-only messages; cap length at ~4000 chars. */
export function validateMessageContent(content: string): string {
  return assertNonEmptyTrimmed(content, "Message", MAX_MESSAGE_LENGTH);
}
