// FR-030 "speaking" indicator, derived entirely client-side from a remote (or
// local) audio track via a Web Audio AnalyserNode — NO Convex writes. In the
// full mesh each peer already receives every other peer's raw audio, so "who's
// speaking" is computed locally from the RMS level of the stream, with no
// round-trip (see data-model.md's callParticipants note).

export interface SpeakingDetector {
  stop(): void;
}

interface SpeakingDetectorOptions {
  /** RMS level (0..1) above which the stream counts as "speaking". */
  threshold?: number;
  /** Consecutive-below-threshold time before flipping back to silent. */
  silenceHoldMs?: number;
}

type AudioContextCtor = typeof AudioContext;

export function createSpeakingDetector(
  stream: MediaStream,
  onChange: (speaking: boolean) => void,
  options: SpeakingDetectorOptions = {},
): SpeakingDetector {
  const threshold = options.threshold ?? 0.02;
  const silenceHoldMs = options.silenceHoldMs ?? 300;

  const Ctor: AudioContextCtor | undefined =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: AudioContextCtor })
      .webkitAudioContext;
  if (!Ctor) {
    return { stop: () => {} };
  }

  const audioCtx = new Ctor();
  const source = audioCtx.createMediaStreamSource(stream);
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 512;
  source.connect(analyser);

  const samples = new Uint8Array(analyser.fftSize);
  let raf = 0;
  let speaking = false;
  let lastLoudAt = 0;
  let stopped = false;

  const tick = (now: number) => {
    if (stopped) {
      return;
    }
    analyser.getByteTimeDomainData(samples);
    let sumSquares = 0;
    for (let i = 0; i < samples.length; i++) {
      const centered = (samples[i] - 128) / 128;
      sumSquares += centered * centered;
    }
    const rms = Math.sqrt(sumSquares / samples.length);

    if (rms > threshold) {
      lastLoudAt = now;
      if (!speaking) {
        speaking = true;
        onChange(true);
      }
    } else if (speaking && now - lastLoudAt > silenceHoldMs) {
      speaking = false;
      onChange(false);
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  return {
    stop: () => {
      stopped = true;
      cancelAnimationFrame(raf);
      try {
        source.disconnect();
      } catch {
        // no-op: source may already be disconnected
      }
      void audioCtx.close();
    },
  };
}
