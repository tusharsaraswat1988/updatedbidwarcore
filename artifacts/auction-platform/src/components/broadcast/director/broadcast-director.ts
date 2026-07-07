import type { BroadcastSceneId } from "../types";
import {
  BroadcastAudioCueScheduler,
  sceneEnterCueKind,
  sceneExitCueKind,
} from "./audio-cue-scheduler";
import { broadcastDirectorDiagnostics } from "./diagnostics";
import { BroadcastEventQueue } from "./event-queue";
import { assembleFrame } from "./frame-builder";
import { adaptFrameForOutput } from "./output-adapters";
import { BroadcastPreloadManager } from "./preload-manager";
import { resolveBaseScene, resolveEphemeralScene } from "./scene-resolver";
import { computeDirectorSnapshotKey } from "./snapshot-key";
import type {
  BidTimelineItemModel,
  BroadcastAudioCue,
  BroadcastEvent,
  BroadcastFrame,
  DirectorContext,
  DirectorTickResult,
} from "./types";

export type EphemeralSceneSnapshot = {
  outcomeType: "sold" | "unsold";
  outcomeKey: string | null;
  outcomeIsManual: boolean;
  soldPlayerName: string | null;
  soldPhotoUrl: string | null;
  soldAmount: number | null;
  soldTeamName: string | null;
  soldTeamColor: string | null;
  soldTeamLogoUrl: string | null;
  unsoldPlayerName: string | null;
  unsoldPhotoUrl: string | null;
};

export type BroadcastDirectorState = {
  sceneId: BroadcastSceneId;
  previousSceneId: BroadcastSceneId | null;
  isTransitioning: boolean;
  inEphemeralHold: boolean;
  ephemeralReturnSceneId: BroadcastSceneId | null;
  ephemeralHoldUntilMs: number;
  ephemeralHoldDurationMs: number;
  ephemeralHoldKey: string | null;
  ephemeralSceneSnapshot: EphemeralSceneSnapshot | null;
  bidTimeline: BidTimelineItemModel[];
  lastOutcomeKey: string | null;
  initialOutcomeSeen: boolean;
  lastPlayerId: number | null;
  lastBid: number | null;
  frameCounter: number;
};

const INITIAL_STATE: BroadcastDirectorState = {
  sceneId: "WAITING",
  previousSceneId: null,
  isTransitioning: false,
  inEphemeralHold: false,
  ephemeralReturnSceneId: null,
  ephemeralHoldUntilMs: 0,
  ephemeralHoldDurationMs: 0,
  ephemeralHoldKey: null,
  ephemeralSceneSnapshot: null,
  bidTimeline: [],
  lastOutcomeKey: null,
  initialOutcomeSeen: false,
  lastPlayerId: null,
  lastBid: null,
  frameCounter: 0,
};

/**
 * BroadcastDirector — single source of truth for broadcast orchestration.
 * Owns scene resolution, transitions, event queue, preloads, audio cues, layout, and frame assembly.
 */
export class BroadcastDirector {
  readonly events = new BroadcastEventQueue();
  readonly preloads = new BroadcastPreloadManager();
  readonly audio = new BroadcastAudioCueScheduler();

  private state: BroadcastDirectorState = { ...INITIAL_STATE };
  private cachedFrame: BroadcastFrame | null = null;
  private cachedSnapshotKey: string | null = null;
  private lastAudioSceneId: BroadcastSceneId | null = null;
  private lastIngestSignature = "";

  reset(): void {
    this.state = { ...INITIAL_STATE };
    this.cachedFrame = null;
    this.cachedSnapshotKey = null;
    this.lastAudioSceneId = null;
    this.lastIngestSignature = "";
    this.events.clear();
    this.preloads.reset();
    this.audio.reset();
  }

  getState(): Readonly<BroadcastDirectorState> {
    return this.state;
  }

  pushEvent(type: BroadcastEvent["type"], payload?: Record<string, unknown>): void {
    this.events.enqueue({
      id: `${type}-${Date.now()}`,
      type,
      at: Date.now(),
      payload,
    });
  }

