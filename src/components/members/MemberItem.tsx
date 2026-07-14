import { PresenceDot } from "./PresenceDot";
import { MemberActions } from "./MemberActions";

export function MemberItem({
  displayName,
  avatarUrl,
  online,
  isOwner,
  canManage = false,
  onRemove,
  onMessage,
}: {
  displayName: string;
  avatarUrl: string;
  online: boolean;
  isOwner: boolean;
  canManage?: boolean;
  onRemove?: () => Promise<void>;
  onMessage?: () => void;
}) {
  // FR-023: clicking another member opens (or reuses) a DM with them.
  const identity = (
    <>
      <img src={avatarUrl} alt="" className="h-8 w-8 shrink-0 rounded-full" />
      <span className="flex-1 truncate text-left text-sm text-gray-200">
        {displayName}
        {isOwner && <span className="ml-1 text-xs text-accent">(owner)</span>}
      </span>
    </>
  );

  return (
    <div className="group flex items-center gap-2 rounded px-2 py-1 hover:bg-surface-hover">
      {onMessage ? (
        <button
          onClick={onMessage}
          title={`Message ${displayName}`}
          className="flex min-w-0 flex-1 items-center gap-2"
        >
          {identity}
        </button>
      ) : (
        identity
      )}
      {canManage && onRemove && (
        <MemberActions displayName={displayName} onRemove={onRemove} />
      )}
      <PresenceDot online={online} />
    </div>
  );
}
