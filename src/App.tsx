import { Routes, Route } from "react-router-dom";
import { RouteGuard } from "./lib/routeGuard";
import { LoginPage } from "./routes/LoginPage";
import { JoinInvitePage } from "./routes/JoinInvitePage";
import { ProfileSettingsPage } from "./routes/ProfileSettingsPage";
import { ServerPage } from "./routes/ServerPage";
import { DmPage } from "./routes/DmPage";
import { usePresenceHeartbeat } from "./hooks/usePresenceHeartbeat";

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
        <Route path="/dm" element={<DmPage />} />
        <Route path="/dm/:threadId" element={<DmPage />} />
      </Route>
    </Routes>
  );
}