  tick(ctx: DirectorContext): DirectorTickResult {
    this.ingestContextEvents(ctx);
    this.events.drain();

    this.updateBidTimeline(ctx);
    this.processOutcomeAndScenes(ctx);

    const frameCtx = this.applyEphemeralSnapshot(ctx);
    const snapshotKey = computeDirectorSnapshotKey(frameCtx, this.state);
    const holdMs = this.state.inEphemeralHold
      ? Math.max(0, this.state.ephemeralHoldUntilMs - ctx.nowMs)
      : 0;
    const holdDurationMs = this.state.inEphemeralHold ? this.state.ephemeralHoldDurationMs : 0;

    if (this.cachedFrame && this.cachedSnapshotKey === snapshotKey) {
      broadcastDirectorDiagnostics.recordFrameCacheHit();
      broadcastDirectorDiagnostics.recordEventQueueSize(this.events.size);
      broadcastDirectorDiagnostics.syncPreloadStats(this.preloads.hits, this.preloads.misses);
      broadcastDirectorDiagnostics.maybeLog();
      return {
        frame: this.cachedFrame,
        sceneHoldMs: holdMs,
        sceneHoldDurationMs: holdDurationMs,
        returnSceneId: this.state.ephemeralReturnSceneId,
      };
    }

    broadcastDirectorDiagnostics.recordFrameBuilderCall();
    broadcastDirectorDiagnostics.recordFrameCacheMiss();

    const audioCues = this.buildAudioCues();
    const result = assembleFrame(
      this.state.sceneId,
      this.state.previousSceneId,
      this.state.isTransitioning,
      frameCtx,
      this.state.bidTimeline,
      audioCues,
      holdMs,
      this.state.ephemeralReturnSceneId,
      this.state.frameCounter,
    );

    this.state.frameCounter += 1;
    const freshUrls = this.preloads.schedule(result.frame.preloadUrls);
    result.frame.preloadUrls = freshUrls;

    const adapted = adaptFrameForOutput(result.frame, ctx.outputTarget);
    const frame: BroadcastFrame = {
      ...adapted,
      audioCues: this.audio.filterNew(adapted.audioCues),
    };

    this.cachedFrame = frame;
    this.cachedSnapshotKey = snapshotKey;

    broadcastDirectorDiagnostics.recordEventQueueSize(this.events.size);
    broadcastDirectorDiagnostics.syncPreloadStats(this.preloads.hits, this.preloads.misses);
    broadcastDirectorDiagnostics.maybeLog();

    return {
      ...result,
      frame,
      sceneHoldDurationMs: holdDurationMs,
    };
  }

  private applyEphemeralSnapshot(ctx: DirectorContext): DirectorContext {
    const snap = this.state.ephemeralSceneSnapshot;
    if (!this.state.inEphemeralHold || !snap) return ctx;
    return {
      ...ctx,
      outcomeType: snap.outcomeType,
      outcomeKey: snap.outcomeKey,
      outcomeIsManual: snap.outcomeIsManual,
      soldPlayerName: snap.soldPlayerName,
      soldPhotoUrl: snap.soldPhotoUrl,
      soldAmount: snap.soldAmount,
      soldTeamName: snap.soldTeamName,
      soldTeamColor: snap.soldTeamColor,
      soldTeamLogoUrl: snap.soldTeamLogoUrl,
      unsoldPlayerName: snap.unsoldPlayerName,
      unsoldPhotoUrl: snap.unsoldPhotoUrl,
    };
  }

  completeTransition(): void {
    if (!this.state.isTransitioning) return;
    this.state.isTransitioning = false;
    this.cachedSnapshotKey = null;
  }

  completeEphemeralHold(ctx: DirectorContext): void {
    if (!this.state.inEphemeralHold) return;
    this.state.inEphemeralHold = false;
    this.state.ephemeralHoldUntilMs = 0;
    this.state.ephemeralHoldDurationMs = 0;
    this.state.ephemeralHoldKey = null;
    this.state.ephemeralSceneSnapshot = null;
    this.state.ephemeralReturnSceneId = null;
    this.cachedSnapshotKey = null;
    const next = resolveBaseScene(ctx);
    this.transitionTo(next);
  }

  private ingestContextEvents(ctx: DirectorContext): void {
    const signature = [
      ctx.auctionStatus,
      ctx.isStaleFeed ? "1" : "0",
      ctx.displayIsBreak ? "1" : "0",
    ].join("|");
    if (signature === this.lastIngestSignature) return;
    this.lastIngestSignature = signature;

    if (ctx.isStaleFeed) this.pushEvent("feed.stale");
    else this.pushEvent("feed.recovered");
    if (ctx.displayIsBreak) this.pushEvent("break.started");
    if (ctx.auctionStatus === "completed") this.pushEvent("auction.completed");
    if (ctx.auctionStatus === "active") this.pushEvent("auction.started");
    if (ctx.auctionStatus === "paused") this.pushEvent("auction.paused");
  }

