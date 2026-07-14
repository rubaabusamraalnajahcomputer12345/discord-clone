import { useState } from "react";
import { useQuery } from "convex/react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { InvitePanel } from "../servers/InvitePanel";

export function ChannelList({ serverId }: { serverId: Id<"servers"> }) {
  const channels = useQuery(api.channels.list, { serverId });
  const { channelId: activeChannelId } = useParams();
  const [showInvite, setShowInvite] = useState(false);

  // Text channels only for now — voice channel create/join UI lands in
  // US2/US3; connectedUserIds display (FR-032) lands in US3 (T050).
  const textChannels = channels?.filter((channel) => channel.type === "text") ?? [];

  return (
    <nav className="flex w-60 shrink-0 flex-col overflow-y-auto bg-surface-sidebar p-3">
      <button
        onClick={() => setShowInvite(true)}
        className="mb-3 rounded bg-surface-panel px-2 py-2 text-left text-sm text-gray-200 hover:text-white"
      >
        Invite people
      </button>
      <h2 className="mb-2 px-2 text-xs font-semibold uppercase text-gray-400">
        Text channels
      </h2>
      {textChannels.map((channel) => (
        <Link
          key={channel._id}
          to={`/servers/${serverId}/channels/${channel._id}`}
          className={`block truncate rounded px-2 py-1 text-sm text-gray-300 hover:bg-surface-hover hover:text-white ${
            activeChannelId === channel._id ? "bg-surface-hover text-white" : ""
          }`}
        >
          # {channel.name}
        </Link>
      ))}
      {showInvite && (
        <InvitePanel serverId={serverId} onClose={() => setShowInvite(false)} />
      )}
    </nav>
  );
}
