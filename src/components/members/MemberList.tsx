import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { MemberItem } from "./MemberItem";

export function MemberList({ serverId }: { serverId: Id<"servers"> }) {
  const members = useQuery(api.serverMembers.list, { serverId });
  const presence = useQuery(api.presence.listForServer, { serverId });

  const onlineByUserId = new Map((presence ?? []).map((p) => [p.userId, p.online]));

  return (
    <aside className="w-60 shrink-0 overflow-y-auto bg-surface-sidebar p-3">
      <h2 className="mb-2 px-2 text-xs font-semibold uppercase text-gray-400">
        Members — {members?.length ?? 0}
      </h2>
      {members?.map((member) => (
        <MemberItem
          key={member.userId}
          displayName={member.displayName}
          avatarUrl={member.avatarUrl}
          isOwner={member.isOwner}
          online={onlineByUserId.get(member.userId) ?? false}
        />
      ))}
    </aside>
  );
}
