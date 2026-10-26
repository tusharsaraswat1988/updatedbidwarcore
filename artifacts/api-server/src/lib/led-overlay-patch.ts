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

/** Two-line prize plate held on the auction lower third until the operator closes it. */
export type PrizePlate = {
  line1: string;
  line2: string;
};

export type PresentationContextState = {
  context: "auction" | "top5" | "team";
  selectedTeamId: number | null;
  /** Monotonic presentation revision. Missing persisted values are revision 0. */
  revision: number;
  /** Present only while a prize plate is on air. Omitted when idle so older snapshots stay unchanged. */
  prize?: PrizePlate | null;
};

export function readPrizePlate(value: unknown): PrizePlate | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const line1 = typeof raw.line1 === "string" ? raw.line1.trim() : "";
  const line2 = typeof raw.line2 === "string" ? raw.line2.trim() : "";
  if (!line1 || line1.length > 100 || !line2 || line2.length > 180) return null;
  return { line1, line2 };
}

/** Drop an idle prize so persisted JSON keeps the original three fields. */
export function presentationRecord(state: PresentationContextState): PresentationContextState {
  const base: PresentationContextState = {
    context: state.context,
    selectedTeamId: state.selectedTeamId,
    revision: state.revision,
  };
  return state.prize ? { ...base, prize: state.prize } : base;
}

export const DEFAULT_PRESENTATION_CONTEXT_STATE: PresentationContextState = {
  context: "auction",
  selectedTeamId: null,
  revision: 0,
};

function readPresentationRevision(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0;
}

/** Parse persisted `obsContextJson` (current or legacy `{ screen }` payloads). */
export function parsePersistedPresentationContext(raw: unknown): PresentationContextState {
  let value = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw) as unknown;
    } catch {
      return { ...DEFAULT_PRESENTATION_CONTEXT_STATE };
    }
  }
  if (!value || typeof value !== "object") {
    return { ...DEFAULT_PRESENTATION_CONTEXT_STATE };
  }
  const parsed = value as Record<string, unknown>;
  const selectedTeamId = typeof parsed.selectedTeamId === "number" ? parsed.selectedTeamId : null;
  const revision = readPresentationRevision(parsed.revision);
  const prize = readPrizePlate(parsed.prize);
  if (typeof parsed.context === "string") {
    return presentationRecord({
      context: parsed.context === "top5" || parsed.context === "team" ? parsed.context : "auction",
      selectedTeamId,
      revision,
      prize,
    });
  }
  const screen = typeof parsed.screen === "string" ? parsed.screen : undefined;
  return presentationRecord({
    context: screen === "top5" || screen === "team" ? screen : "auction",
    selectedTeamId,
    revision,
    prize,
  });
}

/**
 * LED TEAM / PLAYER / TOP 5 / BANNER stay independent of OBS.
 * LED MAIN VIEW is the canonical live-auction screen — OBS must follow it back.
 */
export function presentationContextAfterLedOverlay(
  mode: LedOverlayMode,
  current: PresentationContextState,
): PresentationContextState {
  if (mode === "off") {
    return presentationRecord({
      context: "auction",
      selectedTeamId: current.selectedTeamId,
      revision: current.revision + 1,
      prize: current.prize ?? null,
    });
  }
  return current;
}

export type LiveAuctionSessionWrite = LedOverlaySessionPatch & {
  obsContextJson: string;
};

/**
 * Fields to persist when a player is put on the block.
 * LED Team / Player / Top 5 / Banner and OBS Top 5 / Team Details all return
 * to the live auction together. The selected team is kept for the next Team view.
 */
export function liveAuctionSessionWrite(currentObsJson: unknown): LiveAuctionSessionWrite {
  const presentationContext = presentationContextAfterLedOverlay(
    "off",
    parsePersistedPresentationContext(currentObsJson),
  );
  return {
    ...ledOverlaySessionPatch("off"),
    obsContextJson: JSON.stringify(presentationContext),
  };
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
