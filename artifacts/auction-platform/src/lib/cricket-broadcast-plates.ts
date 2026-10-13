/**
 * Broadcast plate rules for cricket.
 * Full-screen slates and the side slate read this module so a live crease
 * cannot be painted as another team's total, top batter, or toss.
 */

import type {
  BattingCardRow,
  BowlingCardRow,
  CricketFullScorecard,
  InningsScorecard,
} from "@workspace/scoring-core";
import {
  getSponsorsByPriority,
  parseSponsorLogos,
  type SponsorLogo,
} from "@/lib/sponsor-logo";
import { isTerminalCricketMatchStatus, isUpcomingCricketMatchStatus } from "@/lib/scoring-api";

export type BroadcastBatterLine = {
  playerId: number;
  name: string;
  dismissal: string;
  notOut: boolean;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  strikeRate: number;
};

export type BroadcastBowlerLine = {
  playerId: number;
  name: string;
  overs: string;
  maidens: number;
  runs: number;
  wickets: number;
  economy: number;
};

export type BroadcastInningsPlate = {
  innings: number;
  battingTeamId: number;
  bowlingTeamId: number;
  totalRuns: number;
  totalWickets: number;
  overs: string;
  extrasLine: string;
  fallLine: string | null;
  batting: BroadcastBatterLine[];
  bowling: BroadcastBowlerLine[];
};

export type BroadcastPerformer = {
  name: string;
  runs?: number;
  balls?: number;
  wickets?: number;
  runsConceded?: number;
};

export type BroadcastSideSummary = {
  teamId: number;
  score: string | null;
  overs: string | null;
  topBatter: BroadcastPerformer | null;
  topBowler: BroadcastPerformer | null;
};

export type BroadcastMatchSummary = {
  home: BroadcastSideSummary;
  away: BroadcastSideSummary;
  resultText: string;
  winnerTeamId: number | null;
};

export type ScoreboardSponsorInput = {
  logoUrl?: string | null;
  name?: string | null;
  title?: string | null;
};

type NameOf = (playerId: number) => string;

export function playerNameFromMap(players: Record<string, string> | undefined, playerId: number): string {
  const named = players?.[String(playerId)]?.trim();
  return named || `Player ${playerId}`;
}

export function dismissalLabel(row: BattingCardRow, nameOf: NameOf): string {
  if (row.notOut || !row.dismissalType) return "not out";
  const bowler = row.dismissedByPlayerId != null ? nameOf(row.dismissedByPlayerId) : null;
  const fielder = row.fielderId != null ? nameOf(row.fielderId) : null;
  switch (row.dismissalType) {
    case "bowled":
      return bowler ? `b ${bowler}` : "bowled";
    case "caught":
      if (fielder && bowler && row.fielderId === row.dismissedByPlayerId) return `c& b ${bowler}`;
      if (fielder && bowler) return `c ${fielder} b ${bowler}`;
      return bowler ? `c b ${bowler}` : "caught";
    case "lbw":
      return bowler ? `lbw b ${bowler}` : "lbw";
    case "stumped":
      if (fielder && bowler) return `st ${fielder} b ${bowler}`;
      return fielder ? `st ${fielder}` : "stumped";
    case "run_out":
      return fielder ? `run out ${fielder}` : "run out";
    case "hit_wicket":
      return bowler ? `hit wicket b ${bowler}` : "hit wicket";
    default:
      return row.dismissalType.replace(/_/g, " ");
  }
}

export type BattingBroadcastRow = {
  playerId: number;
  name: string;
  captain: boolean;
  dismissal: string;
  notOut: boolean;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  strikeRate: number;
};

export type BattingBroadcastCard = {
  innings: number;
  teamName: string;
  rows: BattingBroadcastRow[];
  yetToBat: string[];
  extras: number;
  overs: string;
  totalRuns: number;
  totalWickets: number;
};

function notOutShell(playerId: number, sequence: number): BattingCardRow {
  return {
    playerId,
    runs: 0,
    balls: 0,
    fours: 0,
    sixes: 0,
    strikeRate: 0,
    notOut: true,
    dismissalType: null,
    dismissedByPlayerId: null,
    fielderId: null,
    sequence,
  };
}

