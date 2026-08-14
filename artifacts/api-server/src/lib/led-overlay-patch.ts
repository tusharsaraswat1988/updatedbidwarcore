/** LED overlay fields written by operator Team / Player / Top5 / Banner / MAIN. */
export type LedOverlayMode = "off" | "team" | "player" | "top5" | "banner";

export type LedOverlaySessionPatch = {
  displayOverlay: "team" | "player" | "top5" | "banner" | null;
  teamPurseViewActive: boolean;
  fortuneWheelActive: false;
  wheelSpinning: false;
};

type LedOverlayRememberedPatch = Pick<LedOverlaySessionPatch, "displayOverlay" | "teamPurseViewActive">;

/** Keep the latest overlay on in-flight rebuilds so a stale DB read cannot revert Top 5. */
export const LED_OVERLAY_PATCH_TTL_MS = 3_000;

type OverlayPatchEntry = {
  patch: LedOverlayRememberedPatch;
  expiresAt: number;
};

const overlayPatches = new Map<number, OverlayPatchEntry>();

export function ledOverlaySessionPatch(mode: LedOverlayMode): LedOverlaySessionPatch {
  const overlay = mode === "off" ? null : mode;
  return {
    displayOverlay: overlay,
    teamPurseViewActive: overlay !== null,
    fortuneWheelActive: false,
    wheelSpinning: false,
  };
}

export function overlayModeFromPresentationContext(
  context: "auction" | "top5" | "team",
): LedOverlayMode {
  if (context === "top5") return "top5";
  if (context === "team") return "team";
  return "off";
}

export function rememberLedOverlayPatch(
  tournamentId: number,
  patch: LedOverlayRememberedPatch,
  ttlMs = LED_OVERLAY_PATCH_TTL_MS,
): void {
  overlayPatches.set(tournamentId, {
    patch: {
      displayOverlay: patch.displayOverlay,
      teamPurseViewActive: patch.teamPurseViewActive,
    },
    expiresAt: Date.now() + ttlMs,
  });
}

export function applyRememberedLedOverlayPatch<T extends Record<string, unknown>>(
  tournamentId: number,
  state: T,
): T {
  const entry = overlayPatches.get(tournamentId);
  if (!entry) return state;
  if (Date.now() >= entry.expiresAt) {
    overlayPatches.delete(tournamentId);
    return state;
  }
  Object.assign(state, entry.patch);
  return state;
}

export function resetLedOverlayPatchesForTests(): void {
  overlayPatches.clear();
}
