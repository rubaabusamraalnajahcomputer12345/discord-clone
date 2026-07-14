import type { Id } from "../../../convex/_generated/dataModel";
import type { UseCallResult } from "../../hooks/useCall";
import { VideoTile } from "./VideoTile";
import { CallControls } from "./CallControls";

// Presentational in-call view (tiles + controls + status), shared by the voice
// channel panel and DM calls so both reuse the exact same call stack (T056).
// All state lives in the `useCall` result passed in.
export function CallStage({
  call,
  onLeave,
}: {
  call: UseCallResult;
  onLeave: () => void;
}) {
  const streamFor = (userId: Id<"users">): MediaStream | undefined =>
    userId === call.currentUserId
      ? call.localStream ?? undefined
      : call.remoteStreams[userId as string];

  return (
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
      {call.connecting && <p className="p-3 text-sm text-offline">Connecting…</p>}
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
          onLeave={onLeave}
        />
      </div>
    </div>
  );
}
