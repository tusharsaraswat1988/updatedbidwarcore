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
  /** Plays on loop on the LED while a break countdown is active */
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

  // Custom HTML audio elements — fallback when Web Audio decode fails
  private countdownAudio: HTMLAudioElement | null = null;
  private soldAudio: HTMLAudioElement | null = null;
  private breakEndAudio: HTMLAudioElement | null = null;

  // Decoded buffers play through the unlocked AudioContext (reliable on LED displays)
  private countdownBuffer: AudioBuffer | null = null;
  private soldBuffer: AudioBuffer | null = null;
  private breakEndBuffer: AudioBuffer | null = null;
  private countdownLoadId = 0;
  private soldLoadId = 0;
  private breakEndLoadId = 0;

  private settings: AudioSettings = { ...DEFAULT_SETTINGS };

  // Looping break music (HTMLAudioElement — supports long tracks + loop)
  private breakLoopEl: HTMLAudioElement | null = null;

  // Active sold stinger — tracked so it can be cut when the next player loads
  private soldPlaybackId = 0;
  private soldHtmlElements: HTMLAudioElement[] = [];
  private soldBufferSources: AudioBufferSourceNode[] = [];

  // Deduplication state
  private lastCountdownSec = -1;
  private soldKeyPlayed = "";

  // Preview session — stops overlapping playback from repeated Preview clicks
  private previewGeneration = 0;
  private previewTimerIds: ReturnType<typeof setTimeout>[] = [];
  private breakPreviewTimerId: ReturnType<typeof setTimeout> | null = null;
  private previewHtmlElements: HTMLAudioElement[] = [];
  private previewGain: GainNode | null = null;
  private previewBufferSources: AudioBufferSourceNode[] = [];
  private breakMusicStartId = 0;

  /** Mark a sold event as already handled (e.g. page load) without playing audio. */
  ackSoldKey(key: string): void {
    if (key) this.soldKeyPlayed = key;
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────

  async unlock(): Promise<void> {
    await this.ensureContext();
    await this.primeHtmlAudio(this.countdownAudio);
    await this.primeHtmlAudio(this.soldAudio);
    await this.primeHtmlAudio(this.breakEndAudio);
  }

  private async ensureContext(): Promise<AudioContext | null> {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);
      this.applyMasterGain();
    }
    if (this.ctx.state === "suspended") {
      try {
        await this.ctx.resume();
      } catch {
        // Playback may still require an explicit user gesture.
      }
    }
    return this.ctx;
  }

  get isUnlocked(): boolean {
    return this.ctx?.state === "running";
  }

  dispose(): void {
    this.stopPreviewPlayback();
    this.stopBreakMusic();
    this.stopSoldSound();
    this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.masterGain = null;
    this.countdownAudio = null;
    this.soldAudio = null;
    this.breakEndAudio = null;
    this.countdownBuffer = null;
    this.soldBuffer = null;
    this.breakEndBuffer = null;
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
      this.countdownBuffer = null;
    }
    if (s.soldSoundUrl !== prevSoldUrl) {
      this.soldAudio = s.soldSoundUrl ? this.makeAudio(s.soldSoundUrl) : null;
      this.soldBuffer = null;
    }
    if (s.breakEndMusicUrl !== prevBreakEndUrl) {
      this.breakEndAudio = s.breakEndMusicUrl ? this.makeAudio(s.breakEndMusicUrl) : null;
      this.breakEndBuffer = null;
    }

    if (
      s.countdownSoundUrl !== prevCountdownUrl
      || s.soldSoundUrl !== prevSoldUrl
      || s.breakEndMusicUrl !== prevBreakEndUrl
    ) {
      this.reloadCustomBuffers();
    }
  }

  private makeAudio(url: string): HTMLAudioElement {
    const el = new Audio(url);
    if (url.startsWith("http://") || url.startsWith("https://")) {
      el.crossOrigin = "anonymous";
    }
    el.preload = "auto";
    el.load();
    return el;
  }

  private reloadCustomBuffers(): void {
    const { countdownSoundUrl, soldSoundUrl, breakEndMusicUrl } = this.settings;
    this.scheduleBufferLoad(countdownSoundUrl, "countdown");
    this.scheduleBufferLoad(soldSoundUrl, "sold");
    this.scheduleBufferLoad(breakEndMusicUrl, "breakEnd");
  }

  private scheduleBufferLoad(
    url: string | null,
    kind: "countdown" | "sold" | "breakEnd",
  ): void {
    if (!url) {
      if (kind === "countdown") this.countdownBuffer = null;
      if (kind === "sold") this.soldBuffer = null;
      if (kind === "breakEnd") this.breakEndBuffer = null;
      return;
    }

    const loadId = kind === "countdown"
      ? ++this.countdownLoadId
      : kind === "sold"
        ? ++this.soldLoadId
        : ++this.breakEndLoadId;

    void this.loadAudioBuffer(url).then((buffer) => {
      if (kind === "countdown" && loadId !== this.countdownLoadId) return;
      if (kind === "sold" && loadId !== this.soldLoadId) return;
      if (kind === "breakEnd" && loadId !== this.breakEndLoadId) return;
      if (kind === "countdown") this.countdownBuffer = buffer;
      if (kind === "sold") this.soldBuffer = buffer;
      if (kind === "breakEnd") this.breakEndBuffer = buffer;
    });
  }

  private async loadAudioBuffer(url: string): Promise<AudioBuffer | null> {
    try {
      const ctx = await this.ensureContext();
      if (!ctx) return null;

      const response = await fetch(url, { mode: "cors", credentials: "omit" });
      if (!response.ok) return null;
      const data = await response.arrayBuffer();
      return await ctx.decodeAudioData(data.slice(0));
    } catch {
      return null;
    }
  }

  private async primeHtmlAudio(el: HTMLAudioElement | null): Promise<void> {
    if (!el) return;
    try {
      const prevVolume = el.volume;
      el.volume = 0;
      el.currentTime = 0;
      await el.play();
      el.pause();
      el.currentTime = 0;
      el.volume = prevVolume;
    } catch {
      // Ignore — HTML fallback may still work after a later user gesture.
    }
  }

  private scaledVolume(soundVolume: number): number {
    return Math.min(1, (soundVolume / 100) * (this.settings.masterVolume / 100));
  }

  private playBuffer(buffer: AudioBuffer, soundVolume: number): boolean {
    const ctx = this.ctx;
    if (!ctx || !this.masterGain) return false;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = this.scaledVolume(soundVolume);
    source.connect(gain);
    gain.connect(this.masterGain);
    source.start();
    return true;
  }

  private async playHtmlClone(el: HTMLAudioElement, soundVolume: number): Promise<boolean> {
    const clone = el.cloneNode(true) as HTMLAudioElement;
    if (el.crossOrigin) clone.crossOrigin = el.crossOrigin;
    clone.volume = this.scaledVolume(soundVolume);
    try {
      await clone.play();
      return true;
    } catch {
      return false;
    }
  }

  private playCustomSound(
    buffer: AudioBuffer | null,
    el: HTMLAudioElement | null,
    soundVolume: number,
    synth: () => void,
  ): void {
    void this.unlock().then(async () => {
      if (buffer && this.playBuffer(buffer, soundVolume)) return;
      if (el && await this.playHtmlClone(el, soundVolume)) return;
      synth();
    });
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

    if (this.countdownBuffer || this.countdownAudio) {
      this.playCustomSound(
        this.countdownBuffer,
        this.countdownAudio,
        this.settings.countdownSoundVolume,
        () => this.synthTick(secondsLeft),
      );
      return;
    }
    void this.unlock().then(() => this.synthTick(secondsLeft));
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
    this.stopSoldSound();

    const playId = this.soldPlaybackId;

    if (this.soldBuffer || this.soldAudio) {
      void this.unlock().then(async () => {
        if (playId !== this.soldPlaybackId) return;
        if (this.soldBuffer && this.playSoldBuffer(this.soldBuffer, this.settings.soldSoundVolume)) return;
        if (this.soldAudio && await this.playSoldHtmlClone(this.soldAudio, this.settings.soldSoundVolume)) return;
        if (playId !== this.soldPlaybackId) return;
        this.synthSold();
      });
      return;
    }
    void this.unlock().then(() => {
      if (playId !== this.soldPlaybackId) return;
      this.synthSold();
    });
  }

  /** Stop any in-progress sold stinger (e.g. when the next player is loaded). */
  stopSoldSound(): void {
    this.soldPlaybackId += 1;

    for (const el of this.soldHtmlElements) {
      el.pause();
      el.currentTime = 0;
    }
    this.soldHtmlElements = [];

    for (const source of this.soldBufferSources) {
      try {
        source.stop();
      } catch {
        // Already stopped.
      }
    }
    this.soldBufferSources = [];
  }

  private playSoldBuffer(buffer: AudioBuffer, soundVolume: number): boolean {
    const ctx = this.ctx;
    if (!ctx || !this.masterGain) return false;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = this.scaledVolume(soundVolume);
    source.connect(gain);
    gain.connect(this.masterGain);
    source.onended = () => {
      this.soldBufferSources = this.soldBufferSources.filter((item) => item !== source);
    };
    this.soldBufferSources.push(source);
    source.start();
    return true;
  }

  private async playSoldHtmlClone(el: HTMLAudioElement, soundVolume: number): Promise<boolean> {
    const clone = el.cloneNode(true) as HTMLAudioElement;
    if (el.crossOrigin) clone.crossOrigin = el.crossOrigin;
    clone.volume = this.scaledVolume(soundVolume);
    this.soldHtmlElements.push(clone);
    clone.addEventListener("ended", () => {
      this.soldHtmlElements = this.soldHtmlElements.filter((item) => item !== clone);
    }, { once: true });
    try {
      await clone.play();
      return true;
    } catch {
      this.soldHtmlElements = this.soldHtmlElements.filter((item) => item !== clone);
      return false;
    }
  }

  // ── Break music (loops for the duration of the break countdown) ───────

  startBreakMusic(): void {
    if (!this.settings.audioEnabled) return;
    if (!this.settings.breakEndMusicEnabled) return;
    if (this.breakLoopEl && !this.breakLoopEl.paused) return;

    this.stopBreakMusic();
    const startId = ++this.breakMusicStartId;

    const url = this.settings.breakEndMusicUrl;
    if (url) {
      const el = this.makeAudio(url);
      el.loop = true;
      el.volume = this.scaledVolume(this.settings.breakEndMusicVolume);
      this.breakLoopEl = el;
      void this.unlock().then(() => {
        if (startId !== this.breakMusicStartId) return;
        el.play().catch(() => {});
      });
      return;
    }

    // Built-in fallback: short ambient chime on loop via the preloaded element
    if (this.breakEndAudio) {
      const el = this.breakEndAudio.cloneNode(true) as HTMLAudioElement;
      if (this.breakEndAudio.crossOrigin) el.crossOrigin = this.breakEndAudio.crossOrigin;
      el.loop = true;
      el.volume = this.scaledVolume(this.settings.breakEndMusicVolume);
      this.breakLoopEl = el;
      void this.unlock().then(() => {
        if (startId !== this.breakMusicStartId) return;
        el.play().catch(() => {});
      });
      return;
    }

    void this.unlock().then(() => {
      if (startId !== this.breakMusicStartId) return;
      this.synthBreakEnd();
    });
  }

  stopBreakMusic(): void {
    this.breakMusicStartId += 1;
    if (!this.breakLoopEl) return;
    this.breakLoopEl.pause();
    this.breakLoopEl.currentTime = 0;
    this.breakLoopEl.loop = false;
    this.breakLoopEl = null;
  }

  previewBreakMusic(): void {
    this.stopPreviewPlayback();
    const gen = this.previewGeneration;
    this.startBreakMusic();
    this.breakPreviewTimerId = setTimeout(() => {
      if (gen !== this.previewGeneration) return;
      this.stopBreakMusic();
      this.breakPreviewTimerId = null;
    }, 4000);
  }

  // ── Emergency controls ────────────────────────────────────────────────

  emergencyMute(): void {
    if (this.masterGain) this.masterGain.gain.value = 0;
  }

  emergencyUnmute(): void {
    this.applyMasterGain();
  }

  // ── Preview helpers (used by tournament settings UI) ──────────────────

  /** Stop any in-progress preview so repeated Preview clicks do not stack audio. */
  stopPreviewPlayback(): void {
    this.previewGeneration += 1;

    for (const id of this.previewTimerIds) clearTimeout(id);
    this.previewTimerIds = [];

    if (this.breakPreviewTimerId !== null) {
      clearTimeout(this.breakPreviewTimerId);
      this.breakPreviewTimerId = null;
    }

    this.stopBreakMusic();

    for (const el of this.previewHtmlElements) {
      el.pause();
      el.currentTime = 0;
    }
    this.previewHtmlElements = [];

    this.resetCountdownState();
    this.stopPreviewBufferSources();
    this.mutePreviewSynth();
  }

  private mutePreviewSynth(): void {
    if (!this.previewGain || !this.ctx) return;
    try {
      this.previewGain.gain.setValueAtTime(0, this.ctx.currentTime);
      this.previewGain.disconnect();
    } catch {
      // Already disconnected.
    }
    this.previewGain = null;
  }

  private getPreviewGain(): GainNode | null {
    const ctx = this.ctx;
    if (!ctx || !this.masterGain) return null;
    this.mutePreviewSynth();
    const gain = ctx.createGain();
    gain.gain.value = 1;
    gain.connect(this.masterGain);
    this.previewGain = gain;
    return gain;
  }

  private trackPreviewTimer(id: ReturnType<typeof setTimeout>): void {
    this.previewTimerIds.push(id);
  }

  private async playPreviewHtmlClone(el: HTMLAudioElement, soundVolume: number): Promise<boolean> {
    const clone = el.cloneNode(true) as HTMLAudioElement;
    if (el.crossOrigin) clone.crossOrigin = el.crossOrigin;
    clone.volume = this.scaledVolume(soundVolume);
    this.previewHtmlElements.push(clone);
    clone.addEventListener("ended", () => {
      this.previewHtmlElements = this.previewHtmlElements.filter((item) => item !== clone);
    }, { once: true });
    try {
      await clone.play();
      return true;
    } catch {
      this.previewHtmlElements = this.previewHtmlElements.filter((item) => item !== clone);
      return false;
    }
  }

  private stopPreviewBufferSources(): void {
    for (const source of this.previewBufferSources) {
      try {
        source.stop();
      } catch {
        // Already stopped.
      }
    }
    this.previewBufferSources = [];
  }

  private playPreviewBuffer(buffer: AudioBuffer, soundVolume: number, out: GainNode): boolean {
    const ctx = this.ctx;
    if (!ctx) return false;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = this.scaledVolume(soundVolume);
    source.connect(gain);
    gain.connect(out);
    source.onended = () => {
      this.previewBufferSources = this.previewBufferSources.filter((item) => item !== source);
    };
    this.previewBufferSources.push(source);
    source.start();
    return true;
  }

  private playPreviewCustomSound(
    gen: number,
    buffer: AudioBuffer | null,
    el: HTMLAudioElement | null,
    soundVolume: number,
    synth: (out: GainNode) => void,
  ): void {
    void this.unlock().then(async () => {
      if (gen !== this.previewGeneration) return;
      const out = this.getPreviewGain();
      if (!out) return;
      if (buffer && this.playPreviewBuffer(buffer, soundVolume, out)) return;
      if (el && await this.playPreviewHtmlClone(el, soundVolume)) return;
      if (gen !== this.previewGeneration) return;
      synth(out);
    });
  }

  previewCountdown(): void {
    this.stopPreviewPlayback();
    const gen = this.previewGeneration;
    if (!this.settings.audioEnabled || !this.settings.countdownSoundEnabled) return;

    for (let i = 5; i >= 1; i--) {
      const delay = (5 - i) * 700;
      const id = setTimeout(() => {
        if (gen !== this.previewGeneration) return;
        this.lastCountdownSec = -1;
        if (this.countdownBuffer || this.countdownAudio) {
          this.playPreviewCustomSound(
            gen,
            this.countdownBuffer,
            this.countdownAudio,
            this.settings.countdownSoundVolume,
            (out) => this.synthTick(i, out),
          );
          return;
        }
        void this.unlock().then(() => {
          if (gen !== this.previewGeneration) return;
          const out = this.getPreviewGain();
          if (out) this.synthTick(i, out);
        });
      }, delay);
      this.trackPreviewTimer(id);
    }
  }

  previewSold(): void {
    this.stopPreviewPlayback();
    const gen = this.previewGeneration;
    if (!this.settings.audioEnabled || !this.settings.soldSoundEnabled) return;

    if (this.soldBuffer || this.soldAudio) {
      this.playPreviewCustomSound(
        gen,
        this.soldBuffer,
        this.soldAudio,
        this.settings.soldSoundVolume,
        (out) => this.synthSold(out),
      );
      return;
    }
    void this.unlock().then(() => {
      if (gen !== this.previewGeneration) return;
      const out = this.getPreviewGain();
      if (out) this.synthSold(out);
    });
  }

  // ── Web Audio synthesis ───────────────────────────────────────────────

  private synthTick(secondsLeft: number, out: GainNode | null = this.masterGain): void {
    const ctx = this.ctx;
    if (!ctx || !out) return;

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
    env.connect(out);
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
    env2.connect(out);
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

  private synthSold(out: GainNode | null = this.masterGain): void {
    const ctx = this.ctx;
    if (!ctx || !out) return;

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
      g.connect(out);
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
      g2.connect(out);
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

  private synthBreakEnd(out: GainNode | null = this.masterGain): void {
    const ctx = this.ctx;
    if (!ctx || !out) return;

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
      g.connect(out);
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
