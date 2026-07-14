import { useState } from "react";
import { useQuery } from "convex/react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { InvitePanel } from "../servers/InvitePanel";
import { ServerSettingsModal } from "../servers/ServerSettingsModal";
import { ChannelSettingsModal } from "./ChannelSettingsModal";

type ChannelType = "text" | "voice";
type EditableChannel = { _id: Id<"channels">; name: string; type: ChannelType };

export function ChannelList({ serverId }: { serverId: Id<"servers"> }) {
  const channels = useQuery(api.channels.list, { serverId });
  const server = useQuery(api.servers.get, { serverId });
  const currentUser = useQuery(api.users.getCurrentUser);
  const members = useQuery(api.serverMembers.list, { serverId });
  const { channelId: activeChannelId } = useParams();
  const navigate = useNavigate();

  const nameByUserId = new Map(
    (members ?? []).map((member) => [member.userId, member.displayName]),
  );

  const [showInvite, setShowInvite] = useState(false);
  const [showServerSettings, setShowServerSettings] = useState(false);
  const [createType, setCreateType] = useState<ChannelType | null>(null);
  const [editChannel, setEditChannel] = useState<EditableChannel | null>(null);

  const isOwner =
    server != null && currentUser != null && server.ownerId === currentUser._id;

  const textChannels = channels?.filter((channel) => channel.type === "text") ?? [];
  const voiceChannels = channels?.filter((channel) => channel.type === "voice") ?? [];

  return (
    <nav className="flex w-60 shrink-0 flex-col overflow-y-auto bg-surface-sidebar p-3">
      <div className="mb-3 flex items-center justify-between">
        <span className="truncate font-semibold text-white">{server?.name ?? ""}</span>
        <button
          onClick={() => setShowServerSettings(true)}
          title="Server settings"
          className="shrink-0 rounded px-2 py-1 text-gray-400 hover:text-white"
        >
          ⚙
        </button>
      </div>

      <button
        onClick={() => setShowInvite(true)}
        className="mb-3 rounded bg-surface-panel px-2 py-2 text-left text-sm text-gray-200 hover:text-white"
      >
        Invite people
      </button>

      <ChannelSectionHeader
        label="Text channels"
        canCreate={isOwner}
        onCreate={() => setCreateType("text")}
      />
      {textChannels.map((channel) => (
        <ChannelRow
          key={channel._id}
          to={`/servers/${serverId}/channels/${channel._id}`}
          prefix="#"
          name={channel.name}
          active={activeChannelId === channel._id}
          canManage={isOwner}
          onManage={() =>
            setEditChannel({ _id: channel._id, name: channel.name, type: "text" })
          }
        />
      ))}

      <ChannelSectionHeader
        label="Voice channels"
        canCreate={isOwner}
        onCreate={() => setCreateType("voice")}
      />
      {voiceChannels.map((channel) => (
        <div key={channel._id}>
          <ChannelRow
            to={`/servers/${serverId}/channels/${channel._id}`}
            prefix="🔊"
            name={channel.name}
            active={activeChannelId === channel._id}
            canManage={isOwner}
            onManage={() =>
              setEditChannel({ _id: channel._id, name: channel.name, type: "voice" })
            }
          />
          {/* FR-032: who's currently connected to this voice channel's call. */}
          {channel.connectedUserIds.length > 0 && (
            <ul className="mb-1 ml-6 space-y-0.5">
              {channel.connectedUserIds.map((userId) => (
                <li key={userId} className="truncate text-xs text-gray-400">
                  <span className="mr-1 text-online">●</span>
                  {nameByUserId.get(userId) ?? "Someone"}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}

      {showInvite && (
        <InvitePanel serverId={serverId} onClose={() => setShowInvite(false)} />
      )}
      {showServerSettings && (
        <ServerSettingsModal
          serverId={serverId}
          onClose={() => setShowServerSettings(false)}
        />
      )}
      {createType && (
        <ChannelSettingsModal
          serverId={serverId}
          createType={createType}
          onClose={() => setCreateType(null)}
        />
      )}
      {editChannel && (
        <ChannelSettingsModal
          serverId={serverId}
          channel={editChannel}
          onClose={() => setEditChannel(null)}
          onDeleted={() => navigate(`/servers/${serverId}`)}
        />
      )}
    </nav>
  );
}

function ChannelSectionHeader({
  label,
  canCreate,
  onCreate,
}: {
  label: string;
  canCreate: boolean;
  onCreate: () => void;
}) {
  return (
    <div className="mb-2 mt-2 flex items-center justify-between px-2">
      <h2 className="text-xs font-semibold uppercase text-gray-400">{label}</h2>
      {canCreate && (
        <button
          onClick={onCreate}
          title={`Create ${label.toLowerCase().replace(" channels", "")} channel`}
          className="text-gray-400 hover:text-white"
        >
          +
        </button>
      )}
    </div>
  );
}

function ChannelRow({
  to,
  prefix,
  name,
  active,
  canManage,
  onManage,
}: {
  to?: string;
  prefix: string;
  name: string;
  active: boolean;
  canManage: boolean;
  onManage: () => void;
}) {
  const label = (
    <span className="flex-1 truncate">
      <span className="mr-1 text-gray-400">{prefix}</span>
      {name}
    </span>
  );
  return (
    <div
      className={`group flex items-center gap-1 rounded px-2 py-1 text-sm text-gray-300 hover:bg-surface-hover hover:text-white ${
        active ? "bg-surface-hover text-white" : ""
      }`}
    >
      {to ? (
        <Link to={to} className="flex min-w-0 flex-1 items-center">
          {label}
        </Link>
      ) : (
        label
      )}
      {canManage && (
        <button
          onClick={onManage}
          title="Edit channel"
          className="shrink-0 text-gray-400 opacity-0 hover:text-white group-hover:opacity-100"
        >
          ⚙
        </button>
      )}
    </div>
  );
}