export function selectBattingInnings(
  innings: InningsScorecard[],
  matchStatus: string | null | undefined,
  page: number,
): InningsScorecard | null {
  if (innings.length === 0) return null;
  if (matchStatus === "live") return innings[innings.length - 1] ?? null;
  const count = innings.length;
  const index = ((page % count) + count) % count;
  return innings[index] ?? null;
}

export function buildBattingBroadcastCard(input: {
  innings: InningsScorecard;
  teamName: string;
  players?: Record<string, string>;
  captainId?: number | null;
  battingOrder?: number[];
}): BattingBroadcastCard {
  const nameOf = (id: number) => playerNameFromMap(input.players, id);
  const rowById = new Map(input.innings.batting.map((row) => [row.playerId, row]));
  const atCrease = new Set<number>();
  const partnership = input.innings.currentPartnership;
  if (partnership?.batter1Id != null && partnership.batter1Id > 0) atCrease.add(partnership.batter1Id);
  if (partnership?.batter2Id != null && partnership.batter2Id > 0) atCrease.add(partnership.batter2Id);

  const shown: BattingCardRow[] = [];
  const shownIds = new Set<number>();
  const yetToBat: string[] = [];
  const pushRow = (row: BattingCardRow) => {
    if (shownIds.has(row.playerId)) return;
    shownIds.add(row.playerId);
    shown.push(row);
  };

  const order = (input.battingOrder ?? []).filter((id) => Number.isInteger(id) && id > 0);
  if (order.length > 0) {
    for (const id of order) {
      const existing = rowById.get(id);
      if (existing) {
        pushRow(existing);
        continue;
      }
      if (atCrease.has(id)) {
        pushRow(notOutShell(id, shown.length));
        continue;
      }
      yetToBat.push(nameOf(id));
    }
    const leftovers = [...rowById.values()]
      .filter((row) => !shownIds.has(row.playerId))
      .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));
    for (const row of leftovers) pushRow(row);
  } else {
    const sorted = [...input.innings.batting].sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));
    for (const row of sorted) pushRow(row);
    for (const id of atCrease) {
      if (!shownIds.has(id)) pushRow(notOutShell(id, shown.length));
    }
  }

  return {
    innings: input.innings.innings,
    teamName: input.teamName,
    extras: input.innings.extras.total,
    overs: input.innings.overs,
    totalRuns: input.innings.totalRuns,
    totalWickets: input.innings.totalWickets,
    yetToBat,
    rows: shown.map((row) => ({
      playerId: row.playerId,
      name: nameOf(row.playerId),
      captain: input.captainId != null && row.playerId === input.captainId,
      dismissal: row.notOut ? "NOT OUT" : dismissalLabel(row, nameOf),
      notOut: row.notOut,
      runs: row.runs,
      balls: row.balls,
      fours: row.fours,
      sixes: row.sixes,
      strikeRate: row.strikeRate,
    })),
  };
}

function extrasLine(inn: InningsScorecard): string {
  const parts: string[] = [];
  if (inn.extras.byes) parts.push(`b ${inn.extras.byes}`);
  if (inn.extras.legByes) parts.push(`lb ${inn.extras.legByes}`);
  if (inn.extras.wides) parts.push(`w ${inn.extras.wides}`);
  if (inn.extras.noBalls) parts.push(`nb ${inn.extras.noBalls}`);
  if (inn.extras.penalties) parts.push(`p ${inn.extras.penalties}`);
  const detail = parts.length > 0 ? ` (${parts.join(", ")})` : "";
  return `Extras ${inn.extras.total}${detail}`;
}

