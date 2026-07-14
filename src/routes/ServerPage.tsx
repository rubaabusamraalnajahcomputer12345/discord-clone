import { useParams } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { ServerRail } from "../components/servers/ServerRail";
import { ChannelList } from "../components/channels/ChannelList";
import { ChannelHeader } from "../components/channels/ChannelHeader";
import { MemberList } from "../components/members/MemberList";
import { MessageList } from "../components/messages/MessageList";
import { MessageComposer } from "../components/messages/MessageComposer";
import { TypingIndicator } from "../components/messages/TypingIndicator";

export function ServerPage() {
  const params = useParams();
  const serverId = params.serverId as Id<"servers"> | undefined;
  const routeChannelId = params.channelId as Id<"channels"> | undefined;

  const channels = useQuery(api.channels.list, serverId ? { serverId } : "skip");
  const defaultTextChannel = channels?.find((channel) => channel.type === "text");
  const activeChannelId = routeChannelId ?? defaultTextChannel?._id;
  const activeChannel = channels?.find((channel) => channel._id === activeChannelId);

  if (!serverId) {
    return (
      <div className="flex h-full">
        <ServerRail />
        <div className="flex flex-1 flex-col items-center justify-center text-offline">
          <p className="mb-1 text-lg font-medium text-gray-300">No server selected</p>
          <p className="text-sm">
            Pick a server on the left, or press <span className="text-online">+</span> to create one.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <ServerRail />
      <ChannelList serverId={serverId} />
      <div className="flex min-w-0 flex-1 flex-col">
        {activeChannelId && activeChannel ? (
          <>
            <ChannelHeader name={activeChannel.name} />
            <MessageList channelId={activeChannelId} />
            <TypingIndicator channelId={activeChannelId} />
            <MessageComposer channelId={activeChannelId} />
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-offline">
            No channel selected
          </div>
        )}
      </div>
      <MemberList serverId={serverId} />
    </div>
  );
}
