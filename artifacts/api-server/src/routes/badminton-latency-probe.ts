/**
 * DEV-only badminton latency + tournament validation probe.
 * NODE_ENV=production → all routes 404.
 *
 *   POST /setup     create+start match (singles|doubles, format options)
 *   POST /point     award point (Phase-1 order: persist → SSE → audit)
 *   POST /undo      undo last point + SSE
 *   GET  /verify    snapshot vs replay + checksum
 *   POST /lock-test dual-session lock contention
 *   POST /cleanup   force-end disposable match
 */

import { createHash } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { and, eq, or, asc } from "drizzle-orm";
import {
  db,
  badmintonCourtsTable,
  scoringMatchesTable,
  badmintonMatchDetailsTable,
  scoringEventsTable,
} from "@workspace/db";
import { extractSyncSnapshot } from "@workspace/badminton-core";
import {
  BadmintonServiceError,
  awardPoint,
  createBadmintonMatch,
  startBadmintonMatch,
  handleForceEndMatch,
  undoLastPoint,
  replayMatch,
} from "../lib/badminton-service";
import { writeScorerAudit } from "../lib/scorer-audit";
import { broadcastBadmintonMatchUpdate } from "../lib/badminton-broadcast";
import {
  markLatency,
  runWithLatencyTrace,
  toPhaseBreakdown,
} from "../lib/badminton-latency-trace";
import { acquireMatchLock, releaseMatchLock } from "../lib/scorer-match-locks";

const router = Router({ mergeParams: true });

const ACTOR = { type: "organizer" as const, id: "latency-probe" };

