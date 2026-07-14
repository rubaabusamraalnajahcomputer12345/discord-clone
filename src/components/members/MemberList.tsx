import { useMutation, useQuery } from "convex/react";
import { useNavigate } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { MemberItem } from "./MemberItem";

export function MemberList({ serverId }: { serverId: Id<"servers"> }) {
  const members = useQuery(api.serverMembers.list, { serverId });
  const presence = useQuery(api.presence.listForServer, { serverId });
  const currentUser = useQuery(api.users.getCurrentUser);
  const removeMember = useMutation(api.servers.removeMember);
  const openDm = useMutation(api.directMessageThreads.getOrCreate);
  const navigate = useNavigate();

  const onlineByUserId = new Map((presence ?? []).map((p) => [p.userId, p.online]));

  // The current user can manage the roster only if they are this server's
  // owner (a member row flagged isOwner whose userId matches them).
  const isCurrentUserOwner =
    currentUser != null &&
    (members ?? []).some(
      (member) => member.userId === currentUser._id && member.isOwner,
    );

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
          canManage={isCurrentUserOwner && !member.isOwner}
          onRemove={async () => {
            await removeMember({ serverId, userId: member.userId });
          }}
          onMessage={
            currentUser && member.userId !== currentUser._id
              ? async () => {
                  const threadId = await openDm({ otherUserId: member.userId });
                  navigate(`/dm/${threadId}`);
                }
              : undefined
          }
        />
      ))}
    </aside>
  );
}
