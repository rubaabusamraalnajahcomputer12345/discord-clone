import { useState, type FormEvent } from "react";
import { useMutation } from "convex/react";
import { useNavigate } from "react-router-dom";
import { api } from "../../../convex/_generated/api";

export function CreateServerModal({ onClose }: { onClose: () => void }) {
  const createServer = useMutation(api.servers.create);
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const serverId = await createServer({ name });
      onClose();
      navigate(`/servers/${serverId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create server");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <form
        onSubmit={(event) => void handleSubmit(event)}
        className="w-full max-w-sm rounded-md bg-surface-panel p-6 shadow-lg"
      >
        <h2 className="mb-4 text-lg font-semibold text-white">Create a server</h2>
        <label className="mb-4 block text-sm text-gray-300">
          Server name
          <input
            className="mt-1 w-full rounded bg-surface p-2 text-white outline-none focus:ring-2 focus:ring-accent"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoFocus
            required
          />
        </label>
        {error && <p className="mb-3 text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded px-3 py-2 text-sm text-gray-300 hover:text-white"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
          >
            Create
          </button>
        </div>
      </form>
    </div>
  );
}
