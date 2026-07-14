import { useCallback, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

const TYPING_DEBOUNCE_MS = 2_000;

/** FR-022: debounced typing-indicator heartbeat for a channel. */
export function useTypingHeartbeat(channelId: Id<"channels">): () => void {
  const ping = useMutation(api.typingIndicators.ping);
  const lastPingAtRef = useRef(0);

  return useCallback(() => {
    const now = Date.now();
    if (now - lastPingAtRef.current < TYPING_DEBOUNCE_MS) return;
    lastPingAtRef.current = now;
    void ping({ channelId });
  }, [ping, channelId]);
}