export function inningsPlates(
  scorecard: CricketFullScorecard | null | undefined,
  players: Record<string, string> | undefined,
): BroadcastInningsPlate[] {
  if (!scorecard?.innings?.length) return [];
  const nameOf = (id: number) => playerNameFromMap(players, id);
  return scorecard.innings.map((inn) => ({
    innings: inn.innings,
    battingTeamId: inn.battingTeamId,
    bowlingTeamId: inn.bowlingTeamId,
    totalRuns: inn.totalRuns,
    totalWickets: inn.totalWickets,
    overs: inn.overs,
    extrasLine: extrasLine(inn),
    fallLine: inn.fallOfWickets.length
      ? inn.fallOfWickets.map((f) => `${f.wicket}-${f.runs} (${f.overs})`).join(", ")
      : null,
    batting: inn.batting.map((row) => ({
      playerId: row.playerId,
      name: nameOf(row.playerId),
      dismissal: dismissalLabel(row, nameOf),
      notOut: row.notOut,
      runs: row.runs,
      balls: row.balls,
      fours: row.fours,
      sixes: row.sixes,
      strikeRate: row.strikeRate,
    })),
    bowling: inn.bowling.map((row: BowlingCardRow) => ({
      playerId: row.playerId,
      name: nameOf(row.playerId),
      overs: row.overs,
      maidens: row.maidens,
      runs: row.runs,
      wickets: row.wickets,
      economy: row.economy,
    })),
  }));
}

function bestBatter(rows: BattingCardRow[], nameOf: NameOf): BroadcastPerformer | null {
  if (rows.length === 0) return null;
  let best = rows[0]!;
  for (const row of rows.slice(1)) {
    if (row.runs > best.runs) best = row;
    else if (row.runs === best.runs && row.balls < best.balls) best = row;
  }
  return { name: nameOf(best.playerId), runs: best.runs, balls: best.balls };
}

function bestBowler(rows: BowlingCardRow[], nameOf: NameOf): BroadcastPerformer | null {
  if (rows.length === 0) return null;
  let best = rows[0]!;
  for (const row of rows.slice(1)) {
    if (row.wickets > best.wickets) best = row;
    else if (row.wickets === best.wickets && row.runs < best.runs) best = row;
    else if (row.wickets === best.wickets && row.runs === best.runs && row.economy < best.economy) best = row;
  }
  return { name: nameOf(best.playerId), wickets: best.wickets, runsConceded: best.runs };
}

function sideSummary(
  teamId: number,
  plates: BroadcastInningsPlate[],
  nameOf: NameOf,
  rawInnings: InningsScorecard[],
): BroadcastSideSummary {
  const batting = plates.find((inn) => inn.battingTeamId === teamId) ?? null;
  const bowlingRaw = rawInnings.find((inn) => inn.bowlingTeamId === teamId) ?? null;
  return {
    teamId,
    score: batting ? `${batting.totalRuns}/${batting.totalWickets}` : null,
    overs: batting?.overs ?? null,
    topBatter: battingRaw(rawInnings, teamId, nameOf),
    topBowler: bowlingRaw ? bestBowler(bowlingRaw.bowling, nameOf) : null,
  };
}

function battingRaw(innings: InningsScorecard[], teamId: number, nameOf: NameOf): BroadcastPerformer | null {
  const inn = innings.find((row) => row.battingTeamId === teamId);
  if (!inn) return null;
  return bestBatter(inn.batting, nameOf);
}

export function broadcastMatchSummary(input: {
  scorecard: CricketFullScorecard | null | undefined;
  players?: Record<string, string>;
  homeTeamId: number;
  awayTeamId: number;
  winnerTeamId: number | null;
  resultSummary: string | null;
  winnerName?: string | null;
}): BroadcastMatchSummary {
  const nameOf = (id: number) => playerNameFromMap(input.players, id);
  const raw = input.scorecard?.innings ?? [];
  const plates = inningsPlates(input.scorecard, input.players);
  const winnerName = input.winnerName?.trim() || null;
  let resultText = input.resultSummary?.trim() || "Result pending";
  if (winnerName && /^won by\b/i.test(resultText)) {
    resultText = `${winnerName} ${resultText}`;
  }
  return {
    home: sideSummary(input.homeTeamId, plates, nameOf, raw),
    away: sideSummary(input.awayTeamId, plates, nameOf, raw),
    resultText,
    winnerTeamId: input.winnerTeamId,
  };
}

export function tossLine(
  state: { tossWinnerTeamId?: number | null; electedTo?: string | null } | null | undefined,
  winnerName: string | null | undefined,
): string | null {
  if (!state?.tossWinnerTeamId || !winnerName?.trim()) return null;
  if (state.electedTo !== "bat" && state.electedTo !== "bowl") return null;
  const decision = state.electedTo === "bat" ? "BAT" : "BOWL";
  return `${winnerName.trim().toUpperCase()} WON THE TOSS AND CHOSE TO ${decision}`;
}

