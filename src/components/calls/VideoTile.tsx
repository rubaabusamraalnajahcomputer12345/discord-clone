import { useEffect, useRef, useState } from "react";
import { createSpeakingDetector } from "../../lib/webrtc/speakingDetector";

// One participant's tile: live video when their camera is on, otherwise an
// avatar. A green ring reflects the locally-derived speaking state (FR-030);
// a muted icon reflects the authoritative mic state (FR-028/FR-030).
export function VideoTile({
  displayName,
  avatarUrl,
  stream,
  micOn,
  cameraOn,
  isLocal,
  connectionState,
}: {
  displayName: string;
  avatarUrl: string;
  stream: MediaStream | undefined;
  micOn: boolean;
  cameraOn: boolean;
  isLocal: boolean;
  connectionState?: RTCPeerConnectionState;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream ?? null;
    }
  }, [stream]);

  // Derive "speaking" locally from the stream's audio — no Convex round-trip.
  // Skip when muted (a muted local track produces no audio anyway).
  useEffect(() => {
    if (!stream || !micOn || stream.getAudioTracks().length === 0) {
      setSpeaking(false);
      return;
    }
    const detector = createSpeakingDetector(stream, setSpeaking);
    return () => detector.stop();
  }, [stream, micOn]);

  const showVideo = cameraOn && stream != null && stream.getVideoTracks().length > 0;

  // T060: a remote peer stuck in failed/disconnected almost always means the
  // STUN-only setup couldn't punch through NAT (no TURN relay is provisioned).
  // Surface it on the tile instead of leaving a silently frozen/blank video.
  const failed =
    connectionState === "failed" || connectionState === "disconnected";

  return (
    <div
      className={`relative flex aspect-video items-center justify-center overflow-hidden rounded-lg bg-black/60 ${
        speaking ? "ring-2 ring-online" : "ring-1 ring-black/40"
      }`}
    >
      {showVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className="h-full w-full object-cover"
        />
      ) : (
        <img src={avatarUrl} alt="" className="h-16 w-16 rounded-full" />
      )}
      {failed && !isLocal && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/70 px-3 text-center">
          <span className="text-sm font-medium text-danger">
            Connection lost
          </span>
          <span className="text-xs text-gray-300">
            Reconnecting… this can fail on restrictive networks (STUN-only, no
            TURN relay).
          </span>
        </div>
      )}
      <div className="absolute bottom-1 left-1 flex items-center gap-1 rounded bg-black/60 px-2 py-0.5 text-xs text-white">
        {!micOn && <span title="Muted">🔇</span>}
        <span className="truncate">
          {displayName}
          {isLocal && " (you)"}
        </span>
      </div>
    </div>
  );
}
