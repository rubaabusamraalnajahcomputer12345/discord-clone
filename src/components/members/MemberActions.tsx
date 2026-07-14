import { useState } from "react";

// FR-009/FR-010/FR-015: owner-only "remove member" control. Rendered by
// MemberItem only when the current user owns the server and the target is
// not the owner. Confirms before firing the removeMember mutation.
export function MemberActions({
  displayName,
  onRemove,
}: {
  displayName: string;
  onRemove: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    if (!window.confirm(`Remove ${displayName} from this server?`)) {
      return;
    }
    setBusy(true);
    try {
      await onRemove();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={() => void handleClick()}
      disabled={busy}
      title={`Remove ${displayName}`}
      className="shrink-0 text-xs text-gray-400 opacity-0 hover:text-danger group-hover:opacity-100 disabled:opacity-50"
    >
      ✕
    </button>
  );
}
