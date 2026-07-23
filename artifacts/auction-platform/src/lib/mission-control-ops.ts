/**
 * Mission Control operational helpers — client-side only.
 * Surfaces attention, primary action, suggestions, and start blockers
 * from existing courts / matches / fixtures / branding. No new APIs.
 */

import {
  isDelayedMatch,
  type ControlMatch,
  type CourtBoardRow,
} from "@/lib/badminton-control-center";
import {
  listLiveMatches,
  resolvePrimaryBroadcastMatchId,
  type BroadcastConsoleMatch,
} from "@/lib/badminton-broadcast-console";
import { badmintonMatchControlPath } from "@/lib/badminton-routes";

export type AttentionActionKind =
  | "reconnect"
  | "assign"
  | "resume"
  | "start"
  | "start_next"
  | "focus"
  | "open_court"
  | "schedule"
  | "dismiss";

export type AttentionItem = {
  id: string;
  problem: string;
  courtLabel: string;
  courtId: number | null;
  reason: string;
  actionLabel: string;
  actionKind: AttentionActionKind;
  href?: string;
  matchId?: number | null;
  severity: "critical" | "warning";
};

export type PrimaryAction = {
  label: string;
  href?: string;
  matchId?: number | null;
  kind: "start" | "resume" | "assign" | "continue" | "schedule" | "idle";
  disabled?: boolean;
  disabledReason?: string;
};

export type SmartSuggestion = {
  id: string;
  message: string;
  actionLabel: string;
  href?: string;
  matchId?: number | null;
  targetCourtId?: number | null;
  kind: "assign" | "move" | "start_next" | "focus";
};

export type HealthLevel = "healthy" | "warning" | "disconnected";

export type SystemHealth = {
  internet: HealthLevel;
  realtime: HealthLevel;
  broadcast: HealthLevel;
  venue: HealthLevel;
  obs: HealthLevel;
  scorers: HealthLevel;
};

export type CourtDisplayPriority =
  | "LIVE"
  | "DELAYED"
  | "READY"
  | "WAITING"
  | "EMPTY"
  | "FINISHED";

const WAITING_MS = 5 * 60 * 1000;

function courtLabel(row: CourtBoardRow): string {
  return row.court.shortName?.trim() || row.court.name;
}

function hasScorerPin(row: CourtBoardRow): boolean {
  return !!(row.court.hasScorerPin || (row.court.scorerPin && row.court.scorerPin.trim()));
}

function isPaused(m: ControlMatch | null | undefined): boolean {
  return m?.status === "paused";
}

/** Visual / sort priority for court cards. */
export function courtDisplayPriority(row: CourtBoardRow): CourtDisplayPriority {
  if (row.status === "LIVE") return "LIVE";
  if (row.status === "DELAYED") return "DELAYED";
  if (row.status === "READY") return "READY";
  if (
    (row.status === "EMPTY" || row.status === "FINISHED") &&
    (row.nextFixture != null || row.nextMatch != null)
  ) {
    return "WAITING";
  }
  if (row.status === "EMPTY") return "EMPTY";
  return "FINISHED";
}

const PRIORITY_RANK: Record<CourtDisplayPriority, number> = {
  LIVE: 0,
  DELAYED: 1,
  READY: 2,
  WAITING: 3,
  EMPTY: 4,
  FINISHED: 5,
};

export function sortCourtsByOpsPriority(board: CourtBoardRow[]): CourtBoardRow[] {
  return [...board].sort((a, b) => {
    const pa = PRIORITY_RANK[courtDisplayPriority(a)];
    const pb = PRIORITY_RANK[courtDisplayPriority(b)];
    if (pa !== pb) return pa - pb;
    return a.court.sortOrder - b.court.sortOrder || a.court.id - b.court.id;
  });
}

/** Why Start is blocked on a court/match — never silent. */
export function explainStartBlocker(row: CourtBoardRow): string | null {
  if (row.status === "LIVE") {
    return "Previous match still running on this court — finish or pause it first.";
  }
  if (row.status === "EMPTY" && !row.nextFixture && !row.nextMatch) {
    return "Schedule missing — assign a court and time in Schedule first.";
  }
  if (row.status === "EMPTY" && row.nextFixture && !row.currentMatch) {
    return "Match not created yet — assign / create the next match for this court.";
  }
  if ((row.status === "READY" || row.status === "DELAYED") && row.currentMatch) {
    if (!hasScorerPin(row)) {
      return "No scorer assigned — set a court PIN in Tournament Setup → Courts.";
    }
    return null;
  }
  if (row.status === "FINISHED" && !row.nextMatch && !row.nextFixture) {
    return "No next match scheduled for this court.";
  }
  return null;
}

