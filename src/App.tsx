import { Routes, Route } from "react-router-dom";
import { RouteGuard } from "./lib/routeGuard";
import { LoginPage } from "./routes/LoginPage";
import { JoinInvitePage } from "./routes/JoinInvitePage";
import { ProfileSettingsPage } from "./routes/ProfileSettingsPage";
import { ServerPage } from "./routes/ServerPage";
import { usePresenceHeartbeat } from "./hooks/usePresenceHeartbeat";

// DM view is built in US4 — placeholder until then.
function DmViewPlaceholder() {
  return (
    <div className="flex h-full items-center justify-center">
      Direct messages (built in US4)
    </div>
  );
}

export default function App() {
  usePresenceHeartbeat();

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RouteGuard />}>
        <Route path="/" element={<ServerPage />} />
        <Route path="/servers/:serverId" element={<ServerPage />} />
        <Route path="/servers/:serverId/channels/:channelId" element={<ServerPage />} />
        <Route path="/invite/:inviteCode" element={<JoinInvitePage />} />
        <Route path="/profile" element={<ProfileSettingsPage />} />
        <Route path="/dm/:threadId" element={<DmViewPlaceholder />} />
      </Route>
    </Routes>
  );
}
