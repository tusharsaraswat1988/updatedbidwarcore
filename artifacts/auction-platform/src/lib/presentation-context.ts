/** Explicit on-air presentation — decoupled from operator UI navigation. */
export type PresentationContextKind = "auction" | "top5" | "team";

/** Resolved lower-third module (includes auction-driven scenes). */
export type BroadcastCurrentContext =
  | "AUCTION"
  | "TOP5"
  | "TEAM"
  | "BREAK"
  | "WAITING"
  | "SUMMARY";

export type PresentationContext = {
  context: PresentationContextKind;
  selectedTeamId: number | null;
};

export const DEFAULT_PRESENTATION_CONTEXT: PresentationContext = {
  context: "auction",
  selectedTeamId: null,
};

const PRESENTATION_KINDS = new Set<PresentationContextKind>(["auction", "top5", "team"]);

function normalizeKind(raw: string | undefined): PresentationContextKind {
  if (raw === "top5" || raw === "team") return raw;
  return "auction";
}

/** Parse server snapshot — accepts legacy obsContext payloads. */
export function parsePresentationContext(raw: unknown): PresentationContext {
  if (!raw || typeof raw !== "object") return DEFAULT_PRESENTATION_CONTEXT;
  const value = raw as Record<string, unknown>;

  if (typeof value.context === "string" && PRESENTATION_KINDS.has(value.context as PresentationContextKind)) {
    return {
      context: value.context as PresentationContextKind,
      selectedTeamId: typeof value.selectedTeamId === "number" ? value.selectedTeamId : null,
    };
  }

  // Legacy: { syncWithScreen, screen, selectedTeamId }
  const legacyScreen = typeof value.screen === "string" ? value.screen : undefined;
  const legacyKind =
    legacyScreen === "top5" || legacyScreen === "team" ? legacyScreen : "auction";

  return {
    context: legacyKind,
    selectedTeamId: typeof value.selectedTeamId === "number" ? value.selectedTeamId : null,
  };
}

export function presentationContextToBroadcast(
  kind: PresentationContextKind,
): Exclude<BroadcastCurrentContext, "BREAK" | "WAITING" | "SUMMARY"> {
  switch (kind) {
    case "top5":
      return "TOP5";
    case "team":
      return "TEAM";
    case "auction":
    default:
      return "AUCTION";
  }
}

export function presentationContextLabel(context: PresentationContextKind): string {
  switch (context) {
    case "top5":
      return "Top 5";
    case "team":
      return "Team Details";
    case "auction":
    default:
      return "Live Auction";
  }
}
