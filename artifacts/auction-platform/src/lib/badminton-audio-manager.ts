/**
 * BadmintonAudioManager — venue LED scoreboard audio only.
 * Loop music (Control Center On/Pause) + built-in SFX (game/match/deuce).
 */

export type BadmintonVenueSfxKind = "game_point" | "match_point" | "deuce";

export type BadmintonAudioSettings = {
  musicUrl: string | null;
  musicVolume: number; // 0–100
  masterVolume: number; // 0–100
  sfxVolume: number; // 0–100
};

const DEFAULT_SETTINGS: BadmintonAudioSettings = {
  musicUrl: null,
  musicVolume: 80,
  masterVolume: 80,
  sfxVolume: 85,
};

export class BadmintonAudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private settings: BadmintonAudioSettings = { ...DEFAULT_SETTINGS };

  private loopEl: HTMLAudioElement | null = null;
  private loopStartId = 0;
  private loopShouldBePlaying = false;
  private sfxPausedLoop = false;
  private sfxGeneration = 0;

  async unlock(): Promise<void> {
    await this.ensureContext();
    await this.primeHtmlAudio(this.loopEl);
  }

  get isUnlocked(): boolean {
    return this.ctx?.state === "running";
  }

  setSettings(next: BadmintonAudioSettings): void {
    const prevUrl = this.settings.musicUrl;
    this.settings = { ...next };
    this.applyMasterGain();
    if (this.loopEl) {
      this.loopEl.volume = this.scaledVolume(this.settings.musicVolume);
    }
    if (prevUrl !== next.musicUrl && this.loopShouldBePlaying) {
      this.startLoopMusic();
    }
  }

  dispose(): void {
    this.sfxGeneration += 1;
    this.stopLoopMusic();
    if (this.ctx) {
      void this.ctx.close().catch(() => {});
      this.ctx = null;
      this.masterGain = null;
    }
  }

  /** Operator On — start/resume looping venue music. */
  startLoopMusic(): void {
    this.loopShouldBePlaying = true;
    this.sfxPausedLoop = false;
    if (this.loopEl && !this.loopEl.paused) {
      this.loopEl.volume = this.scaledVolume(this.settings.musicVolume);
      return;
    }
    if (this.loopEl && this.loopEl.paused && this.loopEl.src) {
      void this.unlock().then(() => {
        if (!this.loopShouldBePlaying || this.sfxPausedLoop) return;
        this.loopEl?.play().catch(() => {});
      });
      return;
    }

    this.stopLoopElementOnly();
    const startId = ++this.loopStartId;
    const url = this.settings.musicUrl?.trim() || null;

    if (url) {
      const el = new Audio(url);
      el.crossOrigin = "anonymous";
      el.loop = true;
      el.preload = "auto";
      el.volume = this.scaledVolume(this.settings.musicVolume);
      this.loopEl = el;
      void this.unlock().then(() => {
        if (startId !== this.loopStartId || !this.loopShouldBePlaying) return;
        el.play().catch(() => {});
      });
      return;
    }

    // No URL — soft ambient synth pulse so On still has audible feedback.
    void this.unlock().then(() => {
      if (startId !== this.loopStartId || !this.loopShouldBePlaying) return;
      this.synthAmbientLoopKick();
    });
  }

  /** Operator Pause — pause loop without resetting position. */
  pauseLoopMusic(): void {
    this.loopShouldBePlaying = false;
    this.sfxPausedLoop = false;
    if (this.loopEl && !this.loopEl.paused) {
      this.loopEl.pause();
    }
  }

  /** Hard stop (dispose / track change). */
  stopLoopMusic(): void {
    this.loopShouldBePlaying = false;
    this.sfxPausedLoop = false;
    this.stopLoopElementOnly();
  }

  /**
   * Play built-in SFX. Pauses loop during stinger, resumes if music still On.
   */
  playSfx(kind: BadmintonVenueSfxKind): void {
    const gen = ++this.sfxGeneration;
    const wasPlaying =
      this.loopShouldBePlaying
      && !!this.loopEl
      && !this.loopEl.paused;

    if (wasPlaying && this.loopEl) {
      this.sfxPausedLoop = true;
      this.loopEl.pause();
    }

    void this.unlock().then(() => {
      if (gen !== this.sfxGeneration) return;
      this.synthSfx(kind);
      const resumeMs =
        kind === "match_point" ? 1400 : kind === "game_point" ? 1100 : 900;
      window.setTimeout(() => {
        if (gen !== this.sfxGeneration) return;
        if (this.sfxPausedLoop && this.loopShouldBePlaying && this.loopEl) {
          this.sfxPausedLoop = false;
          this.loopEl.play().catch(() => {});
        } else {
          this.sfxPausedLoop = false;
        }
      }, resumeMs);
    });
  }

  private stopLoopElementOnly(): void {
    this.loopStartId += 1;
    if (!this.loopEl) return;
    this.loopEl.pause();
    this.loopEl.loop = false;
    this.loopEl.src = "";
    this.loopEl = null;
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
        // Needs user gesture.
      }
    }
    return this.ctx;
  }

  private applyMasterGain(): void {
    if (!this.masterGain) return;
    this.masterGain.gain.value = this.settings.masterVolume / 100;
  }

  private scaledVolume(soundVolume: number): number {
    return Math.min(1, (soundVolume / 100) * (this.settings.masterVolume / 100));
  }

  private async primeHtmlAudio(el: HTMLAudioElement | null): Promise<void> {
    if (!el) return;
    try {
      const prev = el.volume;
      el.volume = 0;
      await el.play();
      el.pause();
      el.volume = prev;
    } catch {
      // Ignore until gesture.
    }
  }

  private synthSfx(kind: BadmintonVenueSfxKind): void {
    const ctx = this.ctx;
    const out = this.masterGain;
    if (!ctx || !out) return;
    const vol = this.settings.sfxVolume / 100;

    if (kind === "deuce") {
      // Two short low-high pips
      this.playTone(out, 392, 0, 0.18, vol * 0.45);
      this.playTone(out, 523.25, 0.16, 0.22, vol * 0.5);
      return;
    }

    if (kind === "game_point") {
      // Rising urgency triad
      this.playTone(out, 659.25, 0, 0.2, vol * 0.5);
      this.playTone(out, 783.99, 0.14, 0.22, vol * 0.55);
      this.playTone(out, 987.77, 0.28, 0.35, vol * 0.65);
      return;
    }

    // match_point — brighter / longer fanfare
    this.playTone(out, 523.25, 0, 0.22, vol * 0.5);
    this.playTone(out, 659.25, 0.12, 0.22, vol * 0.55);
    this.playTone(out, 783.99, 0.24, 0.28, vol * 0.6);
    this.playTone(out, 1046.5, 0.4, 0.55, vol * 0.75);
  }

  private synthAmbientLoopKick(): void {
    const out = this.masterGain;
    if (!out) return;
    const vol = this.settings.musicVolume / 100;
    this.playTone(out, 196, 0, 0.4, vol * 0.25);
    this.playTone(out, 246.94, 0.2, 0.45, vol * 0.22);
  }

  private playTone(
    out: GainNode,
    freq: number,
    delay: number,
    dur: number,
    amp: number,
  ): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const g = ctx.createGain();
    g.connect(out);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(amp, t + 0.012);
    g.gain.setValueAtTime(amp, t + dur * 0.45);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, t);
    osc.connect(g);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }
}
