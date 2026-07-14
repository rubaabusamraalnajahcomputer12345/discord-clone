import { useEffect } from "react";
import { useConvexAuth, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

const HEARTBEAT_INTERVAL_MS = 10_000;

/** FR-003: keeps the caller's presence row fresh while authenticated. */
export function usePresenceHeartbeat(): void {
  const { isAuthenticated } = useConvexAuth();
  const heartbeat = useMutation(api.presence.heartbeat);

  useEffect(() => {
    if (!isAuthenticated) return;
    void heartbeat();
    const id = setInterval(() => {
      void heartbeat();
    }, HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isAuthenticated, heartbeat]);
}
