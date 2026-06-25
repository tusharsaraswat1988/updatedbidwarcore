import type { Response } from "express";
import { pool } from "@workspace/db";

export type ExportDataset = "bids" | "players" | "timers" | "all";
export type ExportSource = "live" | "archive";

function csvEscape(value: unknown): string {
  if (value == null) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function rowToCsvLine(values: unknown[]): string {
  return values.map(csvEscape).join(",") + "\n";
}

const BID_HEADERS = [
  "source", "tournament_id", "tournament_name", "tournament_sport", "sport",
  "player_id", "global_player_id", "team_id", "team_name", "team_short_code",
  "bid_amount", "previous_bid_amount", "bid_increment", "bid_sequence_number",
  "milliseconds_since_last_bid", "timer_remaining_seconds", "is_manual_bid",
  "became_leader", "timestamp",
];

const PLAYER_HEADERS = [
  "source", "tournament_id", "tournament_name", "tournament_sport", "sport",
  "player_id", "global_player_id", "category_id", "category_name",
  "player_name", "player_role", "player_age", "player_city",
  "base_price", "outcome", "final_amount", "sold_to_team_id", "sold_to_team_name",
  "total_bids_received", "interested_teams_count", "auction_duration_seconds",
  "average_secs_between_bids", "auction_started_at", "auction_ended_at", "timestamp",
];

const TIMER_HEADERS = [
  "source", "tournament_id", "tournament_name", "tournament_sport",
  "player_id", "action", "timer_type", "timer_seconds", "triggered_by", "timestamp",
];

async function streamLiveBids(tournamentId: number, write: (line: string) => void): Promise<void> {
  const { rows } = await pool.query(
    `SELECT abe.tournament_id, tor.name AS tournament_name, tor.sport AS tournament_sport,
            abe.sport, abe.player_id, abe.global_player_id, abe.team_id,
            t.name AS team_name, t.short_code AS team_short_code,
            abe.bid_amount, abe.previous_bid_amount, abe.bid_increment, abe.bid_sequence_number,
            abe.milliseconds_since_last_bid, abe.timer_remaining_seconds,
            abe.is_manual_bid, abe.became_leader, abe.timestamp
     FROM auction_bid_events abe
     JOIN tournaments tor ON tor.id = abe.tournament_id
     LEFT JOIN teams t ON t.id = abe.team_id
     WHERE abe.tournament_id = $1
     ORDER BY abe.timestamp ASC`,
    [tournamentId],
  );
  for (const r of rows) {
    write(rowToCsvLine([
      "live", r.tournament_id, r.tournament_name, r.tournament_sport, r.sport,
      r.player_id, r.global_player_id, r.team_id, r.team_name, r.team_short_code,
      r.bid_amount, r.previous_bid_amount, r.bid_increment, r.bid_sequence_number,
      r.milliseconds_since_last_bid, r.timer_remaining_seconds,
      r.is_manual_bid, r.became_leader, r.timestamp,
    ]));
  }
}

async function streamArchiveBids(archiveId: number, write: (line: string) => void): Promise<void> {
  const { rows } = await pool.query(
    `SELECT source_tournament_id, tournament_name, tournament_sport, sport,
            player_id, global_player_id, team_id, team_name, team_short_code,
            bid_amount, previous_bid_amount, bid_increment, bid_sequence_number,
            milliseconds_since_last_bid, timer_remaining_seconds,
            is_manual_bid, became_leader, timestamp
     FROM intelligence_archive_bid_events
     WHERE archive_id = $1
     ORDER BY timestamp ASC`,
    [archiveId],
  );
  for (const r of rows) {
    write(rowToCsvLine([
      "archive", r.source_tournament_id, r.tournament_name, r.tournament_sport, r.sport,
      r.player_id, r.global_player_id, r.team_id, r.team_name, r.team_short_code,
      r.bid_amount, r.previous_bid_amount, r.bid_increment, r.bid_sequence_number,
      r.milliseconds_since_last_bid, r.timer_remaining_seconds,
      r.is_manual_bid, r.became_leader, r.timestamp,
    ]));
  }
}

async function streamLivePlayers(tournamentId: number, write: (line: string) => void): Promise<void> {
  const { rows } = await pool.query(
    `SELECT ape.tournament_id, tor.name AS tournament_name, tor.sport AS tournament_sport,
            ape.sport, ape.player_id, ape.global_player_id, ape.category_id, c.name AS category_name,
            ape.player_name, ape.player_role, ape.player_age, ape.player_city,
            ape.base_price, ape.outcome, ape.final_amount, ape.sold_to_team_id, ape.sold_to_team_name,
            ape.total_bids_received, ape.interested_teams_count, ape.auction_duration_seconds,
            ape.average_secs_between_bids, ape.auction_started_at, ape.auction_ended_at, ape.timestamp
     FROM auction_player_events ape
     JOIN tournaments tor ON tor.id = ape.tournament_id
     LEFT JOIN categories c ON c.id = ape.category_id
     WHERE ape.tournament_id = $1
     ORDER BY ape.timestamp ASC`,
    [tournamentId],
  );
  for (const r of rows) {
    write(rowToCsvLine([
      "live", r.tournament_id, r.tournament_name, r.tournament_sport, r.sport,
      r.player_id, r.global_player_id, r.category_id, r.category_name,
      r.player_name, r.player_role, r.player_age, r.player_city,
      r.base_price, r.outcome, r.final_amount, r.sold_to_team_id, r.sold_to_team_name,
      r.total_bids_received, r.interested_teams_count, r.auction_duration_seconds,
      r.average_secs_between_bids, r.auction_started_at, r.auction_ended_at, r.timestamp,
    ]));
  }
}

async function streamArchivePlayers(archiveId: number, write: (line: string) => void): Promise<void> {
  const { rows } = await pool.query(
    `SELECT source_tournament_id, tournament_name, tournament_sport, sport,
            player_id, global_player_id, category_id, category_name,
            player_name, player_role, player_age, player_city,
            base_price, outcome, final_amount, sold_to_team_id, sold_to_team_name,
            total_bids_received, interested_teams_count, auction_duration_seconds,
            average_secs_between_bids, auction_started_at, auction_ended_at, timestamp
     FROM intelligence_archive_player_events
     WHERE archive_id = $1
     ORDER BY timestamp ASC`,
    [archiveId],
  );
  for (const r of rows) {
    write(rowToCsvLine([
      "archive", r.source_tournament_id, r.tournament_name, r.tournament_sport, r.sport,
      r.player_id, r.global_player_id, r.category_id, r.category_name,
      r.player_name, r.player_role, r.player_age, r.player_city,
      r.base_price, r.outcome, r.final_amount, r.sold_to_team_id, r.sold_to_team_name,
      r.total_bids_received, r.interested_teams_count, r.auction_duration_seconds,
      r.average_secs_between_bids, r.auction_started_at, r.auction_ended_at, r.timestamp,
    ]));
  }
}

async function streamLiveTimers(tournamentId: number, write: (line: string) => void): Promise<void> {
  const { rows } = await pool.query(
    `SELECT ate.tournament_id, tor.name AS tournament_name, tor.sport AS tournament_sport,
            ate.player_id, ate.action, ate.timer_type, ate.timer_seconds, ate.triggered_by, ate.timestamp
     FROM auction_timer_events ate
     JOIN tournaments tor ON tor.id = ate.tournament_id
     WHERE ate.tournament_id = $1
     ORDER BY ate.timestamp ASC`,
    [tournamentId],
  );
  for (const r of rows) {
    write(rowToCsvLine([
      "live", r.tournament_id, r.tournament_name, r.tournament_sport,
      r.player_id, r.action, r.timer_type, r.timer_seconds, r.triggered_by, r.timestamp,
    ]));
  }
}

async function streamArchiveTimers(archiveId: number, write: (line: string) => void): Promise<void> {
  const { rows } = await pool.query(
    `SELECT source_tournament_id, tournament_name, tournament_sport,
            player_id, action, timer_type, timer_seconds, triggered_by, timestamp
     FROM intelligence_archive_timer_events
     WHERE archive_id = $1
     ORDER BY timestamp ASC`,
    [archiveId],
  );
  for (const r of rows) {
    write(rowToCsvLine([
      "archive", r.source_tournament_id, r.tournament_name, r.tournament_sport,
      r.player_id, r.action, r.timer_type, r.timer_seconds, r.triggered_by, r.timestamp,
    ]));
  }
}

export async function writeIntelligenceCsv(
  res: Response,
  opts: {
    filename: string;
    dataset: ExportDataset;
    source: ExportSource;
    tournamentId?: number;
    archiveId?: number;
  },
): Promise<void> {
  const { filename, dataset, source, tournamentId, archiveId } = opts;

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  const write = (line: string) => { res.write(line); };

  if (dataset === "all") {
    write("# dataset: bids\n");
    write(BID_HEADERS.join(",") + "\n");
    if (source === "live" && tournamentId) await streamLiveBids(tournamentId, write);
    if (source === "archive" && archiveId) await streamArchiveBids(archiveId, write);

    write("\n# dataset: players\n");
    write(PLAYER_HEADERS.join(",") + "\n");
    if (source === "live" && tournamentId) await streamLivePlayers(tournamentId, write);
    if (source === "archive" && archiveId) await streamArchivePlayers(archiveId, write);

    write("\n# dataset: timers\n");
    write(TIMER_HEADERS.join(",") + "\n");
    if (source === "live" && tournamentId) await streamLiveTimers(tournamentId, write);
    if (source === "archive" && archiveId) await streamArchiveTimers(archiveId, write);
  } else if (dataset === "bids") {
    write(BID_HEADERS.join(",") + "\n");
    if (source === "live" && tournamentId) await streamLiveBids(tournamentId, write);
    if (source === "archive" && archiveId) await streamArchiveBids(archiveId, write);
  } else if (dataset === "players") {
    write(PLAYER_HEADERS.join(",") + "\n");
    if (source === "live" && tournamentId) await streamLivePlayers(tournamentId, write);
    if (source === "archive" && archiveId) await streamArchivePlayers(archiveId, write);
  } else {
    write(TIMER_HEADERS.join(",") + "\n");
    if (source === "live" && tournamentId) await streamLiveTimers(tournamentId, write);
    if (source === "archive" && archiveId) await streamArchiveTimers(archiveId, write);
  }

  res.end();
}
