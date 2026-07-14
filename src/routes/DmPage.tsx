import { useParams } from "react-router-dom";
import type { Id } from "../../convex/_generated/dataModel";
import { ServerRail } from "../components/servers/ServerRail";
import { DmList } from "../components/dm/DmList";
import { DmThreadView } from "../components/dm/DmThreadView";

// DM home: server rail + DM thread list + the selected conversation. Mirrors
// ServerPage's shell so navigation feels consistent.
export function DmPage() {
  const params = useParams();
  const threadId = params.threadId as Id<"directMessageThreads"> | undefined;

  return (
    <div className="flex h-full">
      <ServerRail />
      <DmList />
      {threadId ? (
        <DmThreadView key={threadId} threadId={threadId} />
      ) : (
        <div className="flex min-w-0 flex-1 items-center justify-center text-offline">
          Select a conversation
        </div>
      )}
    </div>
  );
}
