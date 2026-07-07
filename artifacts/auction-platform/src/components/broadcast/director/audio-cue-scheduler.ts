import type { BroadcastAudioCue, BroadcastAudioCueKind } from "./types";
import type { BroadcastSceneId } from "../types";

let cueCounter = 0;

export class BroadcastAudioCueScheduler {
  private fired = new Set<string>();

  buildCue(
    kind: BroadcastAudioCueKind,
    sceneId: BroadcastSceneId,
    fireOnce = true,
  ): BroadcastAudioCue {
    cueCounter += 1;
    return {
      id: `${kind}-${sceneId}-${cueCounter}`,
      kind,
      sceneId,
      fireOnce,
    };
  }

  filterNew(cues: BroadcastAudioCue[]): BroadcastAudioCue[] {
    return cues.filter((c) => {
      if (!c.fireOnce) return true;
      if (this.fired.has(c.id)) return false;
      this.fired.add(c.id);
      return true;
    });
  }

  reset(): void {
    this.fired.clear();
  }
}

export function sceneEnterCueKind(sceneId: BroadcastSceneId): BroadcastAudioCueKind | null {
  switch (sceneId) {
    case "SOLD":
      return "sold";
    case "UNSOLD":
      return "unsold";
    case "BREAK":
      return "break-music-start";
    default:
      return "scene-enter";
  }
}

export function sceneExitCueKind(from: BroadcastSceneId): BroadcastAudioCueKind | null {
  if (from === "BREAK") return "break-music-stop";
  return null;
}
