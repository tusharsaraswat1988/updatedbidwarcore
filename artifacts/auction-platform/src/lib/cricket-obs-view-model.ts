/**
 * Cricket OBS scorebug view-model — pure mapping from authoritative live state.
 * No scoring writes. No engine resolution. Paint preservation lives here.
 */

import type { BallDisplayOutcome, CricketScoreboardState } from "@workspace/scoring-core";
import type { CricketMatchSummary } from "@workspace/scoring-core";
import {
  getActiveInnings,
  oversText,
  requiredRate,
  runRate,
} from "@/lib/scoring-ball";
import type { ScoringLiveDisplay, ScoringMatchJson } from "@/lib/scoring-api";
import {
  getDisplayThemeFromPresentationPaint,
  type PresentationPaintJson,
} from "@/lib/display-theme";
import type { CricketScorerTeam } from "@/lib/scoring-squad";
import type { SponsorLogo } from "@/lib/sponsor-logo";
import {
  BIDWAR_BROADCAST_YELLOW,
  BIDWAR_SCOREBOARD_PANEL,
  BIDWAR_SCOREBOARD_SHELL,
} from "@/lib/bidwar-broadcast-colors";

export type CricketObsPhase =
  | "no_live"
  | "pre_match"
  | "live"
  | "innings_break"
  | "chase"
  | "completed"
  | "match_unavailable"
  | "reconnecting";

export type CricketObsFlashKind = "FOUR" | "SIX" | "WICKET" | "WIDE" | "NO_BALL";

export type CricketObsTeamView = {
  id: number;
  name: string;
  shortCode: string;
  logoUrl: string | null;
  color: string | null;
};

export type CricketObsTheme = {
  accent: string;
  accentOn: string;
  shell: string;
  panel: string;
  text: string;
  sponsorStripEnabled: boolean;
};

export type CricketObsViewModel = {
  phase: CricketObsPhase;
  matchId: number | null;
  tournamentName: string;
  tournamentLogoUrl: string | null;
  home: CricketObsTeamView | null;
  away: CricketObsTeamView | null;
  batting: CricketObsTeamView | null;
  bowling: CricketObsTeamView | null;
  winner: CricketObsTeamView | null;
  runs: number;
  wickets: number;
  oversLabel: string;
  oversLimit: number;
  oversDisplay: string;
  crr: string | null;
  rrr: string | null;
  target: number | null;
  needRuns: number | null;
  ballsRemaining: number | null;
  thisOverLabels: string[];
  resultText: string | null;
  resultHeadline: string | null;
  firstInningsScoreLine: string | null;
  theme: CricketObsTheme;
  branding: PresentationPaintJson | null;
  sponsors: SponsorLogo[];
  showSponsorSlot: boolean;
  connectionHint: "none" | "reconnecting";
  flash: CricketObsFlashKind | null;
  flashToken: string | null;
};

const DEFAULT_THEME: CricketObsTheme = {
  accent: BIDWAR_BROADCAST_YELLOW,
  accentOn: "#0c0c10",
  shell: BIDWAR_SCOREBOARD_SHELL,
  panel: BIDWAR_SCOREBOARD_PANEL,
  text: "#ffffff",
  sponsorStripEnabled: false,
};

function teamView(
  teams: CricketScorerTeam[],
  id: number | null | undefined,
): CricketObsTeamView | null {
  if (id == null) return null;
  const t = teams.find((x) => x.id === id);
  if (!t) {
    return {
      id,
      name: `Team ${id}`,
      shortCode: `T${id}`,
      logoUrl: null,
      color: null,
    };
  }
  return {
    id: t.id,
    name: t.name,
    shortCode: t.shortCode,
    logoUrl: t.logoUrl && !t.logoUrl.startsWith("data:") ? t.logoUrl : null,
    color: t.color,
  };
}

/** Legal balls remaining in the innings (6-ball overs). */
export function ballsRemaining(oversLimit: number, over: number, ball: number): number {
  return Math.max(0, oversLimit * 6 - (over * 6 + ball));
}

/**
 * Map a ball display row to a broadcast flash.
 * Only uses explicit fields / labels from authoritative thisOver — no guessing.
 */
export function mapBallToFlash(ball: BallDisplayOutcome | null | undefined): CricketObsFlashKind | null {
  if (!ball) return null;
  if (ball.isWicket) return "WICKET";
  if (ball.extrasType === "wide" || ball.label === "Wd" || ball.label.startsWith("Wd+")) {
    return "WIDE";
  }
  if (ball.extrasType === "no_ball" || ball.label === "Nb" || ball.label.startsWith("Nb+")) {
    return "NO_BALL";
  }
  // Boundaries: only when runs off the bat are exactly 4 or 6 (not extras-inflated totals).
  if (ball.runsOffBat === 6 && !ball.extrasType) return "SIX";
  if (ball.runsOffBat === 4 && !ball.extrasType) return "FOUR";
  if (ball.label === "6") return "SIX";
  if (ball.label === "4") return "FOUR";
  return null;
}

