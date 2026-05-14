/**
 * Auction Intelligence Logger
 *
 * Fire-and-forget logging pipeline for auction behavioral data.
 * All functions return void and are intentionally NOT awaited by callers —
 * the live auction path must never block on analytics writes.
 *
 * Failures are silently swallowed. Auction flow takes absolute priority.
 *
 * Future AI systems (recommendation engine, player valuation, team strategy
 * profiling) will query these append-only tables for training data.
 */

import { db } from "@workspace/db";
import {
  auctionBidEventsTable,
  auctionPlayerEventsTable,
  auctionTimerEventsTable,
} from "@workspace/db";
import { eq, and, count, max } from "drizzle-orm";

// ─────────────────────────────────────────────────────────────────────────────
// Bid Event
// ─────────────────────────────────────────────────────────────────────────────

export interface BidEventPayload {
  tournamentId: number;
  playerId: number;
  globalPlayerId?: string | null;
  teamId: number;
  sport: string;
  bidAmount: number;
  previousBidAmount: number | null;
  timerEndsAt: string | null;  // raw ISO from session — we compute remaining seconds
  isManualBid: boolean;
}

export function logBidEvent(payload: BidEventPayload): void {
  void Promise.resolve().then(async () => {
    try {
      const now = Date.now();

      // Bid sequence number: count existing bid events for this player in this tournament
      const [{ value: existingCount }] = await db
        .select({ value: count() })
        .from(auctionBidEventsTable)
        .where(
          and(
            eq(auctionBidEventsTable.tournamentId, payload.tournamentId),
            eq(auctionBidEventsTable.playerId, payload.playerId),
          ),
        );
      const bidSequenceNumber = Number(existingCount) + 1;

      // Milliseconds since last bid — query the most recent bid event timestamp
      let millisecondsSinceLastBid: number | null = null;
      if (bidSequenceNumber > 1) {
        const [lastBid] = await db
          .select({ ts: max(auctionBidEventsTable.timestamp) })
          .from(auctionBidEventsTable)
          .where(
            and(
              eq(auctionBidEventsTable.tournamentId, payload.tournamentId),
              eq(auctionBidEventsTable.playerId, payload.playerId),
            ),
          );
        if (lastBid?.ts) {
          millisecondsSinceLastBid = now - new Date(lastBid.ts).getTime();
        }
      }

      // Timer remaining at bid time
      let timerRemainingSeconds: number | null = null;
      if (payload.timerEndsAt) {
        const remaining = Math.round((new Date(payload.timerEndsAt).getTime() - now) / 1000);
        timerRemainingSeconds = remaining > 0 ? remaining : 0;
      }

      const bidIncrement =
        payload.previousBidAmount != null
          ? payload.bidAmount - payload.previousBidAmount
          : payload.bidAmount;

      await db.insert(auctionBidEventsTable).values({
        tournamentId: payload.tournamentId,
        playerId: payload.playerId,
        globalPlayerId: payload.globalPlayerId ?? null,
        teamId: payload.teamId,
        sport: payload.sport,
        bidAmount: payload.bidAmount,
        previousBidAmount: payload.previousBidAmount,
        bidIncrement,
        bidSequenceNumber,
        millisecondsSinceLastBid,
        timerRemainingSeconds,
        isManualBid: payload.isManualBid,
        becameLeader: true,
      });
    } catch {
      // Never interrupt live bidding for analytics failures
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Player Auction Start Event
// ─────────────────────────────────────────────────────────────────────────────

export interface PlayerAuctionStartPayload {
  tournamentId: number;
  playerId: number;
  globalPlayerId?: string | null;
  categoryId?: number | null;
  sport: string;
  playerName: string;
  playerRole?: string | null;
  playerAge?: number | null;
  playerCity?: string | null;
  basePrice: number | null;
  playerSnapshotJson: string;
}

export function logPlayerAuctionStart(payload: PlayerAuctionStartPayload): void {
  void Promise.resolve().then(async () => {
    try {
      await db.insert(auctionPlayerEventsTable).values({
        tournamentId: payload.tournamentId,
        playerId: payload.playerId,
        globalPlayerId: payload.globalPlayerId ?? null,
        categoryId: payload.categoryId ?? null,
        sport: payload.sport,
        playerName: payload.playerName,
        playerRole: payload.playerRole ?? null,
        playerAge: payload.playerAge ?? null,
        playerCity: payload.playerCity ?? null,
        basePrice: payload.basePrice,
        playerSnapshotJson: payload.playerSnapshotJson,
        outcome: "in_progress",
        auctionStartedAt: new Date(),
      });
    } catch {
      // Logging must not interrupt auction flow
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Player Auction End Event
// ─────────────────────────────────────────────────────────────────────────────

export interface PlayerAuctionEndPayload {
  tournamentId: number;
  playerId: number;
  globalPlayerId?: string | null;
  categoryId?: number | null;
  sport: string;
  playerName: string;
  playerRole?: string | null;
  playerAge?: number | null;
  playerCity?: string | null;
  basePrice: number | null;
  playerSnapshotJson: string;
  outcome: "sold" | "unsold" | "deferred";
  finalAmount?: number | null;
  soldToTeamId?: number | null;
  soldToTeamName?: string | null;
  auctionStartedAt?: Date | null;  // if known
}

export function logPlayerAuctionEnd(payload: PlayerAuctionEndPayload): void {
  void Promise.resolve().then(async () => {
    try {
      const endedAt = new Date();

      // Gather aggregate stats from bid events for this player
      const [{ value: totalBids }] = await db
        .select({ value: count() })
        .from(auctionBidEventsTable)
        .where(
          and(
            eq(auctionBidEventsTable.tournamentId, payload.tournamentId),
            eq(auctionBidEventsTable.playerId, payload.playerId),
          ),
        );

      // Count distinct teams that bid (approximate via groupBy)
      const teamRows = await db
        .selectDistinct({ teamId: auctionBidEventsTable.teamId })
        .from(auctionBidEventsTable)
        .where(
          and(
            eq(auctionBidEventsTable.tournamentId, payload.tournamentId),
            eq(auctionBidEventsTable.playerId, payload.playerId),
          ),
        );
      const interestedTeamsCount = teamRows.length;

      // Duration
      let auctionDurationSeconds: number | null = null;
      let averageSecsBetweenBids: number | null = null;
      if (payload.auctionStartedAt) {
        auctionDurationSeconds = Math.round(
          (endedAt.getTime() - payload.auctionStartedAt.getTime()) / 1000,
        );
        const totalBidsNum = Number(totalBids);
        if (totalBidsNum > 1) {
          averageSecsBetweenBids = Math.round(auctionDurationSeconds / (totalBidsNum - 1));
        }
      }

      await db.insert(auctionPlayerEventsTable).values({
        tournamentId: payload.tournamentId,
        playerId: payload.playerId,
        globalPlayerId: payload.globalPlayerId ?? null,
        categoryId: payload.categoryId ?? null,
        sport: payload.sport,
        playerName: payload.playerName,
        playerRole: payload.playerRole ?? null,
        playerAge: payload.playerAge ?? null,
        playerCity: payload.playerCity ?? null,
        basePrice: payload.basePrice,
        playerSnapshotJson: payload.playerSnapshotJson,
        outcome: payload.outcome,
        auctionStartedAt: payload.auctionStartedAt ?? endedAt,
        auctionEndedAt: endedAt,
        finalAmount: payload.finalAmount ?? null,
        soldToTeamId: payload.soldToTeamId ?? null,
        soldToTeamName: payload.soldToTeamName ?? null,
        totalBidsReceived: Number(totalBids),
        interestedTeamsCount,
        auctionDurationSeconds,
        averageSecsBetweenBids,
      });
    } catch {
      // Logging must not interrupt auction flow
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Timer Event
// ─────────────────────────────────────────────────────────────────────────────

export interface TimerEventPayload {
  tournamentId: number;
  playerId?: number | null;
  action: "start" | "stop" | "extend" | "expired";
  timerType?: string | null;
  timerSeconds: number;
  triggeredBy: "operator" | "system";
}

export function logTimerEvent(payload: TimerEventPayload): void {
  void Promise.resolve().then(async () => {
    try {
      await db.insert(auctionTimerEventsTable).values({
        tournamentId: payload.tournamentId,
        playerId: payload.playerId ?? null,
        action: payload.action,
        timerType: payload.timerType ?? null,
        timerSeconds: payload.timerSeconds,
        triggeredBy: payload.triggeredBy,
      });
    } catch {
      // Logging must not interrupt auction flow
    }
  });
}