function tid(req: { params: Record<string, string | undefined> }): number | null {
  const n = Number(req.params.id);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function denyProd(res: { status: (c: number) => { json: (b: unknown) => void } }): boolean {
  if (process.env.NODE_ENV === "production") {
    res.status(404).json({ error: "not found" });
    return true;
  }
  return false;
}

function checksumState(state: Record<string, unknown> | null | undefined): string {
  if (!state) return "null";
  const snap = extractSyncSnapshot(state as never);
  const payload = JSON.stringify(snap);
  return createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

async function findFreeCourt(tournamentId: number) {
  const courts = await db
    .select({
      id: badmintonCourtsTable.id,
      name: badmintonCourtsTable.name,
      shortName: badmintonCourtsTable.shortName,
    })
    .from(badmintonCourtsTable)
    .where(eq(badmintonCourtsTable.tournamentId, tournamentId));

  for (const court of courts) {
    const live = await db
      .select({ id: scoringMatchesTable.id })
      .from(scoringMatchesTable)
      .innerJoin(
        badmintonMatchDetailsTable,
        eq(badmintonMatchDetailsTable.scoringMatchId, scoringMatchesTable.id),
      )
      .where(
        and(
          eq(scoringMatchesTable.tournamentId, tournamentId),
          eq(badmintonMatchDetailsTable.courtId, court.id),
          or(
            eq(scoringMatchesTable.status, "live"),
            eq(scoringMatchesTable.status, "paused"),
          ),
        ),
      )
      .limit(1);
    if (live.length === 0) {
      return { id: court.id, courtNumber: court.shortName ?? court.name };
    }
  }
  return null;
}

router.post("/setup", async (req, res) => {
  if (denyProd(res)) return;
  const tournamentId = tid(req as never);
  if (!tournamentId) return void res.status(400).json({ error: "bad tournament id" });

  const schema = z.object({
    matchKind: z.enum(["singles", "doubles"]).default("singles"),
    totalGames: z.number().int().min(1).max(99).default(1),
    pointsPerGame: z.number().int().min(1).max(999).default(15),
    deuceAt: z.number().int().optional(),
    maxPoints: z.number().int().optional(),
  });
  const parsed = schema.safeParse(req.body ?? {});
  if (!parsed.success) return void res.status(400).json({ error: parsed.error.message });

  const format = {
    totalGames: parsed.data.totalGames,
    pointsPerGame: parsed.data.pointsPerGame,
    deuceAt: parsed.data.deuceAt ?? Math.max(parsed.data.pointsPerGame - 1, 1),
    maxPoints: parsed.data.maxPoints ?? parsed.data.pointsPerGame * 2,
    midGameSideChange: parsed.data.matchKind === "doubles",
  };

  try {
    let court = await findFreeCourt(tournamentId);
    if (!court) {
      const [createdCourt] = await db
        .insert(badmintonCourtsTable)
        .values({
          tournamentId,
          name: `Latency Probe ${Date.now().toString(36).toUpperCase()}`,
          shortName: `P${Date.now().toString(36).slice(-4).toUpperCase()}`,
        })
        .returning({
          id: badmintonCourtsTable.id,
          name: badmintonCourtsTable.name,
          shortName: badmintonCourtsTable.shortName,
        });
      court = {
        id: createdCourt.id,
        courtNumber: createdCourt.shortName ?? createdCourt.name,
      };
    }

    const isDoubles = parsed.data.matchKind === "doubles";
    const leftSideJson = isDoubles
      ? {
          label: "Probe L1 / L2",
          shortLabel: "L",
          playerIds: [1, 2],
          players: [
            { label: "Probe L1", shortLabel: "L1" },
            { label: "Probe L2", shortLabel: "L2" },
          ],
        }
      : { label: "Probe Left", shortLabel: "L", playerIds: [] };
    const rightSideJson = isDoubles
      ? {
          label: "Probe R1 / R2",
          shortLabel: "R",
          playerIds: [3, 4],
          players: [
            { label: "Probe R1", shortLabel: "R1" },
            { label: "Probe R2", shortLabel: "R2" },
          ],
        }
      : { label: "Probe Right", shortLabel: "R", playerIds: [] };

    const createdMatch = await createBadmintonMatch({
      tournamentId,
      courtId: court.id,
      courtNumber: court.courtNumber ?? "PROBE",
      matchLabel: `LATENCY-PROBE-${Date.now()}`,
      matchType: parsed.data.matchKind,
      matchFormatJson: format,
      leftSideJson,
      rightSideJson,
      scheduledAt: new Date(),
    });

    const matchId = createdMatch.match.id;
    await startBadmintonMatch(
      matchId,
      tournamentId,
      {
        matchKind: parsed.data.matchKind,
        format,
        leftSide: leftSideJson as never,
        rightSide: rightSideJson as never,
        firstServer: "left",
        ...(isDoubles
          ? {
              doublesSetup: {
                tossWinnerSide: "left" as const,
                tossDecision: "serve" as const,
                firstServingSide: "left" as const,
                firstServerPlayerIndex: 0 as const,
                firstReceivingSide: "right" as const,
                firstReceiverPlayerIndex: 0 as const,
              },
            }
          : {}),
        courtNumber: court.courtNumber,
        matchLabel: `LATENCY-PROBE-${matchId}`,
      },
      ACTOR,
    );

    res.json({
      ok: true,
      tournamentId,
      matchId,
      matchKind: parsed.data.matchKind,
      format,
      courtId: court.id,
      courtNumber: court.courtNumber,
      displayPath: `/scoring-app/badminton/${matchId}/display?tid=${tournamentId}&latencyProbe=1`,
      streamPath: `/api/tournaments/${tournamentId}/badminton/stream?matchId=${matchId}`,
    });
  } catch (e) {
    if (e instanceof BadmintonServiceError) {
      return void res.status(e.status).json({ error: e.message, code: e.code });
    }
    throw e;
  }
});

router.post("/point", async (req, res) => {
  if (denyProd(res)) return;
  const tournamentId = tid(req as never);
  if (!tournamentId) return void res.status(400).json({ error: "bad tournament id" });

  const schema = z.object({
    matchId: z.number().int().positive(),
    side: z.enum(["left", "right"]).default("left"),
  });
  const parsed = schema.safeParse(req.body ?? {});
  if (!parsed.success) return void res.status(400).json({ error: parsed.error.message });

  try {
    const { result, marks } = await runWithLatencyTrace(async () => {
      markLatency("t2_request_entered");
      const state = await awardPoint(
        parsed.data.matchId,
        tournamentId,
        parsed.data.side,
        ACTOR,
      );
      markLatency("awardPoint_returned");
      markLatency("pre_broadcast");
      broadcastBadmintonMatchUpdate(parsed.data.matchId, tournamentId, state);
      await writeScorerAudit({
        actorType: "organizer",
        actorId: ACTOR.id,
        tournamentId,
        matchId: parsed.data.matchId,
        sport: "badminton",
        action: "point_added",
        payload: { side: parsed.data.side, probe: true },
      });
      markLatency("audit_written");
      return state;
    });

    res.json({
      ok: true,
      tournamentId,
      matchId: parsed.data.matchId,
      leftScore: result.leftScore,
      rightScore: result.rightScore,
      gamesLeft: result.gamesLeft,
      gamesRight: result.gamesRight,
      currentGame: result.currentGame,
      matchStatus: result.matchStatus,
      servingSide: result.servingSide,
      doublesServe: result.doublesServe ?? null,
      lastSequence: result.lastSequence,
      totalRallies: result.totalRallies,
      syncChecksum: checksumState(result as never),
      _latency: toPhaseBreakdown(marks),
      marks,
    });
  } catch (e) {
    if (e instanceof BadmintonServiceError) {
      return void res.status(e.status).json({ error: e.message, code: e.code });
    }
    throw e;
  }
});

router.post("/undo", async (req, res) => {
  if (denyProd(res)) return;
  const tournamentId = tid(req as never);
  if (!tournamentId) return void res.status(400).json({ error: "bad tournament id" });

  const schema = z.object({ matchId: z.number().int().positive() });
  const parsed = schema.safeParse(req.body ?? {});
  if (!parsed.success) return void res.status(400).json({ error: parsed.error.message });

  try {
    const state = await undoLastPoint(parsed.data.matchId, tournamentId, ACTOR);
    broadcastBadmintonMatchUpdate(parsed.data.matchId, tournamentId, state);
    await writeScorerAudit({
      actorType: "organizer",
      actorId: ACTOR.id,
      tournamentId,
      matchId: parsed.data.matchId,
      sport: "badminton",
      action: "undo",
      payload: { probe: true },
    });
    res.json({
      ok: true,
      leftScore: state.leftScore,
      rightScore: state.rightScore,
      lastSequence: state.lastSequence,
      totalRallies: state.totalRallies,
      matchStatus: state.matchStatus,
      syncChecksum: checksumState(state as never),
      state,
    });
  } catch (e) {
    if (e instanceof BadmintonServiceError) {
      return void res.status(e.status).json({ error: e.message, code: e.code });
    }
    throw e;
  }
});

router.get("/verify", async (req, res) => {
  if (denyProd(res)) return;
  const tournamentId = tid(req as never);
  const matchId = Number(req.query.matchId);
  if (!tournamentId || !Number.isFinite(matchId) || matchId <= 0) {
    return void res.status(400).json({ error: "bad ids" });
  }

  const t0 = performance.now();
  const replayed = await replayMatch(matchId, tournamentId);
  const replayMs = performance.now() - t0;
  if (!replayed) return void res.status(404).json({ error: "match not found" });

  const [detail] = await db
    .select({
      snapshot: badmintonMatchDetailsTable.stateSnapshotJson,
    })
    .from(badmintonMatchDetailsTable)
    .where(
      and(
        eq(badmintonMatchDetailsTable.scoringMatchId, matchId),
        eq(badmintonMatchDetailsTable.tournamentId, tournamentId),
      ),
    )
    .limit(1);

  const events = await db
    .select({
      sequence: scoringEventsTable.sequence,
      eventType: scoringEventsTable.eventType,
    })
    .from(scoringEventsTable)
    .where(
      and(
        eq(scoringEventsTable.matchId, matchId),
        eq(scoringEventsTable.sportSlug, "badminton"),
      ),
    )
    .orderBy(asc(scoringEventsTable.sequence));

  const snapshot = (detail?.snapshot ?? null) as Record<string, unknown> | null;
  const replayChecksum = checksumState(replayed as never);
  const snapshotChecksum = checksumState(snapshot);

  const scoreFieldsMatch =
    snapshot != null &&
    Number(snapshot.leftScore) === replayed.leftScore &&
    Number(snapshot.rightScore) === replayed.rightScore &&
    Number(snapshot.gamesLeft) === replayed.gamesLeft &&
    Number(snapshot.gamesRight) === replayed.gamesRight &&
    Number(snapshot.currentGame) === replayed.currentGame &&
    String(snapshot.matchStatus) === replayed.matchStatus &&
    String(snapshot.servingSide) === replayed.servingSide &&
    Number(snapshot.totalRallies ?? 0) === (replayed.totalRallies ?? 0);

  const sequences = events.map((e) => e.sequence);
  const seqSet = new Set(sequences);
  const duplicateSequences = sequences.length !== seqSet.size;
  let missingInRange = false;
  if (sequences.length > 0) {
    const min = sequences[0]!;
    const max = sequences[sequences.length - 1]!;
    for (let s = min; s <= max; s++) {
      if (!seqSet.has(s)) {
        // Gaps can be legitimate after undo tombstones — flag only for reporting
        missingInRange = true;
        break;
      }
    }
  }

  res.json({
    ok: true,
    matchId,
    tournamentId,
    replayMs,
    eventCount: events.length,
    lastSequencePersisted: sequences[sequences.length - 1] ?? 0,
    replayLastSequence: replayed.lastSequence,
    replayChecksum,
    snapshotChecksum,
    checksumEqual: replayChecksum === snapshotChecksum,
    scoreFieldsMatch,
    snapshotPresent: snapshot != null,
    duplicateSequences,
    contiguousSequences: !missingInRange,
    matchStatus: replayed.matchStatus,
    leftScore: replayed.leftScore,
    rightScore: replayed.rightScore,
    servingSide: replayed.servingSide,
    doublesServe: replayed.doublesServe ?? null,
    totalRallies: replayed.totalRallies,
  });
});

router.post("/lock-test", async (req, res) => {
  if (denyProd(res)) return;
  const tournamentId = tid(req as never);
  if (!tournamentId) return void res.status(400).json({ error: "bad tournament id" });

  const schema = z.object({ matchId: z.number().int().positive() });
  const parsed = schema.safeParse(req.body ?? {});
  if (!parsed.success) return void res.status(400).json({ error: parsed.error.message });

  const matchId = parsed.data.matchId;
  const sessionA = `probe-session-a-${Date.now()}`;
  const sessionB = `probe-session-b-${Date.now()}`;

  const a = await acquireMatchLock({
    matchId,
    scorerId: 900001,
    sessionId: sessionA,
    tournamentId,
    sport: "badminton",
  });
  const b = await acquireMatchLock({
    matchId,
    scorerId: 900002,
    sessionId: sessionB,
    tournamentId,
    sport: "badminton",
  });

  // Cleanup A lock so probe matches stay usable
  try {
    await releaseMatchLock({ matchId, sessionId: sessionA, scorerId: 900001 });
  } catch {
    // ignore
  }

  res.json({
    ok: true,
    firstAcquireOk: a.ok,
    secondAcquireOk: b.ok,
    secondBlocked: !b.ok && b.code === "MATCH_LOCKED",
    authoritativeSingleScorer: a.ok && !b.ok && b.code === "MATCH_LOCKED",
  });
});

router.post("/cleanup", async (req, res) => {
  if (denyProd(res)) return;
  const tournamentId = tid(req as never);
  if (!tournamentId) return void res.status(400).json({ error: "bad tournament id" });

  const schema = z.object({ matchId: z.number().int().positive() });
  const parsed = schema.safeParse(req.body ?? {});
  if (!parsed.success) return void res.status(400).json({ error: parsed.error.message });

  const errors: string[] = [];
  try {
    await handleForceEndMatch(parsed.data.matchId, tournamentId, "latency probe cleanup", ACTOR);
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
  }

  res.json({ ok: errors.length === 0, matchId: parsed.data.matchId, errors });
});

export default router;
