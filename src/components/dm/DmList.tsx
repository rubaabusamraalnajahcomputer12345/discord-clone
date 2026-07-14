import { useQuery } from "convex/react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../../convex/_generated/api";

// Sidebar of the current user's DM threads (FR-023).
export function DmList() {
  const threads = useQuery(api.directMessageThreads.listForCurrentUser);
  const { threadId: activeThreadId } = useParams();

  return (
    <nav className="flex w-60 shrink-0 flex-col overflow-y-auto bg-surface-sidebar p-3">
      <h2 className="mb-2 px-2 text-xs font-semibold uppercase text-gray-400">
        Direct messages
      </h2>
      {threads?.length === 0 && (
        <p className="px-2 text-xs text-gray-500">
          Open a DM from a member in any server you share.
        </p>
      )}
      {threads?.map((thread) => (
        <Link
          key={thread.threadId}
          to={`/dm/${thread.threadId}`}
          className={`flex items-center gap-2 truncate rounded px-2 py-1 text-sm text-gray-300 hover:bg-surface-hover hover:text-white ${
            activeThreadId === thread.threadId ? "bg-surface-hover text-white" : ""
          }`}
        >
          <img
            src={thread.otherUser.avatarUrl}
            alt=""
            className="h-8 w-8 shrink-0 rounded-full"
          />
          <span className="truncate">{thread.otherUser.displayName}</span>
        </Link>
      ))}
    </nav>
  );
}
