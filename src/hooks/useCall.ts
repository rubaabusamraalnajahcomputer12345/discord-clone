import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import type { CallScope } from "../../convex/lib/scope";
import {
  createPeerConnection,
  type PeerHandle,
  type SignalType,
} from "../lib/webrtc/peerConnection";

const HEARTBEAT_INTERVAL_MS = 5000;

export type CallParticipant = {
  userId: Id<"users">;
  displayName: string;
  avatarUrl: string;
  micOn: boolean;
  cameraOn: boolean;
};

export interface UseCallResult {
  callId: Id<"calls"> | null;
  participants: CallParticipant[];
  currentUserId: Id<"users"> | null;
  localStream: MediaStream | null;
  remoteStreams: Record<string, MediaStream>;
  /** Per-peer RTCPeerConnection state, keyed by the remote user id. */
  peerStates: Record<string, RTCPeerConnectionState>;
  micOn: boolean;
  cameraOn: boolean;
  connecting: boolean;
  error: string | null;
  toggleMic: () => void;
  toggleCamera: () => void;
}

// Orchestrates one client's membership in a call for `scope` (T047): acquires
// local media, joins, heartbeats, and diffs the reactive participant list into
// per-peer RTCPeerConnections (full mesh). Signaling flows through the
// `signals` table with a locally-tracked `since` cursor. Pass `null` to leave.
export function useCall(scope: CallScope | null): UseCallResult {
  const join = useMutation(api.callParticipants.join);
  const leaveCall = useMutation(api.callParticipants.leave);
  const heartbeat = useMutation(api.callParticipants.heartbeat);
  const setMicCamera = useMutation(api.callParticipants.setMicCamera);
  const sendSignal = useMutation(api.signals.send);
  const currentUser = useQuery(api.users.getCurrentUser);

  const [callId, setCallId] = useState<Id<"calls"> | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [peerStates, setPeerStates] = useState<Record<string, RTCPeerConnectionState>>({});
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs used inside long-lived callbacks so they never read stale state.
  const localStreamRef = useRef<MediaStream | null>(null);
  const callIdRef = useRef<Id<"calls"> | null>(null);
  const peersRef = useRef<Map<string, PeerHandle>>(new Map());
  const processedSignalIds = useRef<Set<string>>(new Set());
  const [since, setSince] = useState(0);

  const myUserId = currentUser?._id ?? null;

  const scopeKey = scope
    ? scope.kind === "channel"
      ? `channel:${scope.channelId}`
      : `thread:${scope.threadId}`
    : null;

  const participantsRaw = useQuery(
    api.callParticipants.list,
    callId ? { callId } : "skip",
  );
  const participants: CallParticipant[] = (participantsRaw ?? []).map((p) => ({
    userId: p.userId,
    displayName: p.displayName,
    avatarUrl: p.avatarUrl,
    micOn: p.micOn,
    cameraOn: p.cameraOn,
  }));

  const inbox = useQuery(
    api.signals.listInbox,
    callId ? { callId, since } : "skip",
  );

  // Create (once) the peer connection for a given remote user, publishing our
  // current local tracks. Role is deterministic per pair: the lexicographically
  // smaller userId is the polite peer (research §2a).
  const ensurePeer = useCallback(
    (otherUserId: Id<"users">): PeerHandle | null => {
      if (!myUserId) return null;
      const key = otherUserId as string;
      const existing = peersRef.current.get(key);
      if (existing) return existing;

      const polite = (myUserId as string) < (otherUserId as string);
      const handle = createPeerConnection({
        polite,
        localStream: localStreamRef.current,
        onSignal: (type: SignalType, payload: string) => {
          const activeCallId = callIdRef.current;
          if (!activeCallId) return;
          void sendSignal({
            callId: activeCallId,
            toUserId: otherUserId,
            type,
            payload,
          });
        },
        onRemoteStream: (stream) => {
          setRemoteStreams((prev) => ({ ...prev, [key]: stream }));
        },
        onConnectionStateChange: (state) => {
          setPeerStates((prev) => ({ ...prev, [key]: state }));
        },
      });
      peersRef.current.set(key, handle);
      return handle;
    },
    [myUserId, sendSignal],
  );

  const teardownPeers = useCallback(() => {
    for (const handle of peersRef.current.values()) {
      handle.close();
    }
    peersRef.current.clear();
    setRemoteStreams({});
    setPeerStates({});
    processedSignalIds.current.clear();
  }, []);

  // --- Join / leave lifecycle, keyed on the (stable) scope string. ---
  useEffect(() => {
    if (!scopeKey || !scope) {
      return;
    }
    let cancelled = false;
    setConnecting(true);
    setError(null);

    void (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        localStreamRef.current = stream;
        setLocalStream(stream);
        setMicOn(true);
        setCameraOn(false);

        const newCallId = await join({ scope });
        if (cancelled) return;
        callIdRef.current = newCallId;
        setCallId(newCallId);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Could not access microphone or join the call",
          );
        }
      } finally {
        if (!cancelled) setConnecting(false);
      }
    })();

    return () => {
      cancelled = true;
      const leavingCallId = callIdRef.current;
      teardownPeers();
      if (leavingCallId) {
        void leaveCall({ callId: leavingCallId });
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
      }
      callIdRef.current = null;
      setCallId(null);
      setLocalStream(null);
      setSince(0);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    };
  }, [scopeKey]);

  // --- Heartbeat while in the call. ---
  useEffect(() => {
    if (!callId) return;
    const id = setInterval(() => {
      void heartbeat({ callId });
    }, HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(id);
  }, [callId, heartbeat]);

  // --- Diff the participant list into peer connections. ---
  useEffect(() => {
    if (!callId || !myUserId || !localStream) return;

    const presentIds = new Set<string>();
    for (const participant of participants) {
      if (participant.userId === myUserId) continue;
      presentIds.add(participant.userId as string);
      ensurePeer(participant.userId);
    }

    // Close connections to peers who have left.
    for (const [key, handle] of peersRef.current.entries()) {
      if (!presentIds.has(key)) {
        handle.close();
        peersRef.current.delete(key);
        setRemoteStreams((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
        setPeerStates((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      }
    }
    // participants is derived fresh each render; guarded by callId/localStream.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callId, myUserId, localStream, participantsRaw, ensurePeer]);

  // --- Apply inbound signals exactly once, advancing the `since` cursor. ---
  useEffect(() => {
    if (!inbox || inbox.length === 0) return;
    let maxCreatedAt = since;
    for (const signal of inbox) {
      if (processedSignalIds.current.has(signal._id)) continue;
      processedSignalIds.current.add(signal._id);
      const peer = ensurePeer(signal.fromUserId);
      if (peer) {
        void peer.handleSignal(signal.type as SignalType, signal.payload);
      }
      if (signal.createdAt > maxCreatedAt) {
        maxCreatedAt = signal.createdAt;
      }
    }
    if (maxCreatedAt > since) {
      setSince(maxCreatedAt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inbox, ensurePeer]);

  const toggleMic = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !micOn;
    stream.getAudioTracks().forEach((t) => (t.enabled = next));
    setMicOn(next);
    if (callIdRef.current) {
      void setMicCamera({ callId: callIdRef.current, micOn: next });
    }
  }, [micOn, setMicCamera]);

  const toggleCamera = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const activeCallId = callIdRef.current;

    void (async () => {
      try {
        if (!cameraOn) {
          const camStream = await navigator.mediaDevices.getUserMedia({
            video: true,
          });
          const videoTrack = camStream.getVideoTracks()[0];
          if (!videoTrack) return;
          stream.addTrack(videoTrack);
          // Adding a track to each peer triggers onnegotiationneeded, which
          // Perfect Negotiation resolves without glare.
          for (const handle of peersRef.current.values()) {
            handle.pc.addTrack(videoTrack, stream);
          }
          setCameraOn(true);
          if (activeCallId) void setMicCamera({ callId: activeCallId, cameraOn: true });
        } else {
          const videoTrack = stream.getVideoTracks()[0];
          if (videoTrack) {
            for (const handle of peersRef.current.values()) {
              const sender = handle.pc
                .getSenders()
                .find((s) => s.track === videoTrack);
              if (sender) handle.pc.removeTrack(sender);
            }
            stream.removeTrack(videoTrack);
            videoTrack.stop();
          }
          setCameraOn(false);
          if (activeCallId) void setMicCamera({ callId: activeCallId, cameraOn: false });
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Could not toggle camera",
        );
      }
    })();
  }, [cameraOn, setMicCamera]);

  return {
    callId,
    participants,
    currentUserId: myUserId,
    localStream,
    remoteStreams,
    peerStates,
    micOn,
    cameraOn,
    connecting,
    error,
    toggleMic,
    toggleCamera,
  };
}
