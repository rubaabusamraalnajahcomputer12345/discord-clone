// One pairwise RTCPeerConnection in the full mesh (research §2a), wired for
// the MDN Perfect Negotiation pattern so either side can (re)negotiate — e.g.
// when someone toggles camera/mic tracks — without glare.
//
// Note: modern browsers put randomized `<uuid>.local` mDNS hostnames in ICE
// candidates instead of real private IPs (a privacy feature). Connectivity is
// unaffected, but SDP won't show literal LAN IPs during local debugging — this
// is expected, not a bug.

export type SignalType = "offer" | "answer" | "ice-candidate";

export interface PeerHandle {
  readonly pc: RTCPeerConnection;
  /** Apply a signal received from the remote peer through the `signals` table. */
  handleSignal(type: SignalType, payload: string): Promise<void>;
  /** Add/replace the set of local tracks (used when toggling camera on/off). */
  close(): void;
}

export interface PeerConnectionOptions {
  /** Deterministic per-pair role; the lexicographically smaller userId is polite. */
  polite: boolean;
  /** Local media whose tracks are published to this peer (may be null pre-media). */
  localStream: MediaStream | null;
  /** Send a locally-produced signal (SDP/ICE) to the remote peer. */
  onSignal: (type: SignalType, payload: string) => void;
  /** Called with the remote peer's MediaStream when its tracks arrive. */
  onRemoteStream: (stream: MediaStream) => void;
  onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
}

// STUN only — no TURN server is provisioned (plan.md Constraints), so calls
// behind symmetric/strict NAT may fail to connect. The UI surfaces this
// (T060) rather than failing silently.
const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
];

export function createPeerConnection(opts: PeerConnectionOptions): PeerHandle {
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  let makingOffer = false;
  let ignoreOffer = false;

  if (opts.localStream) {
    for (const track of opts.localStream.getTracks()) {
      pc.addTrack(track, opts.localStream);
    }
  }

  // Either side can start (re)negotiation; setLocalDescription() with no args
  // builds the correct offer/answer implicitly.
  pc.onnegotiationneeded = () => {
    void (async () => {
      try {
        makingOffer = true;
        await pc.setLocalDescription();
        if (pc.localDescription) {
          opts.onSignal(
            pc.localDescription.type as SignalType,
            JSON.stringify(pc.localDescription),
          );
        }
      } catch (err) {
        console.error("[webrtc] negotiation failed", err);
      } finally {
        makingOffer = false;
      }
    })();
  };

  pc.onicecandidate = ({ candidate }) => {
    if (candidate) {
      opts.onSignal("ice-candidate", JSON.stringify(candidate));
    }
  };

  pc.ontrack = ({ streams }) => {
    if (streams[0]) {
      opts.onRemoteStream(streams[0]);
    }
  };

  pc.onconnectionstatechange = () => {
    opts.onConnectionStateChange?.(pc.connectionState);
    // Current recommended ICE-restart trigger (supersedes the old
    // createOffer({ iceRestart: true }) pattern) — flags the next negotiation.
    if (pc.connectionState === "failed") {
      pc.restartIce();
    }
  };

  async function handleSignal(type: SignalType, payload: string): Promise<void> {
    const data = JSON.parse(payload) as unknown;
    try {
      if (type === "offer" || type === "answer") {
        const description = data as RTCSessionDescriptionInit;
        const offerCollision =
          description.type === "offer" &&
          (makingOffer || pc.signalingState !== "stable");

        // Impolite peer ignores a colliding offer; polite peer yields
        // (setRemoteDescription implicitly rolls back its own pending offer).
        ignoreOffer = !opts.polite && offerCollision;
        if (ignoreOffer) {
          return;
        }

        await pc.setRemoteDescription(description);
        if (description.type === "offer") {
          await pc.setLocalDescription();
          if (pc.localDescription) {
            opts.onSignal(
              pc.localDescription.type as SignalType,
              JSON.stringify(pc.localDescription),
            );
          }
        }
      } else {
        // ice-candidate: candidate errors tied to an ignored offer are
        // expected and swallowed rather than surfaced.
        try {
          await pc.addIceCandidate(data as RTCIceCandidateInit);
        } catch (err) {
          if (!ignoreOffer) {
            throw err;
          }
        }
      }
    } catch (err) {
      console.error("[webrtc] failed to apply signal", type, err);
    }
  }

  return {
    pc,
    handleSignal,
    close: () => pc.close(),
  };
}
