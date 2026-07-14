import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export function InvitePanel({
  serverId,
  onClose,
}: {
  serverId: Id<"servers">;
  onClose: () => void;
}) {
  const generateInvite = useMutation(api.servers.generateInvite);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setError(null);
    try {
      const result = await generateInvite({ serverId });
      setInviteCode(result.inviteCode);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get invite link");
    }
  }

  const inviteUrl = inviteCode ? `${window.location.origin}/invite/${inviteCode}` : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md rounded-md bg-surface-panel p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-semibold text-white">Invite people</h2>
        {inviteUrl === null ? (
          <button
            onClick={() => void handleGenerate()}
            className="rounded bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-hover"
          >
            Get invite link
          </button>
        ) : (
          <div className="flex gap-2">
            <input
              readOnly
              value={inviteUrl}
              className="w-full rounded bg-surface p-2 text-sm text-white"
              onFocus={(event) => event.currentTarget.select()}
            />
            <button
              onClick={() => {
                void navigator.clipboard.writeText(inviteUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="shrink-0 rounded bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-hover"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        )}
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
        <div className="mt-4 flex justify-end">
          <button
            onClick={onClose}
            className="rounded px-3 py-2 text-sm text-gray-300 hover:text-white"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