export function plateMatchId(input: {
  overlay: "intro" | "scorecard" | "summary" | "batting";
  overlayMatchId?: number | null;
  liveMatchId?: number | null;
  liveStatus?: string | null;
}): number | null {
  if (input.overlayMatchId && input.overlayMatchId > 0) return input.overlayMatchId;
  if (
    (input.overlay === "scorecard" || input.overlay === "batting") &&
    input.liveStatus === "live" &&
    input.liveMatchId
  ) {
    return input.liveMatchId;
  }
  if (
    input.overlay === "summary" &&
    input.liveStatus &&
    isTerminalCricketMatchStatus(input.liveStatus) &&
    input.liveMatchId
  ) {
    return input.liveMatchId;
  }
  return null;
}

export function upcomingFixture<T extends { id: number; status: string }>(
  matches: T[],
  overlayMatchId?: number | null,
): T | null {
  const upcoming = matches.filter((match) => isUpcomingCricketMatchStatus(match.status));
  if (overlayMatchId) {
    return upcoming.find((match) => match.id === overlayMatchId) ?? null;
  }
  return upcoming[0] ?? null;
}

export type KnockoutBoardItem = {
  id: number;
  homeTeamId: number;
  awayTeamId: number;
  fixtureId?: number | null;
  roundName?: string | null;
  resultSummary?: string | null;
  status?: string | null;
};

export function knockoutBoardRows(
  fixtures: KnockoutBoardItem[],
  matches: KnockoutBoardItem[],
): KnockoutBoardItem[] {
  if (fixtures.length === 0) return matches;
  return fixtures.map((fixture) => {
    const match = matches.find((row) => row.fixtureId != null && row.fixtureId === fixture.id);
    if (!match) return fixture;
    return {
      ...fixture,
      homeTeamId: match.homeTeamId || fixture.homeTeamId,
      awayTeamId: match.awayTeamId || fixture.awayTeamId,
      resultSummary: match.resultSummary?.trim() || fixture.resultSummary,
      status: match.status ?? fixture.status,
    };
  });
}

export function knockoutResultLine(item: {
  resultSummary?: string | null;
  status?: string | null;
}): string {
  const summary = item.resultSummary?.trim();
  if (summary) return summary;
  if (item.status && isUpcomingCricketMatchStatus(item.status)) return "Upcoming";
  return "Yet to be played";
}

/** Cricket broadcast logos. Auction tournament logos are not a fallback. */
export function resolveCricketBroadcastSponsors(raw: string | null | undefined): SponsorLogo[] {
  if (raw == null) return [];
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "[]") return [];
  return getSponsorsByPriority(parseSponsorLogos(trimmed));
}

export function scoreboardSponsorLogo(sponsor: ScoreboardSponsorInput | null | undefined): SponsorLogo | null {
  if (!sponsor) return null;
  const name = sponsor.name?.trim() || "";
  const url = sponsor.logoUrl?.trim() || "";
  const title = sponsor.title?.trim() || "";
  if (!name && !url && !title) return null;
  const isTitle = /title\s*(sponsor|partner)/i.test(title);
  return {
    url,
    name: name || title,
    type: title || undefined,
    priorityType: isTitle ? "TITLE" : title || undefined,
    isTitleSponsor: isTitle,
  };
}

export function sponsorsExceptLocked(sponsors: SponsorLogo[], locked: SponsorLogo | null): SponsorLogo[] {
  if (!locked) return sponsors;
  return sponsors.filter((sponsor) => {
    if (locked.url && sponsor.url && locked.url === sponsor.url) return false;
    if (locked.name && sponsor.name && locked.name.toLowerCase() === sponsor.name.toLowerCase()) return false;
    return true;
  });
}

export function sponsorTypeLabel(sponsor: SponsorLogo | null | undefined): string | null {
  const custom = sponsor?.type?.trim();
  if (custom && !["normal", "standard"].includes(custom.toLowerCase())) return custom;
  if (sponsor?.isTitleSponsor) return "Title Sponsor";
  if (sponsor?.isCoSponsor) return "Co-Sponsor";
  return null;
}
