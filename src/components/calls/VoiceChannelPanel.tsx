import { useState } from "react";
import type { Id } from "../../../convex/_generated/dataModel";
import { useCall } from "../../hooks/useCall";
import { VideoTile } from "./VideoTile";
import { CallControls } from "./CallControls";

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

  const streamFor = (userId: Id<"users">): MediaStream | undefined =>
    userId === call.currentUserId
      ? call.localStream ?? undefined
      : call.remoteStreams[userId as string];

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
        <div className="flex flex-1 flex-col">
          {call.error && (
            <div className="m-3 rounded bg-danger/20 px-3 py-2 text-sm text-danger">
              {call.error}
              <p className="mt-1 text-xs text-gray-400">
                Calls use STUN only (no TURN relay), so connections can fail on
                strict/symmetric NAT networks.
              </p>
            </div>
          )}
          {call.connecting && (
            <p className="p-3 text-sm text-offline">Connecting…</p>
          )}
          <div className="grid flex-1 auto-rows-min grid-cols-2 gap-3 overflow-y-auto p-3">
            {call.participants.map((participant) => {
              const isLocal = participant.userId === call.currentUserId;
              return (
                <VideoTile
                  key={participant.userId}
                  displayName={participant.displayName}
                  avatarUrl={participant.avatarUrl}
                  stream={streamFor(participant.userId)}
                  micOn={isLocal ? call.micOn : participant.micOn}
                  cameraOn={isLocal ? call.cameraOn : participant.cameraOn}
                  isLocal={isLocal}
                />
              );
            })}
          </div>
          <div className="border-t border-black/20">
            <CallControls
              micOn={call.micOn}
              cameraOn={call.cameraOn}
              onToggleMic={call.toggleMic}
              onToggleCamera={call.toggleCamera}
              onLeave={() => setJoined(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
