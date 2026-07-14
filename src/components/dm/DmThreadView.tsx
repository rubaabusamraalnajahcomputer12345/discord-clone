import { useState, type FormEvent } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { useCall } from "../../hooks/useCall";
import { CallStage } from "../calls/CallStage";

type DmWithAuthor = Doc<"directMessages"> & {
  authorDisplayName: string;
  authorAvatarUrl: string;
};

// Mirrors MessageItem (US1) for DM messages: inline edit/delete for the author,
// "edited" marker (FR-025).
function DmMessageItem({ message }: { message: DmWithAuthor }) {
  const currentUser = useQuery(api.users.getCurrentUser);
  const editMessage = useMutation(api.directMessages.edit);
  const removeMessage = useMutation(api.directMessages.remove);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);

  const isOwn = currentUser?._id === message.authorId;

  async function handleSaveEdit() {
    await editMessage({ messageId: message._id, content: draft });
    setIsEditing(false);
  }

  return (
    <div className="group flex gap-3 rounded px-2 py-1 hover:bg-surface-hover/40">
      <img
        src={message.authorAvatarUrl}
        alt=""
        className="mt-0.5 h-9 w-9 shrink-0 rounded-full"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="font-medium text-white">{message.authorDisplayName}</span>
          <span className="text-xs text-gray-500">
            {new Date(message.createdAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          {message.editedAt !== undefined && (
            <span className="text-xs text-gray-500">(edited)</span>
          )}
        </div>
        {isEditing ? (
          <div className="flex gap-2">
            <input
              className="w-full rounded bg-surface p-1 text-sm text-white"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              autoFocus
            />
            <button onClick={() => void handleSaveEdit()} className="text-xs text-accent">
              Save
            </button>
            <button onClick={() => setIsEditing(false)} className="text-xs text-gray-400">
              Cancel
            </button>
          </div>
        ) : (
          <p className="whitespace-pre-wrap break-words text-gray-100">{message.content}</p>
        )}
      </div>
      {isOwn && !isEditing && (
        <div className="hidden shrink-0 gap-2 text-xs text-gray-400 group-hover:flex">
          <button onClick={() => setIsEditing(true)} className="hover:text-white">
            Edit
          </button>
          <button
            onClick={() => void removeMessage({ messageId: message._id })}
            className="hover:text-danger"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

export function DmThreadView({
  threadId,
}: {
  threadId: Id<"directMessageThreads">;
}) {
  const threads = useQuery(api.directMessageThreads.listForCurrentUser);
  const other = threads?.find((t) => t.threadId === threadId)?.otherUser;

  // FR-033: start a 1-on-1 call from the DM, reusing the exact call stack with
  // a thread scope instead of a channel scope.
  const [inCall, setInCall] = useState(false);
  const scope = inCall ? ({ kind: "thread", threadId } as const) : null;
  const call = useCall(scope);

  const sendMessage = useMutation(api.directMessages.send);
  const { results, status, loadMore } = usePaginatedQuery(
    api.directMessages.listPage,
    { threadId },
    { initialNumItems: 30 },
  );
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);

  const orderedOldestFirst = [...results].reverse();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = content.trim();
    if (trimmed.length === 0) return;
    setError(null);
    try {
      await sendMessage({ threadId, content: trimmed });
      setContent("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
    }
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <header className="flex h-12 shrink-0 items-center border-b border-black/20 px-4 text-white shadow-sm">
        {other && (
          <img src={other.avatarUrl} alt="" className="mr-2 h-6 w-6 rounded-full" />
        )}
        <span className="font-semibold">{other?.displayName ?? "Direct message"}</span>
        {!inCall && (
          <button
            onClick={() => setInCall(true)}
            title="Start video call"
            className="ml-auto rounded bg-surface-panel px-3 py-1 text-sm text-gray-200 hover:text-white"
          >
            📹 Start call
          </button>
        )}
      </header>

      {inCall && (
        <div className="flex h-72 shrink-0 flex-col border-b border-black/20">
          <CallStage call={call} onLeave={() => setInCall(false)} />
        </div>
      )}

      <div className="flex flex-1 flex-col-reverse overflow-y-auto px-4 py-2">
        <div>
          {orderedOldestFirst.map((message) => (
            <DmMessageItem key={message._id} message={message} />
          ))}
        </div>
        {status === "CanLoadMore" && (
          <button
            onClick={() => loadMore(30)}
            className="mx-auto mb-2 rounded bg-surface-panel px-3 py-1 text-xs text-gray-300 hover:text-white"
          >
            Load older messages
          </button>
        )}
      </div>

      <form onSubmit={(event) => void handleSubmit(event)} className="shrink-0 px-4 pb-4">
        {error && <p className="mb-1 text-xs text-danger">{error}</p>}
        <input
          className="w-full rounded-lg bg-surface-panel px-4 py-3 text-white placeholder:text-gray-500 outline-none"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder={other ? `Message ${other.displayName}` : "Message"}
          maxLength={4000}
        />
      </form>
    </div>
  );
}
