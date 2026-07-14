import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export function TypingIndicator({ channelId }: { channelId: Id<"channels"> }) {
  const typers = useQuery(api.typingIndicators.listForChannel, { channelId });

  if (!typers || typers.length === 0) {
    return <div className="h-5 shrink-0 px-4 text-xs">&nbsp;</div>;
  }

  return (
    <div className="h-5 shrink-0 px-4 text-xs italic text-gray-400">
      {typers.length === 1 ? "Someone is typing…" : `${typers.length} people are typing…`}
    </div>
  );
}
