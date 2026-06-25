/**
 * AuctionAudioManager
 *
 * Manages all broadcast audio for the LED display screen.
 * - Synthesizes default sounds via Web Audio API (no external files needed)
 * - Supports custom URL overrides stored in tournament settings
 * - Prevents overlapping / duplicate playback
 * - Stops countdown ticks when sold sound fires
 * - Emergency mute for broadcast control
 *
 * Only instantiated inside the display shell — never in operator or owner panels.
 */

export interface AudioSettings {
  audioEnabled: boolean;
  masterVolume: number;          // 0–100
  countdownSoundEnabled: boolean;
  countdownSoundUrl: string | null;
  countdownSoundVolume: number;  // 0–100
  soldSoundEnabled: boolean;
  soldSoundUrl: string | null;
  soldSoundVolume: number;       // 0–100
  breakEndMusicEnabled: boolean;
  breakEndMusicUrl: string | null;
  breakEndMusicVolume: number;   // 0–100
}

const DEFAULT_SETTINGS: AudioSettings = {
  audioEnabled: true,
  masterVolume: 80,
  countdownSoundEnabled: true,
  countdownSoundUrl: null,
  countdownSoundVolume: 70,
  soldSoundEnabled: true,
  soldSoundUrl: null,
  soldSoundVolume: 80,
  breakEndMusicEnabled: false,
  breakEndMusicUrl: null,
  breakEndMusicVolume: 80,
};

