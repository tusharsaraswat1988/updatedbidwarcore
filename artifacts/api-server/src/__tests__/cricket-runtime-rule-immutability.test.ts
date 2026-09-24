import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CricketEventType,
  createEventEnvelope,
  createInitialCricketState,
  replayCricketEvents,
  isCricketMatchTerminalState,
  type MatchMeta,
  type CricketScoreboardState,
} from "@workspace/scoring-core";
import { replayScoringMatchState } from "../lib/scoring-platform";
import "../lib/scoring-adapters/register";

describe("CRICKET SCORING P0 FIX #4 — Runtime Rule Immutability After Match Start", () => {
  const scoringServiceSrc = readFileSync(
    resolve(__dirname, "../lib/scoring-service.ts"),
    "utf8",
  ).replace(/\r\n/g, "\n");
  const runtimeMatchServiceSrc = readFileSync(
    resolve(__dirname, "../lib/runtime-match-service.ts"),
    "utf8",
  ).replace(/\r\n/g, "\n");
  const cricketRulesServiceSrc = readFileSync(
    resolve(__dirname, "../lib/cricket-rules-service.ts"),
    "utf8",
  ).replace(/\r\n/g, "\n");

  describe("Contract Inspection: updateScoringMatch", () => {
    const start = scoringServiceSrc.indexOf("export async function updateScoringMatch");
    const next = scoringServiceSrc.indexOf("\nexport async function", start + 1);
    const updateFn = scoringServiceSrc.slice(start, next === -1 ? scoringServiceSrc.length : next);

    it("serializes concurrent execution with row lock on scoring_sessions", () => {
      expect(updateFn).toContain("SELECT id FROM scoring_sessions WHERE match_id = ${matchId} FOR UPDATE");
      expect(updateFn).toContain("await db.transaction(async (tx) =>");
    });

    it("inspects both match status, startedAt, and existing events to determine started boundary", () => {
      expect(updateFn).toContain('matchRow.status !== "scheduled"');
      expect(updateFn).toContain("matchRow.startedAt !== null");
      expect(updateFn).toContain("scoringEventsTable");
    });

    it("locks rules and throws 409 SCORING_RULES_LOCKED if overs mutation attempted after start", () => {
      expect(updateFn).toContain("SCORING_RULES_LOCKED");
      expect(updateFn).toContain("409");
      expect(updateFn).toContain("input.oversLimit !== undefined && input.oversLimit !== currentOvers");
    });

    it("allows display and presentation metadata (venue, roundName, scheduledAt, resultSummary) post-start", () => {
      expect(updateFn).toContain("patch.roundName = input.roundName");
      expect(updateFn).toContain("patch.venue = input.venue");
      expect(updateFn).toContain("patch.resultSummary = input.resultSummary");
      expect(updateFn).toContain("patch.scheduledAt = input.scheduledAt");
    });

    it("only permits oversLimit and team changes when match has NOT started", () => {
      expect(updateFn).toContain("!started && input.oversLimit !== undefined");
      expect(updateFn).toContain("!started && input.homeTeamId !== undefined");
      expect(updateFn).toContain("!started && input.awayTeamId !== undefined");
    });

    it("never calls prepareRuntimeMatch if match is already started", () => {
      expect(updateFn).toContain("if (!isStarted) {\n    await prepareRuntimeMatch(tournamentId, matchId, null);\n  }");
    });

    it("does not overwrite session stateJson with initial blank state if match has started", () => {
      expect(updateFn).toContain("if (!isStarted) {\n    await db\n      .update(scoringSessionsTable)\n      .set({ stateJson: refreshedState, updatedAt: new Date() })\n      .where(eq(scoringSessionsTable.matchId, matchId));\n  }");
    });
  });

  describe("Contract Inspection: prepareRuntimeMatch", () => {
    const start = runtimeMatchServiceSrc.indexOf("export async function prepareRuntimeMatch");
    const next = runtimeMatchServiceSrc.indexOf("\nexport async function", start + 1);
    const prepFn = runtimeMatchServiceSrc.slice(start, next === -1 ? runtimeMatchServiceSrc.length : next);

    it("rejects re-preparing an active, started, or completed match with 409", () => {
      expect(prepFn).toContain("scoringEventsTable");
      expect(prepFn).toContain("status: 409");
      expect(prepFn).toContain("Runtime execution rules are locked after match start. Cannot re-prepare an active or completed match.");
    });
  });

  describe("Contract Inspection: applyCricketRulesToMatches", () => {
    const start = cricketRulesServiceSrc.indexOf("export async function applyCricketRulesToMatches");
    const next = cricketRulesServiceSrc.indexOf("\nexport async function", start + 1);
    const applyFn = cricketRulesServiceSrc.slice(start, next === -1 ? cricketRulesServiceSrc.length : next);

    it("skips started, active, or completed matches when applying competition rules", () => {
      expect(applyFn).toContain('match.status !== "scheduled"');
      expect(applyFn).toContain("match.startedAt !== null");
      expect(applyFn).toContain("continue;");
    });
  });

  describe("Domain Integrity: Historical Replay Determinism & Freeze Boundary", () => {
    const BASE_META: MatchMeta = {
      matchId: 999,
      tournamentId: 10,
      homeTeamId: 1,
      awayTeamId: 2,
      oversLimit: 10, // 10 overs locked at start
    };

    function generateOverOfBalls(innings: number, over: number, sequenceStart: number) {
      const events: ReturnType<typeof createEventEnvelope>[] = [];
      for (let ball = 1; ball <= 6; ball++) {
        events.push(
          createEventEnvelope({
            matchId: BASE_META.matchId,
            tournamentId: BASE_META.tournamentId,
            sportSlug: "cricket",
            eventType: CricketEventType.BALL_RECORDED,
            sequence: sequenceStart + ball - 1,
            payload: {
              innings,
              over,
              ball,
              strikerId: 101,
              nonStrikerId: 102,
              bowlerId: 201,
              runsOffBat: 1,
              extras: { type: null, runs: 0 },
              wicket: null,
              isLegalDelivery: true,
            },
            actorType: "organizer",
          }),
        );
      }
      return events;
    }

    it("MATCH_STARTED event embeds oversLimit into event stream and establishes the immutability boundary", () => {
      const startEvent = createEventEnvelope({
        matchId: BASE_META.matchId,
        tournamentId: BASE_META.tournamentId,
        sportSlug: "cricket",
        eventType: CricketEventType.MATCH_STARTED,
        sequence: 1,
        payload: { tossWinnerTeamId: 1, electedTo: "bat", oversLimit: 10 },
        actorType: "organizer",
      });

      const initial = createInitialCricketState(BASE_META);
      const replayed = replayCricketEvents(BASE_META, [startEvent]);

      expect(replayed.matchStatus).toBe("live");
      expect(replayed.oversLimit).toBe(10);
    });

    it("historical replay is deterministic and adheres to the original oversLimit even if metadata attempts to pass 20 overs", () => {
      const startEvent = createEventEnvelope({
        matchId: BASE_META.matchId,
        tournamentId: BASE_META.tournamentId,
        sportSlug: "cricket",
        eventType: CricketEventType.MATCH_STARTED,
        sequence: 1,
        payload: { tossWinnerTeamId: 1, electedTo: "bat", oversLimit: 10 },
        actorType: "organizer",
      });

      const events = [startEvent, ...generateOverOfBalls(1, 0, 2)];

      // Replaying under original meta (10 overs)
      const stateUnder10 = replayScoringMatchState<CricketScoreboardState>("cricket", BASE_META, events);
      expect(stateUnder10.oversLimit).toBe(10);

      // Even if an external caller tried to replay with a mutated meta (20 overs),
      // the MATCH_STARTED event enforces the original locked overs
      const mutatedMeta: MatchMeta = { ...BASE_META, oversLimit: 20 };
      const stateUnderMutated = replayScoringMatchState<CricketScoreboardState>("cricket", mutatedMeta, events);
      expect(stateUnderMutated.oversLimit).toBe(10);
    });

    it("terminal state evaluation respects the locked overs limit (10 overs, not 20)", () => {
      const startEvent = createEventEnvelope({
        matchId: BASE_META.matchId,
        tournamentId: BASE_META.tournamentId,
        sportSlug: "cricket",
        eventType: CricketEventType.MATCH_STARTED,
        sequence: 1,
        payload: { tossWinnerTeamId: 1, electedTo: "bat", oversLimit: 10 },
        actorType: "organizer",
      });

      // Bowl 10 complete overs in innings 1
      let seq = 2;
      const allEvents = [startEvent];
      for (let o = 0; o < 10; o++) {
        allEvents.push(...generateOverOfBalls(1, o, seq));
        seq += 6;
      }

      allEvents.push(
        createEventEnvelope({
          matchId: BASE_META.matchId,
          tournamentId: BASE_META.tournamentId,
          sportSlug: "cricket",
          eventType: CricketEventType.INNINGS_ENDED,
          sequence: seq++,
          payload: {
            innings: 1,
            reason: "overs_complete",
            runs: 60,
            wickets: 0,
            overs: "10.0",
          },
          actorType: "organizer",
        }),
      );

      const endInnings1State = replayCricketEvents(BASE_META, allEvents);
      // Innings 1 has 10 complete overs bowled (0-indexed over 9, ball 6)
      expect(endInnings1State.innings[0].over).toBe(9);
      expect(endInnings1State.innings[0].ball).toBe(6);
      expect(endInnings1State.innings[0].phase).toBe("completed");

      // Bowl 10 complete overs in innings 2 (innings 2 is initiated by the first ball of innings 2)
      for (let o = 0; o < 10; o++) {
        allEvents.push(...generateOverOfBalls(2, o, seq));
        seq += 6;
      }

      allEvents.push(
        createEventEnvelope({
          matchId: BASE_META.matchId,
          tournamentId: BASE_META.tournamentId,
          sportSlug: "cricket",
          eventType: CricketEventType.INNINGS_ENDED,
          sequence: seq++,
          payload: {
            innings: 2,
            reason: "overs_complete",
            runs: 60,
            wickets: 0,
            overs: "10.0",
          },
          actorType: "organizer",
        }),
      );

      const endMatchState = replayCricketEvents(BASE_META, allEvents);
      expect(endMatchState.innings[1].over).toBe(9);
      expect(endMatchState.innings[1].ball).toBe(6);
      expect(endMatchState.innings[1].phase).toBe("completed");

      // Terminal state check should validate as complete because 10 of 10 overs are bowled
      const terminal = isCricketMatchTerminalState(endMatchState);
      expect(terminal.valid).toBe(true);
    });
  });
});
