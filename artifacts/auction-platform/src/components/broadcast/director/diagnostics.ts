/** BroadcastDirector runtime diagnostics — dev/OBS performance monitoring. */
export type BroadcastDirectorDiagnostics = {
  frameCount: number;
  directorRebuildCount: number;
  frameBuilderCalls: number;
  frameCacheHits: number;
  frameCacheMisses: number;
  eventQueueHighWater: number;
  preloadHits: number;
  preloadMisses: number;
  reactSetFrameCalls: number;
  reactSetFrameSkipped: number;
};

export class BroadcastDirectorDiagnosticsTracker {
  readonly stats: BroadcastDirectorDiagnostics = {
    frameCount: 0,
    directorRebuildCount: 0,
    frameBuilderCalls: 0,
    frameCacheHits: 0,
    frameCacheMisses: 0,
    eventQueueHighWater: 0,
    preloadHits: 0,
    preloadMisses: 0,
    reactSetFrameCalls: 0,
    reactSetFrameSkipped: 0,
  };

  logIntervalMs = 30_000;
  private lastLogAt = 0;

  recordFrameBuilderCall(): void {
    this.stats.frameBuilderCalls += 1;
  }

  recordFrameCacheHit(): void {
    this.stats.frameCacheHits += 1;
    this.stats.frameCount += 1;
  }

  recordFrameCacheMiss(): void {
    this.stats.frameCacheMisses += 1;
    this.stats.frameCount += 1;
  }

  recordEventQueueSize(size: number): void {
    if (size > this.stats.eventQueueHighWater) {
      this.stats.eventQueueHighWater = size;
    }
  }

  recordPreloadHit(): void {
    this.stats.preloadHits += 1;
  }

  recordPreloadMiss(): void {
    this.stats.preloadMisses += 1;
  }

  syncPreloadStats(hits: number, misses: number): void {
    this.stats.preloadHits = hits;
    this.stats.preloadMisses = misses;
  }

  recordDirectorRebuild(): void {
    this.stats.directorRebuildCount += 1;
  }

  recordSetFrame(applied: boolean): void {
    if (applied) this.stats.reactSetFrameCalls += 1;
    else this.stats.reactSetFrameSkipped += 1;
  }

  maybeLog(label = "BroadcastDirector"): void {
    if (typeof window === "undefined") return;
    const now = Date.now();
    if (now - this.lastLogAt < this.logIntervalMs) return;
    this.lastLogAt = now;
    console.info(`[${label}]`, { ...this.stats });
  }
}

export const broadcastDirectorDiagnostics = new BroadcastDirectorDiagnosticsTracker();
