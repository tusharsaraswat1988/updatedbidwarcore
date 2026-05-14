/**
 * Plays a short gavel-crack + bell-ring SFX when a player is sold.
 * Pure side-effect — safe to call from any effect or event handler.
 * Silently no-ops if AudioContext is unavailable (autoplay-blocked tabs).
 */
export function playSoldAudio() {
  try {
    const ctx = new AudioContext();
    // Gavel crack — short noise burst
    const crackBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.06), ctx.sampleRate);
    const crackData = crackBuf.getChannelData(0);
    for (let i = 0; i < crackData.length; i++) {
      crackData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / crackData.length, 1.5);
    }
    const crack = ctx.createBufferSource();
    crack.buffer = crackBuf;
    const crackGain = ctx.createGain();
    crackGain.gain.setValueAtTime(1.0, ctx.currentTime);
    crackGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.06);
    crack.connect(crackGain);
    crackGain.connect(ctx.destination);
    crack.start(ctx.currentTime);

    // Bell ring — two oscillators for richness
    [[880, 0.5], [660, 0.3]].forEach(([freq, vol]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.setValueAtTime(freq as number, ctx.currentTime + 0.04);
      osc.frequency.exponentialRampToValueAtTime((freq as number) * 0.5, ctx.currentTime + 0.5);
      gain.gain.setValueAtTime(0, ctx.currentTime + 0.04);
      gain.gain.linearRampToValueAtTime(vol as number, ctx.currentTime + 0.07);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + 0.04);
      osc.stop(ctx.currentTime + 2.2);
    });
  } catch { /* AudioContext may be blocked — ignore */ }
}
