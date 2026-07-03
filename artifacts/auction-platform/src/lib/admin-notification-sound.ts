let cachedContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!cachedContext) {
    cachedContext = new AudioContext();
  }
  return cachedContext;
}

/** Short subtle beep for admin notification alerts. */
export function playAdminNotificationSound(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    void ctx.resume();

    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.06, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.22);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.24);
  } catch {
    // Audio unavailable — ignore
  }
}