export function flashTokenForBall(
  matchId: number | null,
  sequence: number | null,
  ball: BallDisplayOutcome | null | undefined,
): string | null {
  if (!ball || matchId == null) return null;
  return `${matchId}:${sequence ?? 0}:${ball.over}.${ball.ball}:${ball.label}:${ball.isWicket ? "W" : ""}`;
}

/**
 * Preserve REST-hydrated match metadata when SSE pushes a slim match object.
 */
export function mergeLiveDisplayPreserveBranding(
  previous: ScoringLiveDisplay | null | undefined,
  incoming: ScoringLiveDisplay | null | undefined,
): ScoringLiveDisplay | null {
  if (!incoming) return previous ?? null;
  if (!incoming.match) {
    return {
      match: previous?.match ?? null,
      state: incoming.state ?? previous?.state ?? null,
      summary: incoming.summary ?? previous?.summary ?? null,
    };
  }

  const prevMatch = previous?.match;
  const nextMatch = incoming.match;
  const mergedMatch: ScoringMatchJson = {
    ...(prevMatch ?? nextMatch),
    ...nextMatch,
    branding:
      nextMatch.branding != null && Object.keys(nextMatch.branding).length > 0
        ? nextMatch.branding
        : (prevMatch?.branding ?? nextMatch.branding ?? null),
    rules: nextMatch.rules ?? prevMatch?.rules ?? null,
    executionPolicyBind: nextMatch.executionPolicyBind ?? prevMatch?.executionPolicyBind ?? null,
    presentationPolicyBind:
      nextMatch.presentationPolicyBind ?? prevMatch?.presentationPolicyBind ?? null,
    roundName: nextMatch.roundName ?? prevMatch?.roundName ?? null,
    venue: nextMatch.venue ?? prevMatch?.venue ?? null,
    scheduledAt: nextMatch.scheduledAt ?? prevMatch?.scheduledAt ?? null,
  };

  return {
    match: mergedMatch,
    state: incoming.state ?? previous?.state ?? null,
    summary: incoming.summary ?? previous?.summary ?? null,
  };
}

function themeFromPaint(paint: PresentationPaintJson | null | undefined): CricketObsTheme {
  const display = getDisplayThemeFromPresentationPaint(paint);
  return {
    accent: display.accentColor || DEFAULT_THEME.accent,
    accentOn: DEFAULT_THEME.accentOn,
    shell: display.bg || DEFAULT_THEME.shell,
    panel: DEFAULT_THEME.panel,
    text: DEFAULT_THEME.text,
    sponsorStripEnabled: paint?.sponsorStripEnabled === true,
  };
}

function isInningsBreak(state: CricketScoreboardState): boolean {
  if (state.matchStatus !== "live") return false;
  const current = getActiveInnings(state);
  if (!current) return false;
  if (current.phase === "not_started") return true;
  // Fresh chase innings before first ball / crease set.
  if (
    state.target != null &&
    current.phase === "in_progress" &&
    current.runs === 0 &&
    current.wickets === 0 &&
    current.over === 0 &&
    current.ball === 0 &&
    state.strikerId == null
  ) {
    return true;
  }
  return false;
}

function firstInningsScoreLine(
  state: CricketScoreboardState,
  summary: CricketMatchSummary | null,
  teams: CricketScorerTeam[],
): string | null {
  const first =
    summary?.innings.find((i) => i.innings === 1) ??
    state.innings.find((i) => i.innings === 1);
  if (!first) return null;
  const bat = teamView(teams, first.battingTeamId);
  const overs =
    "overs" in first && typeof first.overs === "string"
      ? first.overs
      : oversText(
          (first as { over?: number }).over ?? 0,
          (first as { ball?: number }).ball ?? 0,
        );
  const limit = state.oversLimit;
  return `${bat?.shortCode ?? "T1"}  ${first.runs}/${first.wickets} (${overs}/${limit})`;
}

export type BuildCricketObsViewModelInput = {
  live: ScoringLiveDisplay | null;
  teams: CricketScorerTeam[];
  tournamentName: string;
  tournamentLogoUrl: string | null;
  sponsors: SponsorLogo[];
  /** null = follow tournament live; number = pin to match */
  pinnedMatchId: number | null;
  connectionStatus: "connected" | "reconnecting" | "disconnected";
  /** Previous flash token to avoid inventing flashes without a new ball */
  previousFlashToken?: string | null;
};

