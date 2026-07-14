import { usePaginatedQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { MessageItem } from "./MessageItem";

export function MessageList({ channelId }: { channelId: Id<"channels"> }) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.messages.listPage,
    { channelId },
    { initialNumItems: 30 },
  );

  // `results` comes back newest-first (server-side `order("desc")`);
  // reverse for rendering so the newest message lands at the bottom.
  const orderedOldestFirst = [...results].reverse();

  return (
    <div className="flex flex-1 flex-col-reverse overflow-y-auto px-4 py-2">
      <div>
        {orderedOldestFirst.map((message) => (
          <MessageItem key={message._id} message={message} />
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
  );
}
