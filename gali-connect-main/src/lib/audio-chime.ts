// Shared Web Audio API Synthesizer for Vegamart notification alerts

const SOUND_PREF_KEY = "vegamart_sound_enabled";

let sharedAudioCtx: AudioContext | null = null;
let isAudioUnlocked = false;

export function getSharedAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!sharedAudioCtx || sharedAudioCtx.state === "closed") {
    const AudioContextClass =
      window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      sharedAudioCtx = new AudioContextClass();
    }
  }
  if (sharedAudioCtx && sharedAudioCtx.state === "suspended") {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

export function isSoundEnabled(): boolean {
  if (typeof window === "undefined") return true;
  const stored = localStorage.getItem(SOUND_PREF_KEY);
  return stored !== null ? stored === "true" : true;
}

export function setSoundEnabled(enabled: boolean): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(SOUND_PREF_KEY, String(enabled));
  }
}

// Auto-unlock AudioContext on first user interaction
export function initAudioUnlocker(): () => void {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return () => {};
  }

  const unlock = () => {
    if (isAudioUnlocked) return;
    const ctx = getSharedAudioContext();
    if (ctx) {
      if (ctx.state === "suspended") {
        ctx.resume().then(() => {
          isAudioUnlocked = true;
        }).catch(() => {});
      } else {
        isAudioUnlocked = true;
      }
    }
  };

  document.addEventListener("pointerdown", unlock, { once: true, passive: true });
  document.addEventListener("keydown", unlock, { once: true, passive: true });
  document.addEventListener("click", unlock, { once: true, passive: true });

  return () => {
    document.removeEventListener("pointerdown", unlock);
    document.removeEventListener("keydown", unlock);
    document.removeEventListener("click", unlock);
  };
}

export type ChimeType = "order" | "bell" | "promo" | "delivery" | "default";

/**
 * Synthesizes delightful, attention-grabbing musical chimes using Web Audio API
 */
export function playNotificationChime(type: ChimeType = "default"): void {
  if (!isSoundEnabled()) return;

  try {
    const ctx = getSharedAudioContext();
    if (!ctx) return;

    // Make sure context is active
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;

    if (type === "order") {
      // Harmonic major chord bell arpeggio (E5, G#5, B5, E6)
      const notes = [
        { freq: 659.25, time: 0, dur: 0.8, gain: 0.35 },
        { freq: 830.61, time: 0.11, dur: 0.8, gain: 0.35 },
        { freq: 987.77, time: 0.22, dur: 0.9, gain: 0.4 },
        { freq: 1318.51, time: 0.33, dur: 1.4, gain: 0.5 },
      ];

      notes.forEach(({ freq, time, dur, gain }) => {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + time);
        gainNode.gain.setValueAtTime(0, now + time);
        gainNode.gain.linearRampToValueAtTime(gain, now + time + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + time + dur);
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        osc.start(now + time);
        osc.stop(now + time + dur);
      });
    } else if (type === "promo") {
      // Soft uplifting ascending harp chime (C5, E5, G5, C6)
      const notes = [
        { freq: 523.25, time: 0, dur: 0.6, gain: 0.25 },
        { freq: 659.25, time: 0.09, dur: 0.6, gain: 0.3 },
        { freq: 783.99, time: 0.18, dur: 0.7, gain: 0.35 },
        { freq: 1046.5, time: 0.27, dur: 1.1, gain: 0.4 },
      ];

      notes.forEach(({ freq, time, dur, gain }) => {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, now + time);
        gainNode.gain.setValueAtTime(0, now + time);
        gainNode.gain.linearRampToValueAtTime(gain, now + time + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + time + dur);
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        osc.start(now + time);
        osc.stop(now + time + dur);
      });
    } else if (type === "delivery") {
      // Two-tone double pulse ping (F#5 -> C#6)
      const notes = [
        { freq: 739.99, time: 0, dur: 0.35, gain: 0.35 },
        { freq: 1108.73, time: 0.14, dur: 0.9, gain: 0.45 },
      ];

      notes.forEach(({ freq, time, dur, gain }) => {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + time);
        gainNode.gain.setValueAtTime(0, now + time);
        gainNode.gain.linearRampToValueAtTime(gain, now + time + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + time + dur);
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        osc.start(now + time);
        osc.stop(now + time + dur);
      });
    } else {
      // Default clean pleasant bell chime (A5 -> D6)
      const notes = [
        { freq: 880.0, time: 0, dur: 0.45, gain: 0.3 },
        { freq: 1174.66, time: 0.12, dur: 1.0, gain: 0.45 },
      ];

      notes.forEach(({ freq, time, dur, gain }) => {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + time);
        gainNode.gain.setValueAtTime(0, now + time);
        gainNode.gain.linearRampToValueAtTime(gain, now + time + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + time + dur);
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        osc.start(now + time);
        osc.stop(now + time + dur);
      });
    }
  } catch (e) {
    console.warn("Could not synthesize notification chime", e);
  }
}
