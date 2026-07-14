import { useState, type FormEvent } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

type ChannelType = "text" | "voice";

// A single modal covering both create (FR-011) and edit (rename FR-013 /
// delete FR-014). Passing `channel` switches it into edit mode; passing
// `createType` puts it in create mode for that channel type.
export function ChannelSettingsModal(
  props: {
    serverId: Id<"servers">;
    onClose: () => void;
    onDeleted?: () => void;
  } & (
    | { createType: ChannelType; channel?: undefined }
    | {
        createType?: undefined;
        channel: { _id: Id<"channels">; name: string; type: ChannelType };
      }
  ),
) {
  const { serverId, onClose, onDeleted } = props;
  const isEdit = props.channel !== undefined;
  const channelType = isEdit ? props.channel.type : props.createType;

  const createChannel = useMutation(api.channels.create);
  const renameChannel = useMutation(api.channels.rename);
  const removeChannel = useMutation(api.channels.remove);

  const [name, setName] = useState(isEdit ? props.channel.name : "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const typeLabel = channelType === "voice" ? "voice" : "text";

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (isEdit) {
        await renameChannel({ channelId: props.channel._id, name });
      } else {
        await createChannel({ serverId, name, type: props.createType });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save channel");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!isEdit) return;
    if (
      !window.confirm(
        `Delete #${props.channel.name}? This permanently removes its messages.`,
      )
    ) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await removeChannel({ channelId: props.channel._id });
      onClose();
      onDeleted?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete channel");
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
        <h2 className="mb-4 text-lg font-semibold text-white">
          {isEdit
            ? `Edit ${typeLabel} channel`
            : `Create ${typeLabel} channel`}
        </h2>
        <label className="mb-4 block text-sm text-gray-300">
          Channel name
          <input
            className="mt-1 w-full rounded bg-surface p-2 text-white outline-none focus:ring-2 focus:ring-accent"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoFocus
            required
          />
        </label>
        {error && <p className="mb-3 text-sm text-danger">{error}</p>}
        <div className="flex items-center justify-between">
          {isEdit ? (
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={submitting}
              className="rounded bg-danger px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              Delete
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
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
              {isEdit ? "Save" : "Create"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