  private updateBidTimeline(ctx: DirectorContext): void {
    if (this.state.inEphemeralHold) return;

    const playerId = ctx.currentPlayerId;
    if (playerId !== this.state.lastPlayerId) {
      this.state.lastPlayerId = playerId;
      this.state.lastBid = null;
      this.state.bidTimeline = [];
      this.cachedSnapshotKey = null;
      if (playerId) this.pushEvent("player.changed", { playerId });
      return;
    }

    const bid = ctx.currentBid;
    if (
      bid != null &&
      ctx.currentBidTeamName &&
      ctx.currentBidTeamId != null &&
      bid !== this.state.lastBid
    ) {
      this.state.lastBid = bid;
      this.state.bidTimeline = [
        ...this.state.bidTimeline.slice(-7),
        {
          id: `${playerId}-${bid}`,
          teamName: ctx.currentBidTeamName,
          teamColor: ctx.currentBidTeamColor,
          amountLabel: ctx.formatAmount(bid),
        },
      ];
      this.cachedSnapshotKey = null;
      this.pushEvent("bid.placed", { amount: bid, team: ctx.currentBidTeamName });
    }
  }

  private processOutcomeAndScenes(ctx: DirectorContext): void {
    if (this.state.inEphemeralHold) {
      if (ctx.nowMs >= this.state.ephemeralHoldUntilMs) {
        this.completeEphemeralHold(ctx);
      }
      return;
    }

    const outcomeKey = ctx.outcomeKey;
    if (outcomeKey) {
      if (!this.state.initialOutcomeSeen) {
        this.state.initialOutcomeSeen = true;
        this.state.lastOutcomeKey = outcomeKey;
      } else if (outcomeKey !== this.state.lastOutcomeKey) {
        this.state.lastOutcomeKey = outcomeKey;
        const ephemeral = resolveEphemeralScene(ctx);
        if (ephemeral) {
          if (ctx.outcomeType === "sold") this.pushEvent("player.sold", { key: outcomeKey });
          if (ctx.outcomeType === "unsold") this.pushEvent("player.unsold", { key: outcomeKey });
          this.beginEphemeralScene(
            ctx,
            ephemeral.sceneId,
            ephemeral.sceneHoldMs,
            ephemeral.returnSceneId ?? "AUCTION",
          );
          return;
        }
      }
    } else if (!this.state.initialOutcomeSeen && ctx.auctionStatus) {
      this.state.initialOutcomeSeen = true;
    }

    const base = resolveBaseScene(ctx);
    if (base !== this.state.sceneId) {
      this.transitionTo(base);
    }
  }

  private beginEphemeralScene(
    ctx: DirectorContext,
    sceneId: BroadcastSceneId,
    holdMs: number,
    returnSceneId: BroadcastSceneId,
  ): void {
    this.transitionTo(sceneId);
    this.state.inEphemeralHold = true;
    this.state.ephemeralHoldDurationMs = holdMs;
    this.state.ephemeralHoldUntilMs = Date.now() + holdMs;
    this.state.ephemeralReturnSceneId = returnSceneId;
    this.state.ephemeralHoldKey = ctx.outcomeKey ?? sceneId;
    this.state.ephemeralSceneSnapshot = {
      outcomeType: ctx.outcomeType === "unsold" ? "unsold" : "sold",
      outcomeKey: ctx.outcomeKey,
      outcomeIsManual: ctx.outcomeIsManual,
      soldPlayerName: ctx.soldPlayerName,
      soldPhotoUrl: ctx.soldPhotoUrl,
      soldAmount: ctx.soldAmount,
      soldTeamName: ctx.soldTeamName,
      soldTeamColor: ctx.soldTeamColor,
      soldTeamLogoUrl: ctx.soldTeamLogoUrl,
      unsoldPlayerName: ctx.unsoldPlayerName,
      unsoldPhotoUrl: ctx.unsoldPhotoUrl,
    };
  }

  private transitionTo(next: BroadcastSceneId): void {
    if (this.state.sceneId === next) return;
    const from = this.state.sceneId;
    this.state.previousSceneId = from;
    this.state.sceneId = next;
    this.state.isTransitioning = true;
    this.cachedSnapshotKey = null;
    this.pushEvent("scene.transition", { from, to: next });
  }

  private buildAudioCues(): BroadcastAudioCue[] {
    const sceneId = this.state.sceneId;
    if (sceneId === this.lastAudioSceneId && !this.state.isTransitioning) {
      return [];
    }

    const cues: BroadcastAudioCue[] = [];
    const enterKind = sceneEnterCueKind(sceneId);
    if (enterKind) cues.push(this.audio.buildCue(enterKind, sceneId));

    if (this.state.previousSceneId && this.state.isTransitioning) {
      const exitKind = sceneExitCueKind(this.state.previousSceneId);
      if (exitKind) cues.push(this.audio.buildCue(exitKind, this.state.previousSceneId));
    }

    if (!this.state.isTransitioning) {
      this.lastAudioSceneId = sceneId;
    }

    return cues;
  }

  getFrameSnapshot(ctx: DirectorContext): BroadcastFrame {
    return this.tick(ctx).frame;
  }
}

export const broadcastDirector = new BroadcastDirector();