export function buildAttentionItems(input: {
  board: CourtBoardRow[];
  matches: ControlMatch[];
  ready: ControlMatch[];
  primaryMatchId: number | null;
  venueScene?: string | null;
  tournamentId: number;
  now?: number;
}): AttentionItem[] {
  const now = input.now ?? Date.now();
  const tid = input.tournamentId;
  const items: AttentionItem[] = [];
  const live = listLiveMatches(input.matches as BroadcastConsoleMatch[]);

  for (const row of input.board) {
    const label = courtLabel(row);
    const m = row.currentMatch;

    if (row.status === "LIVE" && m && isPaused(m)) {
      items.push({
        id: `paused-${row.court.id}-${m.id}`,
        problem: "Match paused",
        courtLabel: label,
        courtId: row.court.id,
        reason: "Court is paused — resume when ready to continue.",
        actionLabel: "Resume",
        actionKind: "resume",
        matchId: m.id,
        href: badmintonMatchControlPath(tid, m.id),
        severity: "critical",
      });
    }

    if (row.status === "LIVE" && m && !hasScorerPin(row)) {
      items.push({
        id: `nopin-live-${row.court.id}`,
        problem: "Missing scorer assignment",
        courtLabel: label,
        courtId: row.court.id,
        reason: "Live court has no PIN — scorers cannot reconnect reliably.",
        actionLabel: "Open Court",
        actionKind: "open_court",
        href: `/tournament/${tid}/badminton/branding?section=courts`,
        severity: "critical",
      });
    }

    if (row.status === "DELAYED" && m) {
      items.push({
        id: `delayed-${row.court.id}-${m.id}`,
        problem: "Court delayed",
        courtLabel: label,
        courtId: row.court.id,
        reason: "Scheduled time has passed and the match has not started.",
        actionLabel: "Start",
        actionKind: "start",
        matchId: m.id,
        href: badmintonMatchControlPath(tid, m.id),
        severity: "warning",
      });
    }

    if (row.status === "READY" && m?.scheduledAt) {
      const t = new Date(m.scheduledAt).getTime();
      if (!Number.isNaN(t) && now - t > WAITING_MS) {
        items.push({
          id: `waiting-${row.court.id}-${m.id}`,
          problem: "Court waiting too long",
          courtLabel: label,
          courtId: row.court.id,
          reason: "Ready match has been waiting more than 5 minutes past schedule.",
          actionLabel: "Start",
          actionKind: "start",
          matchId: m.id,
          href: badmintonMatchControlPath(tid, m.id),
          severity: "warning",
        });
      }
    }

    if (row.status === "FINISHED" && m && !row.nextMatch && row.nextFixture == null) {
      if (input.ready.length > 0) {
        items.push({
          id: `finished-idle-${row.court.id}`,
          problem: "Match finished but next not assigned",
          courtLabel: label,
          courtId: row.court.id,
          reason: "Court is free — a ready match can move here.",
          actionLabel: "Assign",
          actionKind: "assign",
          severity: "warning",
        });
      }
    }

    if (
      (row.status === "FINISHED" || row.status === "EMPTY") &&
      row.nextFixture &&
      !row.nextMatch
    ) {
      items.push({
        id: `assign-fixture-${row.court.id}-${row.nextFixture.id}`,
        problem: "Match finished but next not assigned",
        courtLabel: label,
        courtId: row.court.id,
        reason: "Next fixture is waiting — create / assign the match.",
        actionLabel: "Assign",
        actionKind: "assign",
        href: `/tournament/${tid}/badminton/matches?fixture=${row.nextFixture.id}`,
        severity: "warning",
      });
    }

    if ((row.status === "READY" || row.status === "DELAYED") && m) {
      const blocker = explainStartBlocker(row);
      if (blocker && blocker.includes("scorer")) {
        items.push({
          id: `cannot-start-${row.court.id}-${m.id}`,
          problem: "Match cannot start",
          courtLabel: label,
          courtId: row.court.id,
          reason: blocker,
          actionLabel: "Open Court",
          actionKind: "open_court",
          href: `/tournament/${tid}/badminton/branding?section=courts`,
          severity: "critical",
        });
      }
    }
  }

  if (live.length > 0) {
    const primaryStillLive =
      input.primaryMatchId != null && live.some((m) => m.id === input.primaryMatchId);
    if (!primaryStillLive && live.length > 1) {
      items.push({
        id: "broadcast-nofollow",
        problem: "Broadcast not following any live court",
        courtLabel: "Screens",
        courtId: null,
        reason: "Multiple courts are live — pick which Venue / OBS / LED follow.",
        actionLabel: "Focus",
        actionKind: "focus",
        matchId: live[0]?.id ?? null,
        severity: "critical",
      });
    }
  }

  if (live.length > 0 && input.venueScene === "standby") {
    items.push({
      id: "venue-standby",
      problem: "Venue display on standby",
      courtLabel: "Venue",
      courtId: null,
      reason: "Live matches are on but Venue scene is standby (emergency or break).",
      actionLabel: "Resume",
      actionKind: "resume",
      severity: "warning",
    });
  }

  const seen = new Set<string>();
  return items
    .filter((i) => {
      if (seen.has(i.id)) return false;
      seen.add(i.id);
      return true;
    })
    .sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "critical" ? -1 : 1));
}

