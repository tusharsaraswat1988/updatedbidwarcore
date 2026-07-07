import type { BroadcastSceneId } from "../types";
import type { DirectorContext } from "./types";
import { SOLD_SCENE_MIN_HOLD_MS } from "../obs/obs-tokens";

export type SceneResolution = {
  sceneId: BroadcastSceneId;
  sceneHoldMs: number;
  returnSceneId: BroadcastSceneId | null;
  ephemeral: boolean;
};

/**
 * Resolves which scene the director should render from auction context.
 * Priority: ephemeral SOLD/UNSOLD → BREAK → WAITING → SUMMARY → AUCTION
 */
export function resolveBaseScene(ctx: DirectorContext): BroadcastSceneId {
  const isBreak = ctx.settings.enableBreakMode && ctx.displayIsBreak && !!ctx.breakEndsAt;
  if (isBreak) return "BREAK";

  if (ctx.auctionStatus === "completed" && ctx.settings.autoSummary) return "SUMMARY";

  if (ctx.auctionStatus === "active") return "AUCTION";

  if ((ctx.auctionStatus === "idle" || ctx.auctionStatus === "paused") && !ctx.currentPlayerId) {
    return "WAITING";
  }

  return "AUCTION";
}

export function resolveEphemeralScene(ctx: DirectorContext): SceneResolution | null {
  if (ctx.outcomeType === "sold" && ctx.settings.enableSoldAnimation && ctx.soldPlayerName) {
    return {
      sceneId: "SOLD",
      sceneHoldMs: Math.max(ctx.settings.soldAnimationDurationMs, SOLD_SCENE_MIN_HOLD_MS),
      returnSceneId: "AUCTION",
      ephemeral: true,
    };
  }

  if (ctx.outcomeType === "unsold" && ctx.unsoldPlayerName) {
    return {
      sceneId: "UNSOLD",
      sceneHoldMs: ctx.settings.soldAnimationDurationMs,
      returnSceneId: "AUCTION",
      ephemeral: true,
    };
  }

  return null;
}

export function resolveScene(ctx: DirectorContext, inEphemeralHold: boolean): SceneResolution {
  if (inEphemeralHold) {
    const ep = resolveEphemeralScene(ctx);
    if (ep) return ep;
  }

  return {
    sceneId: resolveBaseScene(ctx),
    sceneHoldMs: 0,
    returnSceneId: null,
    ephemeral: false,
  };
}
