import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Doc } from "../../../convex/_generated/dataModel";

type MessageWithAuthor = Doc<"messages"> & {
  authorDisplayName: string;
  authorAvatarUrl: string;
};

export function MessageItem({ message }: { message: MessageWithAuthor }) {
  const currentUser = useQuery(api.users.getCurrentUser);
  const editMessage = useMutation(api.messages.edit);
  const removeMessage = useMutation(api.messages.remove);
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
            <button
              onClick={() => setIsEditing(false)}
              className="text-xs text-gray-400"
            >
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