export function resolvePrimaryAction(input: {
  board: CourtBoardRow[];
  ready: ControlMatch[];
  tournamentId: number;
  venueScene?: string | null;
}): PrimaryAction {
  const { board, ready, tournamentId, venueScene } = input;
  const paused = board.find((r) => r.status === "LIVE" && isPaused(r.currentMatch));
  if (paused?.currentMatch) {
    return {
      label: "Resume Tournament",
      kind: "resume",
      matchId: paused.currentMatch.id,
      href: badmintonMatchControlPath(tournamentId, paused.currentMatch.id),
    };
  }

  if (venueScene === "standby" && board.some((r) => r.status === "LIVE")) {
    return {
      label: "Resume Tournament",
      kind: "resume",
      // Presentation resume is handled by ops rail; deep-link to control for clarity
      href: `/tournament/${tournamentId}/badminton/control`,
    };
  }

  const finishedNeedsNext = board.find(
    (r) =>
      (r.status === "FINISHED" || r.status === "EMPTY") &&
      (r.nextFixture != null || r.nextMatch != null),
  );
  if (finishedNeedsNext?.nextMatch) {
    return {
      label: "Start Next Match",
      kind: "start",
      matchId: finishedNeedsNext.nextMatch.id,
      href: badmintonMatchControlPath(tournamentId, finishedNeedsNext.nextMatch.id),
    };
  }
  if (finishedNeedsNext?.nextFixture) {
    return {
      label: "Assign Waiting Match",
      kind: "assign",
      href: `/tournament/${tournamentId}/badminton/matches?fixture=${finishedNeedsNext.nextFixture.id}`,
    };
  }

  const delayed = board.find((r) => r.status === "DELAYED" && r.currentMatch);
  if (delayed?.currentMatch) {
    const blocker = explainStartBlocker(delayed);
    return {
      label: "Start Next Match",
      kind: "start",
      matchId: delayed.currentMatch.id,
      href: badmintonMatchControlPath(tournamentId, delayed.currentMatch.id),
      disabled: !!blocker,
      disabledReason: blocker ?? undefined,
    };
  }

  const live = board.find((r) => r.status === "LIVE" && r.currentMatch && !isPaused(r.currentMatch));
  if (live?.currentMatch) {
    return {
      label: "Continue Live Match",
      kind: "continue",
      matchId: live.currentMatch.id,
      href: badmintonMatchControlPath(tournamentId, live.currentMatch.id),
    };
  }

  const nextReady = ready[0];
  if (nextReady) {
    const row = board.find((r) => r.currentMatch?.id === nextReady.id);
    const blocker = row ? explainStartBlocker(row) : null;
    return {
      label: "▶ Start Next Match",
      kind: "start",
      matchId: nextReady.id,
      href: badmintonMatchControlPath(tournamentId, nextReady.id),
      disabled: !!blocker,
      disabledReason: blocker ?? undefined,
    };
  }

  if (board.every((r) => r.status === "EMPTY" || r.status === "FINISHED")) {
    return {
      label: "Open Schedule",
      kind: "schedule",
      href: `/tournament/${tournamentId}/badminton/schedule`,
    };
  }

  return { label: "All clear", kind: "idle", disabled: true, disabledReason: "Nothing waiting." };
}