export class AuctionAudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;

  // Custom HTML audio elements for URL-backed sounds
  private countdownAudio: HTMLAudioElement | null = null;
  private soldAudio: HTMLAudioElement | null = null;
  private breakEndAudio: HTMLAudioElement | null = null;

  private settings: AudioSettings = { ...DEFAULT_SETTINGS };

  // Deduplication state
  private lastCountdownSec = -1;
  private soldKeyPlayed = "";
  private breakEndKeyPlayed = "";

  /** Mark a sold event as already handled (e.g. page load) without playing audio. */
  ackSoldKey(key: string): void {
    if (key) this.soldKeyPlayed = key;
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────

  async unlock(): Promise<void> {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);
      this.applyMasterGain();
    }
    if (this.ctx.state === "suspended") {
      await this.ctx.resume();
    }
  }

  get isUnlocked(): boolean {
    return this.ctx?.state === "running";
  }

  dispose(): void {
    this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.masterGain = null;
    this.countdownAudio = null;
    this.soldAudio = null;
  }

  // ── Settings ──────────────────────────────────────────────────────────

  setSettings(s: AudioSettings): void {
    const prevCountdownUrl = this.settings.countdownSoundUrl;
    const prevSoldUrl = this.settings.soldSoundUrl;
    const prevBreakEndUrl = this.settings.breakEndMusicUrl;
    this.settings = s;
    this.applyMasterGain();

    // Reload custom audio only when URLs change
    if (s.countdownSoundUrl !== prevCountdownUrl) {
      this.countdownAudio = s.countdownSoundUrl ? this.makeAudio(s.countdownSoundUrl) : null;
    }
    if (s.soldSoundUrl !== prevSoldUrl) {
      this.soldAudio = s.soldSoundUrl ? this.makeAudio(s.soldSoundUrl) : null;
    }
    if (s.breakEndMusicUrl !== prevBreakEndUrl) {
      this.breakEndAudio = s.breakEndMusicUrl ? this.makeAudio(s.breakEndMusicUrl) : null;
    }
  }

  private makeAudio(url: string): HTMLAudioElement {
    const el = new Audio(url);
    el.preload = "auto";
    el.load();
    return el;
  }

  private applyMasterGain(): void {
    if (!this.masterGain) return;
    this.masterGain.gain.value = this.settings.audioEnabled
      ? this.settings.masterVolume / 100
      : 0;
  }

  // ── Countdown ticks ───────────────────────────────────────────────────

  playCountdownTick(secondsLeft: number): void {
    if (!this.settings.audioEnabled) return;
    if (!this.settings.countdownSoundEnabled) return;
    if (secondsLeft < 1 || secondsLeft > 5) return;
    if (secondsLeft === this.lastCountdownSec) return; // deduplicate per-second
    this.lastCountdownSec = secondsLeft;

    if (this.countdownAudio) {
      const clone = this.countdownAudio.cloneNode() as HTMLAudioElement;
      clone.volume = Math.min(
        1,
        (this.settings.countdownSoundVolume / 100) * (this.settings.masterVolume / 100),
      );
      clone.play().catch(() => {});
      return;
    }
    this.synthTick(secondsLeft);
  }

  resetCountdownState(): void {
    this.lastCountdownSec = -1;
  }

  stopCountdown(): void {
    this.lastCountdownSec = -1;
  }

  // ── Sold sound ────────────────────────────────────────────────────────

  playSold(key: string): void {
    if (!this.settings.audioEnabled) return;
    if (!this.settings.soldSoundEnabled) return;
    if (key && key === this.soldKeyPlayed) return; // deduplicate per event
    this.soldKeyPlayed = key;

    // Stop countdown state so ticks don't fire during sold animation
    this.stopCountdown();

    if (this.soldAudio) {
      const clone = this.soldAudio.cloneNode() as HTMLAudioElement;
      clone.volume = Math.min(
        1,
        (this.settings.soldSoundVolume / 100) * (this.settings.masterVolume / 100),
      );
      clone.play().catch(() => {});
      return;
    }
    this.synthSold();
  }

  // ── Break-end sound ───────────────────────────────────────────────────

  playBreakEnd(key: string): void {
    if (!this.settings.audioEnabled) return;
    if (!this.settings.breakEndMusicEnabled) return;
    if (key && key === this.breakEndKeyPlayed) return; // deduplicate per event
    this.breakEndKeyPlayed = key;

    if (this.breakEndAudio) {
      const clone = this.breakEndAudio.cloneNode() as HTMLAudioElement;
      clone.volume = Math.min(
        1,
        (this.settings.breakEndMusicVolume / 100) * (this.settings.masterVolume / 100),
      );
      clone.play().catch(() => {});
      return;
    }
    this.synthBreakEnd();
  }

  previewBreakEnd(): void {
    this.breakEndKeyPlayed = ""; // reset so preview always plays
    this.playBreakEnd("__preview__" + Date.now());
  }

  // ── Emergency controls ────────────────────────────────────────────────

  emergencyMute(): void {
    if (this.masterGain) this.masterGain.gain.value = 0;
  }

  emergencyUnmute(): void {
    this.applyMasterGain();
  }

  // ── Preview helpers (used by tournament settings UI) ──────────────────

  previewCountdown(): void {
    for (let i = 5; i >= 1; i--) {
      const delay = (5 - i) * 700;
      setTimeout(() => {
        this.lastCountdownSec = -1; // allow each tick to play
        this.playCountdownTick(i);
      }, delay);
    }
  }

  previewSold(): void {
    this.soldKeyPlayed = ""; // reset so preview always plays
    this.playSold("__preview__" + Date.now());
  }

  // ── Web Audio synthesis ───────────────────────────────────────────────

  private synthTick(secondsLeft: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.masterGain) return;

    const vol = this.settings.countdownSoundVolume / 100;
    const now = ctx.currentTime;

    // Pitch rises as countdown approaches zero — builds tension
    const freqMap: Record<number, number> = {
      5: 440,
      4: 528,
      3: 640,
      2: 768,
      1: 920,
    };
    const freq = freqMap[secondsLeft] ?? 440;

    // Primary sine pip
    const env = ctx.createGain();
    env.connect(this.masterGain);
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(vol * 0.55, now + 0.009);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.25, now + 0.07);
    osc.connect(env);
    osc.start(now);
    osc.stop(now + 0.18);

    // Subtle harmonic layer for a digital "ping" feel
    const env2 = ctx.createGain();
    env2.connect(this.masterGain);
    env2.gain.setValueAtTime(0, now);
    env2.gain.linearRampToValueAtTime(vol * 0.12, now + 0.008);
    env2.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

    const osc2 = ctx.createOscillator();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(freq * 2, now);
    osc2.connect(env2);
    osc2.start(now);
    osc2.stop(now + 0.14);
  }

  private synthSold(): void {
    const ctx = this.ctx;
    if (!ctx || !this.masterGain) return;

    const vol = this.settings.soldSoundVolume / 100;

    // Four-note ascending fanfare: C5 → E5 → G5 → C6 (major arpeggio)
    const notes: Array<{ freq: number; delay: number; dur: number; amp: number }> = [
      { freq: 523.25, delay: 0.0,  dur: 0.28, amp: 0.50 }, // C5
      { freq: 659.25, delay: 0.13, dur: 0.28, amp: 0.50 }, // E5
      { freq: 783.99, delay: 0.26, dur: 0.32, amp: 0.50 }, // G5
      { freq: 1046.5, delay: 0.39, dur: 0.60, amp: 0.70 }, // C6 — held
    ];

    notes.forEach(({ freq, delay, dur, amp }) => {
      const t = ctx.currentTime + delay;

      // Sine body
      const g = ctx.createGain();
      g.connect(this.masterGain!);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol * amp, t + 0.014);
      g.gain.setValueAtTime(vol * amp, t + dur * 0.55);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, t);
      osc.connect(g);
      osc.start(t);
      osc.stop(t + dur + 0.05);

      // Triangle harmonic for warmth / richness
      const g2 = ctx.createGain();
      g2.connect(this.masterGain!);
      g2.gain.setValueAtTime(0, t);
      g2.gain.linearRampToValueAtTime(vol * amp * 0.18, t + 0.018);
      g2.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.75);

      const osc2 = ctx.createOscillator();
      osc2.type = "triangle";
      osc2.frequency.setValueAtTime(freq, t);
      osc2.connect(g2);
      osc2.start(t);
      osc2.stop(t + dur);
    });
  }

  private synthBreakEnd(): void {
    const ctx = this.ctx;
    if (!ctx || !this.masterGain) return;

    const vol = this.settings.breakEndMusicVolume / 100;

    // Short ascending three-note chime: G5 → B5 → D6 (major arpeggio) — signals break over
    const notes: Array<{ freq: number; delay: number; dur: number; amp: number }> = [
      { freq: 783.99, delay: 0.0,  dur: 0.22, amp: 0.45 }, // G5
      { freq: 987.77, delay: 0.12, dur: 0.22, amp: 0.45 }, // B5
      { freq: 1174.7, delay: 0.24, dur: 0.45, amp: 0.60 }, // D6 — held
    ];

    notes.forEach(({ freq, delay, dur, amp }) => {
      const t = ctx.currentTime + delay;

      const g = ctx.createGain();
      g.connect(this.masterGain!);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol * amp, t + 0.012);
      g.gain.setValueAtTime(vol * amp, t + dur * 0.5);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, t);
      osc.connect(g);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    });
  }
}
