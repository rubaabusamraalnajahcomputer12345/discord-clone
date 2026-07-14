import { useState } from "react";
import type { Id } from "../../../convex/_generated/dataModel";
import { useCall } from "../../hooks/useCall";
import { CallStage } from "./CallStage";

// The main-pane view for a voice channel (FR-028–FR-031). Joining is explicit
// (a button) rather than on-view so the browser mic/camera prompt only fires
// when the user opts in.
export function VoiceChannelPanel({
  channelId,
  channelName,
}: {
  channelId: Id<"channels">;
  channelName: string;
}) {
  const [joined, setJoined] = useState(false);
  const scope = joined ? ({ kind: "channel", channelId } as const) : null;
  const call = useCall(scope);

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <header className="flex h-12 shrink-0 items-center border-b border-black/20 px-4 text-white shadow-sm">
        <span className="mr-2 text-gray-400">🔊</span>
        <span className="font-semibold">{channelName}</span>
      </header>

      {!joined ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-offline">
          <p className="text-lg text-gray-300">Voice channel</p>
          <button
            onClick={() => setJoined(true)}
            className="rounded-full bg-online px-6 py-2 font-medium text-white hover:opacity-90"
          >
            Join Voice
          </button>
        </div>
      ) : (
        <CallStage call={call} onLeave={() => setJoined(false)} />
      )}
    </div>
  );
}
