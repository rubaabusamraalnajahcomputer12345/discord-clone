import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../../convex/_generated/api";

export function JoinInvitePage() {
  const { inviteCode } = useParams();
  const joinByInvite = useMutation(api.servers.joinByInvite);
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!inviteCode) return;
    joinByInvite({ inviteCode })
      .then((serverId) => navigate(`/servers/${serverId}`, { replace: true }))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Invite link is invalid");
      });
  }, [inviteCode, joinByInvite, navigate]);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center text-danger">
        {error}
      </div>
    );
  }
  return (
    <div className="flex h-full items-center justify-center text-offline">
      Joining server…
    </div>
  );
}
