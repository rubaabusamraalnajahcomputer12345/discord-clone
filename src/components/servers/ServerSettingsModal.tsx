import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { useNavigate } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

// FR-008 (rename) + FR-010/FR-010a (leave/delete). The owner sees a rename
// field and a "Delete server" action (leave-as-owner cascades the whole
// server away); non-owners only see "Leave server".
export function ServerSettingsModal({
  serverId,
  onClose,
}: {
  serverId: Id<"servers">;
  onClose: () => void;
}) {
  const server = useQuery(api.servers.get, { serverId });
  const currentUser = useQuery(api.users.getCurrentUser);
  const renameServer = useMutation(api.servers.rename);
  const leaveServer = useMutation(api.servers.leave);
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isOwner =
    server != null && currentUser != null && server.ownerId === currentUser._id;

  useEffect(() => {
    if (server) {
      setName(server.name);
    }
  }, [server]);

  async function handleRename(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await renameServer({ serverId, name });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to rename server");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLeave() {
    const confirmMessage = isOwner
      ? "Delete this server for everyone? This permanently removes all channels and messages."
      : "Leave this server?";
    if (!window.confirm(confirmMessage)) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await leaveServer({ serverId });
      onClose();
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to leave server");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-sm rounded-md bg-surface-panel p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-semibold text-white">Server settings</h2>

        {isOwner && (
          <form onSubmit={(event) => void handleRename(event)} className="mb-6">
            <label className="mb-3 block text-sm text-gray-300">
              Server name
              <input
                className="mt-1 w-full rounded bg-surface p-2 text-white outline-none focus:ring-2 focus:ring-accent"
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoFocus
                required
              />
            </label>
            <button
              type="submit"
              disabled={submitting}
              className="rounded bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
            >
              Save name
            </button>
          </form>
        )}

        {error && <p className="mb-3 text-sm text-danger">{error}</p>}

        <div className="flex items-center justify-between border-t border-black/20 pt-4">
          <button
            type="button"
            onClick={() => void handleLeave()}
            disabled={submitting}
            className="rounded bg-danger px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {isOwner ? "Delete server" : "Leave server"}
          </button>
          <button
            type="button"
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
