import type { PublicMatch, PublicTournamentMeta } from "@/lib/public-tournament-types";
import { isTerminalCricketMatchStatus } from "@/lib/scoring-api";

export function parseMatchDates(matchDates: string | null | undefined): string[] {
  if (!matchDates?.trim()) return [];
  return matchDates
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean);
}

export function formatDateRange(matchDates: string | null | undefined): string | null {
  const dates = parseMatchDates(matchDates);
  if (dates.length === 0) return null;
  const formatted = dates.map((iso) => {
    const d = new Date(iso.includes("T") ? iso : `${iso}T12:00:00`);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  });
  if (formatted.length === 1) return formatted[0];
  return `${formatted[0]} – ${formatted[formatted.length - 1]}`;
}

export function venueLabel(tournament: PublicTournamentMeta): string | null {
  const parts = [tournament.venue, tournament.city].filter((p) => p?.trim());
  return parts.length ? parts.join(" · ") : null;
}

export function tournamentStageLabel(tournament: PublicTournamentMeta): string {
  const phase = (tournament.scoringPhase ?? "").toLowerCase();
  const status = (tournament.status ?? "").toLowerCase();
  if (phase === "live" || status === "live") return "Live";
  if (phase === "completed" || phase === "finished" || status === "completed") return "Completed";
  if (phase === "scheduled" || phase === "ready") return "Match day";
  if (phase && phase !== "disabled") {
    return phase.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
  if (status === "setup") return "Setup";
  if (status) return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return "Tournament";
}

export function isSameCalendarDay(iso: string | null | undefined, day = new Date()): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  return (
    d.getFullYear() === day.getFullYear() &&
    d.getMonth() === day.getMonth() &&
    d.getDate() === day.getDate()
  );
}

export function partitionMatches(matches: PublicMatch[]) {
  const live = matches.filter((m) => m.status === "live");
  const upcoming = matches.filter((m) => m.status === "scheduled");
  const completed = matches.filter((m) => isTerminalCricketMatchStatus(m.status));
  const today = matches.filter(
    (m) => isSameCalendarDay(m.scheduledAt) || m.status === "live",
  );
  return { live, upcoming, completed, today };
}

export function currentStageFromDraws(
  draws: Array<{ name?: string | null; status?: string | null; format?: string | null }>,
  liveRound: string | null | undefined,
): string | null {
  if (liveRound?.trim()) return liveRound.trim();
  const active = draws.find((d) => d.status === "active" || d.status === "published");
  if (active?.name) return active.name;
  const first = draws[0];
  if (first?.name) return first.name;
  if (first?.format) return first.format.replace(/_/g, " ");
  return null;
}

export function scorelineFromSummary(
  summary: Record<string, unknown> | null | undefined,
): string | null {
  if (!summary || typeof summary !== "object") return null;
  const home = summary.homeScore ?? summary.home ?? summary.team1Score;
  const away = summary.awayScore ?? summary.away ?? summary.team2Score;
  if (home != null && away != null) return `${home} · ${away}`;
  if (typeof summary.scoreline === "string") return summary.scoreline;
  if (typeof summary.displayScore === "string") return summary.displayScore;
  return null;
}