export function buildCricketObsViewModel(input: BuildCricketObsViewModelInput): CricketObsViewModel {
  const {
    live,
    teams,
    tournamentName,
    tournamentLogoUrl,
    sponsors,
    pinnedMatchId,
    connectionStatus,
  } = input;

  const paint = (live?.match?.branding as PresentationPaintJson | null | undefined) ?? null;
  const theme = themeFromPaint(paint);
  const showSponsorSlot =
    sponsors.length > 0 && (paint == null || paint.sponsorStripEnabled !== false);

  const base: CricketObsViewModel = {
    phase: "no_live",
    matchId: null,
    tournamentName,
    tournamentLogoUrl,
    home: null,
    away: null,
    batting: null,
    bowling: null,
    winner: null,
    runs: 0,
    wickets: 0,
    oversLabel: "0.0",
    oversLimit: 0,
    oversDisplay: "0.0/0 OV",
    crr: null,
    rrr: null,
    target: null,
    needRuns: null,
    ballsRemaining: null,
    thisOverLabels: [],
    resultText: null,
    resultHeadline: null,
    firstInningsScoreLine: null,
    theme,
    branding: paint,
    sponsors,
    showSponsorSlot,
    connectionHint: connectionStatus === "connected" ? "none" : "reconnecting",
    flash: null,
    flashToken: null,
  };

  if (!live?.match || !live.state) {
    return base;
  }

  const match = live.match;
  const state = live.state;
  const summary = live.summary;

  if (pinnedMatchId != null && match.id !== pinnedMatchId) {
    // Never substitute another match's score under a pinned match URL.
    return {
      ...base,
      phase: "match_unavailable",
      matchId: pinnedMatchId,
    };
  }

  const home = teamView(teams, state.homeTeamId ?? match.homeTeamId);
  const away = teamView(teams, state.awayTeamId ?? match.awayTeamId);
  const innings = getActiveInnings(state);
  const oversLimit = innings?.oversLimit ?? state.oversLimit ?? 0;
  const runs = innings?.runs ?? 0;
  const wickets = innings?.wickets ?? 0;
  const over = innings?.over ?? 0;
  const ball = innings?.ball ?? 0;
  const oversLabel = oversText(over, ball);
  const batting = innings ? teamView(teams, innings.battingTeamId) : null;
  const bowling = innings ? teamView(teams, innings.bowlingTeamId) : null;
  const winner = teamView(teams, state.winnerTeamId ?? match.winnerTeamId);
  const crr = innings && (over > 0 || ball > 0 || runs > 0) ? runRate(runs, over, ball) : null;
  const target = state.target;
  const needRuns =
    target != null && state.matchStatus === "live" ? Math.max(0, target - runs) : null;
  const ballsLeft =
    target != null && state.matchStatus === "live" ? ballsRemaining(oversLimit, over, ball) : null;
  const rrr =
    target != null && innings
      ? requiredRate(target, runs, oversLimit, over, ball)
      : null;

  const lastBall =
    state.thisOver.length > 0 ? state.thisOver[state.thisOver.length - 1] : null;
  const flashToken = flashTokenForBall(match.id, state.lastSequence, lastBall);
  const flash =
    flashToken && flashToken !== input.previousFlashToken ? mapBallToFlash(lastBall) : null;

  const resultText = state.resultText ?? match.resultSummary ?? summary?.resultText ?? null;
  const resultHeadline =
    state.matchStatus === "completed" || state.matchStatus === "abandoned"
      ? [winner?.shortCode, resultText].filter(Boolean).join(" · ") || resultText
      : null;

  let phase: CricketObsPhase = "no_live";
  if (state.matchStatus === "completed" || state.matchStatus === "abandoned") {
    phase = "completed";
  } else if (isInningsBreak(state)) {
    phase = "innings_break";
  } else if (state.matchStatus === "live" && target != null && innings) {
    phase = "chase";
  } else if (state.matchStatus === "live" && innings) {
    phase = "live";
  } else if (
    state.matchStatus === "scheduled" ||
    state.matchStatus === "live" ||
    !innings
  ) {
    phase = "pre_match";
  }

  return {
    ...base,
    phase,
    matchId: match.id,
    home,
    away,
    batting,
    bowling,
    winner,
    runs,
    wickets,
    oversLabel,
    oversLimit,
    oversDisplay: `${oversLabel}/${oversLimit} OV`,
    crr,
    rrr,
    target,
    needRuns,
    ballsRemaining: ballsLeft,
    thisOverLabels: state.thisOver.map((b) => b.label),
    resultText,
    resultHeadline,
    firstInningsScoreLine: firstInningsScoreLine(state, summary, teams),
    flash,
    flashToken,
  };
}

export const CRICKET_OBS_LIVE_SEGMENT = "live";

export function parseCricketObsMatchParam(
  raw: string | undefined,
): { mode: "live" } | { mode: "match"; matchId: number } | { mode: "invalid" } {
  if (!raw || raw === CRICKET_OBS_LIVE_SEGMENT) return { mode: "live" };
  const id = parseInt(raw, 10);
  if (!Number.isFinite(id) || id <= 0) return { mode: "invalid" };
  return { mode: "match", matchId: id };
}
