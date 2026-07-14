// Mic/camera toggles + leave (FR-028, FR-031). Presentational — all state and
// side effects live in useCall.
export function CallControls({
  micOn,
  cameraOn,
  onToggleMic,
  onToggleCamera,
  onLeave,
}: {
  micOn: boolean;
  cameraOn: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onLeave: () => void;
}) {
  return (
    <div className="flex items-center justify-center gap-3 py-3">
      <button
        onClick={onToggleMic}
        title={micOn ? "Mute microphone" : "Unmute microphone"}
        className={`rounded-full px-4 py-2 text-sm font-medium ${
          micOn
            ? "bg-surface-panel text-white hover:bg-surface-hover"
            : "bg-danger text-white"
        }`}
      >
        {micOn ? "🎙 Mic on" : "🔇 Mic off"}
      </button>
      <button
        onClick={onToggleCamera}
        title={cameraOn ? "Turn camera off" : "Turn camera on"}
        className={`rounded-full px-4 py-2 text-sm font-medium ${
          cameraOn
            ? "bg-surface-panel text-white hover:bg-surface-hover"
            : "bg-surface-panel text-gray-300 hover:bg-surface-hover"
        }`}
      >
        {cameraOn ? "📹 Camera on" : "📷 Camera off"}
      </button>
      <button
        onClick={onLeave}
        title="Leave call"
        className="rounded-full bg-danger px-4 py-2 text-sm font-medium text-white hover:opacity-90"
      >
        Leave
      </button>
    </div>
  );
}
