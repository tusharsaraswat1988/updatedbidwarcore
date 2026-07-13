/**
 * Pure helpers for Scorer Home match cards — no DB imports.
 */

export type ScorerHomeUiStatus = "READY" | "LIVE" | "PAUSED" | "COMPLETED";

export type ScorerHomeMatchCard = {
  id: number;
  category: string | null;
  playerA: string;
  playerB: string;
  court: string | null;
  scheduledAt: string | null;
  status: ScorerHomeUiStatus;
  matchStatus: string;
  actionLabel: "Start Scoring" | "Resume" | "Read Only";
  readOnly: boolean;
};

export function sideDisplayLabel(side: Record<string, unknown> | null | undefined): string {
  if (!side) return "TBD";
  if (typeof side.label === "string" && side.label.trim()) return side.label.trim();
  if (typeof side.shortLabel === "string" && side.shortLabel.trim()) return side.shortLabel.trim();
  if (typeof side.displayName === "string" && side.displayName.trim()) return side.displayName.trim();
  return "TBD";
}

export function mapMatchStatusToScorerHomeUi(rawStatus: string): {
  status: ScorerHomeUiStatus;
  actionLabel: ScorerHomeMatchCard["actionLabel"];
  readOnly: boolean;
} {
  const status = rawStatus.trim().toLowerCase();
  if (status === "live") {
    return { status: "LIVE", actionLabel: "Resume", readOnly: false };
  }
  if (status === "paused") {
    return { status: "PAUSED", actionLabel: "Resume", readOnly: false };
  }
  if (
    status === "completed" ||
    status === "walkover" ||
    status === "retired" ||
    status === "disqualified" ||
    status === "abandoned"
  ) {
    return { status: "COMPLETED", actionLabel: "Read Only", readOnly: true };
  }
  // scheduled + any unknown pre-start status
  return { status: "READY", actionLabel: "Start Scoring", readOnly: false };
}
