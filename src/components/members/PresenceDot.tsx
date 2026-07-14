export function PresenceDot({ online }: { online: boolean }) {
  return (
    <span
      className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${
        online ? "bg-online" : "bg-offline"
      }`}
      aria-label={online ? "Online" : "Offline"}
    />
  );
}
