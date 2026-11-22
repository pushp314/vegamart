/**
 * VegaMart Zero-Asset Arrival Chime Synthesizer
 * Uses Web Audio API oscillator nodes — 0kb MP3 downloads, 0 CDN latency.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!audioCtx || audioCtx.state === "closed") {
    audioCtx = new AudioContextClass();
  }
  return audioCtx;
}

// Auto-unlock AudioContext on first user interaction anywhere on the window
if (typeof window !== "undefined") {
  const unlockAudio = () => {
    try {
      if (!audioCtx) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) audioCtx = new AudioContextClass();
      }
      if (audioCtx && audioCtx.state === "suspended") {
        audioCtx.resume().catch(() => {});
      }
    } catch {
      // Ignored
    } finally {
      window.removeEventListener("click", unlockAudio);
      window.removeEventListener("touchstart", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
    }
  };
  window.addEventListener("click", unlockAudio, { passive: true, once: true });
  window.addEventListener("touchstart", unlockAudio, { passive: true, once: true });
  window.addEventListener("keydown", unlockAudio, { passive: true, once: true });
}

function synthesizeChime(ctx: AudioContext): void {
  const now = ctx.currentTime;
  const notes = [
    { freq: 659.25, time: 0.0, dur: 0.25 }, // E5
    { freq: 830.61, time: 0.15, dur: 0.35 }, // G#5
    { freq: 987.77, time: 0.32, dur: 0.65 }, // B5
  ];

  notes.forEach(({ freq, time, dur }) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, now + time);

    // Smooth attack & exponential decay envelope
    gain.gain.setValueAtTime(0.0001, now + time);
    gain.gain.exponentialRampToValueAtTime(0.28, now + time + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + time + dur);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + time);
    osc.stop(now + time + dur);
  });

  // Mobile haptic vibration: two short pulses
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    try {
      navigator.vibrate([180, 80, 220]);
    } catch {
      // Ignore vibration error
    }
  }
}

/**
 * Plays a pleasant quick-commerce arrival chime (E5 -> G#5 -> B5 melody)
 * and triggers phone haptic vibration if supported.
 */
export function playArrivalChime(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === "suspended") {
      ctx.resume().then(() => {
        synthesizeChime(ctx);
      }).catch(() => {
        // Autoplay policy prevented playback until user interaction
      });
      return;
    }

    synthesizeChime(ctx);
  } catch {
    // Non-blocking if audio context is blocked by user gesture policy
  }
}