export function buildSmartSuggestions(input: {
  board: CourtBoardRow[];
  ready: ControlMatch[];
  tournamentId: number;
  primaryMatchId: number | null;
}): SmartSuggestion[] {
  const { board, ready, tournamentId, primaryMatchId } = input;
  const out: SmartSuggestion[] = [];

  const free = board.find((r) => r.status === "EMPTY" || (r.status === "FINISHED" && !r.nextMatch));
  const delayed = board.find((r) => r.status === "DELAYED");
  const finishedWithNext = board.find(
    (r) => r.status === "FINISHED" && (r.nextMatch != null || r.nextFixture != null),
  );

  if (free && ready[0] && ready[0].detail?.courtId !== free.court.id) {
    const m = ready[0];
    out.push({
      id: `suggest-move-${m.id}-${free.court.id}`,
      message: `${courtLabel(free)} is free. Move waiting match here?`,
      actionLabel: `Move to ${courtLabel(free)}`,
      kind: "move",
      matchId: m.id,
      targetCourtId: free.court.id,
    });
  }

  if (delayed && free && ready.some((m) => isDelayedMatch(m) || m.id === delayed.currentMatch?.id)) {
    const m = delayed.currentMatch ?? ready.find((r) => isDelayedMatch(r));
    if (m && free.court.id !== delayed.court.id) {
      out.push({
        id: `suggest-delayed-move-${m.id}-${free.court.id}`,
        message: `${courtLabel(delayed)} delayed. Move match to ${courtLabel(free)}?`,
        actionLabel: `Move to ${courtLabel(free)}`,
        kind: "move",
        matchId: m.id,
        targetCourtId: free.court.id,
      });
    }
  }

  if (finishedWithNext?.nextMatch) {
    out.push({
      id: `suggest-start-${finishedWithNext.court.id}-${finishedWithNext.nextMatch.id}`,
      message: `${courtLabel(finishedWithNext)} finished. Start next scheduled match?`,
      actionLabel: "Start next",
      kind: "start_next",
      matchId: finishedWithNext.nextMatch.id,
      href: badmintonMatchControlPath(tournamentId, finishedWithNext.nextMatch.id),
    });
  } else if (finishedWithNext?.nextFixture) {
    out.push({
      id: `suggest-assign-${finishedWithNext.court.id}-${finishedWithNext.nextFixture.id}`,
      message: `${courtLabel(finishedWithNext)} finished. Assign next match?`,
      actionLabel: "Assign",
      kind: "assign",
      href: `/tournament/${tournamentId}/badminton/matches?fixture=${finishedWithNext.nextFixture.id}`,
    });
  }

  const liveRows = board.filter((r) => r.status === "LIVE" && r.currentMatch);
  if (liveRows.length > 1) {
    const notFocused = liveRows.find((r) => r.currentMatch!.id !== primaryMatchId);
    if (notFocused?.currentMatch) {
      out.push({
        id: `suggest-focus-${notFocused.currentMatch.id}`,
        message: `Focus screens on ${courtLabel(notFocused)}?`,
        actionLabel: "Focus court",
        kind: "focus",
        matchId: notFocused.currentMatch.id,
      });
    }
  }

  const seen = new Set<string>();
  return out.filter((s) => {
    if (seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  }).slice(0, 4);
}

export function deriveSystemHealth(input: {
  online: boolean;
  matchesQueryOk: boolean;
  lastRealtimeAt: number | null;
  brandingOk: boolean;
  liveCount: number;
  primaryMatchId: number | null;
  venueScene?: string | null;
  courtsWithPin: number;
  courtCount: number;
  now?: number;
}): SystemHealth {
  const now = input.now ?? Date.now();
  const realtimeFresh =
    input.lastRealtimeAt != null && now - input.lastRealtimeAt < 45_000;

  let realtime: HealthLevel = "disconnected";
  if (input.online && input.matchesQueryOk) {
    realtime = realtimeFresh || input.lastRealtimeAt == null ? "healthy" : "warning";
  } else if (input.online) {
    realtime = "warning";
  }

  let broadcast: HealthLevel = "disconnected";
  if (input.brandingOk) {
    broadcast =
      input.liveCount > 1 && input.primaryMatchId == null ? "warning" : "healthy";
  }

  let venue: HealthLevel = "disconnected";
  if (input.brandingOk) {
    venue =
      input.venueScene === "standby" && input.liveCount > 0 ? "warning" : "healthy";
  }

  let scorers: HealthLevel = "warning";
  if (input.courtCount === 0) scorers = "warning";
  else if (input.courtsWithPin === input.courtCount) scorers = "healthy";
  else if (input.courtsWithPin === 0) scorers = "disconnected";
  else scorers = "warning";

  return {
    internet: input.online ? "healthy" : "disconnected",
    realtime,
    broadcast,
    venue,
    obs: input.brandingOk ? "healthy" : "disconnected",
    scorers,
  };
}

export function resolvePrimaryBroadcast(
  matches: ControlMatch[],
  storedPrimaryId: number | null | undefined,
): number | null {
  return resolvePrimaryBroadcastMatchId(
    matches as BroadcastConsoleMatch[],
    storedPrimaryId,
  );
}
