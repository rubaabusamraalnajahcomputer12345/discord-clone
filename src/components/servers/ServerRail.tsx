import { useState } from "react";
import { useQuery } from "convex/react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import { CreateServerModal } from "./CreateServerModal";

export function ServerRail() {
  const servers = useQuery(api.servers.listForCurrentUser);
  const { serverId: activeServerId } = useParams();
  const [showCreate, setShowCreate] = useState(false);

  return (
    <nav className="flex w-[72px] shrink-0 flex-col items-center gap-2 bg-surface-rail py-3">
      {servers?.map((server) => (
        <Link
          key={server._id}
          to={`/servers/${server._id}`}
          title={server.name}
          className={`flex h-12 w-12 items-center justify-center rounded-full bg-surface-panel text-sm font-semibold text-white transition-all hover:rounded-2xl ${
            activeServerId === server._id ? "rounded-2xl ring-2 ring-accent" : ""
          }`}
        >
          {server.name.slice(0, 2).toUpperCase()}
        </Link>
      ))}
      <button
        onClick={() => setShowCreate(true)}
        className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-panel text-2xl text-online hover:rounded-2xl"
        title="Create a server"
      >
        +
      </button>
      <Link
        to="/profile"
        title="Profile settings"
        className="mt-auto flex h-12 w-12 items-center justify-center rounded-full bg-surface-panel text-lg text-gray-300 hover:rounded-2xl hover:text-white"
      >
        ⚙
      </Link>
      {showCreate && <CreateServerModal onClose={() => setShowCreate(false)} />}
    </nav>
  );
}
