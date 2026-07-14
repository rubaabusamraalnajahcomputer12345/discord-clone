import { useState, type FormEvent } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useTypingHeartbeat } from "../../hooks/useTypingHeartbeat";

export function MessageComposer({ channelId }: { channelId: Id<"channels"> }) {
  const sendMessage = useMutation(api.messages.send);
  const notifyTyping = useTypingHeartbeat(channelId);
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = content.trim();
    if (trimmed.length === 0) return;
    setError(null);
    try {
      await sendMessage({ channelId, content: trimmed });
      setContent("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
    }
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="shrink-0 px-4 pb-4">
      {error && <p className="mb-1 text-xs text-danger">{error}</p>}
      <input
        className="w-full rounded-lg bg-surface-panel px-4 py-3 text-white placeholder:text-gray-500 outline-none"
        value={content}
        onChange={(event) => {
          setContent(event.target.value);
          notifyTyping();
        }}
        placeholder="Message #channel"
        maxLength={4000}
      />
    </form>
  );
}
