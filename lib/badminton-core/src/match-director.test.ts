import { describe, it, expect } from "vitest";
import {
  BadmintonEventType,
  cmdAddMatchNote,
  cmdAwardPoint,
  cmdDeclareDisqualification,
  cmdDeclareRetirement,
  cmdDeclareWalkover,
  cmdPauseMatch,
  cmdResumeMatch,
  cmdForceEndMatch,
  cmdStartMatch,
  reduceBadminton,
  replayBadmintonEvents,
  deriveIncidentLog,
  buildMatchReport,
  deriveDirectorStatusBanner,
  formatPauseReason,
  STANDARD_FORMAT,
  type BadmintonEventEnvelope,
  type BadmintonMatchMeta,
} from "./index";

const META: BadmintonMatchMeta = {
  matchId: 1,
  tournamentId: 10,
  matchKind: "singles",
};

function makeEnvelope(
  seq: number,
  eventType: string,
  payload: Record<string, unknown>,
  actorType: BadmintonEventEnvelope["actorType"] = "tournament_director",
): BadmintonEventEnvelope {
  return {
    matchId: META.matchId,
    tournamentId: META.tournamentId,
    sportSlug: "badminton",
    eventType,
    eventVersion: 1,
    sequence: seq,
    occurredAt: `2026-06-17T14:${String(seq).padStart(2, "0")}:00.000Z`,
    actorType,
    actorId: "director-1",
    payload,
  };
}

function startLiveMatch(): BadmintonEventEnvelope[] {
  const startPayload = {
    matchKind: "singles" as const,
    format: STANDARD_FORMAT,
    leftSide: { label: "Alice", shortLabel: "ALC", playerIds: [1] },
    rightSide: { label: "Bob", shortLabel: "BOB", playerIds: [2] },
    firstServer: "left" as const,
  };

  const initial = replayBadmintonEvents(META, []);
  const result = cmdStartMatch(initial, startPayload);
  if (!result.ok) throw new Error(result.error);

  return result.events.map((e, i) =>
    makeEnvelope(i + 1, e.eventType, e.payload, "organizer"),
  );
}

function appendCommand(
  events: BadmintonEventEnvelope[],
  cmdResult:
    | ReturnType<typeof cmdPauseMatch>
    | ReturnType<typeof cmdResumeMatch>
    | ReturnType<typeof cmdAddMatchNote>
    | ReturnType<typeof cmdDeclareRetirement>
    | ReturnType<typeof cmdDeclareWalkover>
    | ReturnType<typeof cmdDeclareDisqualification>
    | ReturnType<typeof cmdForceEndMatch>
    | ReturnType<typeof cmdAwardPoint>,
): BadmintonEventEnvelope[] {
  if (!cmdResult.ok) throw new Error(cmdResult.error);
  const state = replayBadmintonEvents(META, events);
  let seq = state.lastSequence;
  const next = [...events];
  for (const e of cmdResult.events) {
    seq += 1;
    next.push(makeEnvelope(seq, e.eventType, e.payload));
  }
  return next;
}

describe("Tournament Director — pause / resume", () => {
  it("pauses and resumes a live match with reason in event log", () => {
    let events = startLiveMatch();
    const liveState = replayBadmintonEvents(META, events);
    expect(liveState.matchStatus).toBe("live");

    events = appendCommand(events, cmdPauseMatch(liveState, "medical"));
    const paused = replayBadmintonEvents(META, events);
    expect(paused.matchStatus).toBe("paused");
    expect(paused.isPaused).toBe(true);
    expect(paused.pauseReason).toBe("medical");

    expect(cmdAwardPoint(paused, "left").ok).toBe(false);

    events = appendCommand(events, cmdResumeMatch(paused));
    const resumed = replayBadmintonEvents(META, events);
    expect(resumed.matchStatus).toBe("live");
    expect(resumed.isPaused).toBe(false);

    const log = deriveIncidentLog(events);
    expect(log.some((e) => e.label === "Medical Timeout")).toBe(true);
    expect(log.some((e) => e.label === "Play Resumed")).toBe(true);
  });

  it("formats pause reason for display", () => {
    expect(formatPauseReason("medical")).toBe("Medical Timeout");
    expect(formatPauseReason("other", "Lighting interruption")).toBe("Lighting interruption");
  });
});

describe("Tournament Director — retirement", () => {
  it("declares retirement with reason and generates result", () => {
    let events = startLiveMatch();
    const live = replayBadmintonEvents(META, events);

    events = appendCommand(events, cmdDeclareRetirement(live, "left", "injury"));
    const state = replayBadmintonEvents(META, events);

    expect(state.matchStatus).toBe("retired");
    expect(state.winnerSide).toBe("right");
    expect(state.resultReason).toBe("retirement");

    const log = deriveIncidentLog(events);
    expect(log.some((e) => e.label.includes("Retirement"))).toBe(true);
    expect(log.some((e) => e.label === "Match Ended (Retirement)")).toBe(true);
  });
});

describe("Tournament Director — walkover", () => {
  it("declares walkover from scheduled state", () => {
    const initial = replayBadmintonEvents(META, []);
    expect(initial.matchStatus).toBe("scheduled");

    const events = appendCommand(
      [],
      cmdDeclareWalkover(initial, "right", "opponent_absent"),
    );
    const state = replayBadmintonEvents(META, events);

    expect(state.matchStatus).toBe("walkover");
    expect(state.winnerSide).toBe("right");

    const banner = deriveDirectorStatusBanner(state);
    expect(banner?.kind).toBe("walkover");
  });
});

describe("Tournament Director — disqualification", () => {
  it("requires reason and ends match", () => {
    let events = startLiveMatch();
    const live = replayBadmintonEvents(META, events);

    expect(cmdDeclareDisqualification(live, "right", "").ok).toBe(false);

    events = appendCommand(
      events,
      cmdDeclareDisqualification(live, "right", "Unsportsmanlike conduct"),
    );
    const state = replayBadmintonEvents(META, events);

    expect(state.matchStatus).toBe("disqualified");
    expect(state.winnerSide).toBe("left");

    const banner = deriveDirectorStatusBanner(state);
    expect(banner?.title).toBe("DISQUALIFIED");
  });
});

describe("Tournament Director — notes", () => {
  it("adds notes to match state and report", () => {
    let events = startLiveMatch();
    const live = replayBadmintonEvents(META, events);

    events = appendCommand(events, cmdAddMatchNote(live, "Player injured ankle."));
    events = appendCommand(
      events,
      cmdAddMatchNote(replayBadmintonEvents(META, events), "Court surface issue."),
    );

    const state = replayBadmintonEvents(META, events);
    expect(state.matchNotes).toHaveLength(2);
    expect(state.matchNotes[0]?.text).toBe("Player injured ankle.");

    const report = buildMatchReport(state, events);
    expect(report.notes).toHaveLength(2);
    expect(report.notes[0]?.text).toBe("Player injured ankle.");
  });
});

describe("Tournament Director — force end", () => {
  it("force ends match as abandoned", () => {
    let events = startLiveMatch();
    const live = replayBadmintonEvents(META, events);

    events = appendCommand(events, cmdForceEndMatch(live, "Venue evacuation"));
    const state = replayBadmintonEvents(META, events);

    expect(state.matchStatus).toBe("abandoned");
    expect(state.resultReason).toBe("abandoned");
  });
});

describe("Tournament Director — replay integrity", () => {
  it("reconstructs full director action sequence from events", () => {
    let events = startLiveMatch();
    let state = replayBadmintonEvents(META, events);

    events = appendCommand(events, cmdPauseMatch(state, "weather"));
    state = replayBadmintonEvents(META, events);
    expect(state.isPaused).toBe(true);

    events = appendCommand(events, cmdResumeMatch(state));
    state = replayBadmintonEvents(META, events);
    expect(state.matchStatus).toBe("live");

    events = appendCommand(events, cmdAddMatchNote(state, "Lighting interruption."));
    state = replayBadmintonEvents(META, events);

    events = appendCommand(events, cmdDeclareRetirement(state, "right", "illness"));
    state = replayBadmintonEvents(META, events);

    expect(state.matchStatus).toBe("retired");
    expect(state.matchNotes).toHaveLength(1);

    const report = buildMatchReport(state, events);
    expect(report.timeline.length).toBeGreaterThan(0);
    expect(report.incidents.some((i) => i.label.includes("Weather"))).toBe(true);
    expect(report.incidents.some((i) => i.label === "Play Resumed")).toBe(true);

    const pausedBanner = deriveDirectorStatusBanner(
      replayBadmintonEvents(META, events.slice(0, 2)),
    );
    expect(pausedBanner?.kind).toBe("paused");
  });
});

describe("Tournament Director — match report export", () => {
  it("builds JSON report with players, score, timeline, notes, duration", () => {
    let events = startLiveMatch();
    let state = replayBadmintonEvents(META, events);

    for (let i = 0; i < 3; i++) {
      state = replayBadmintonEvents(META, events);
      events = appendCommand(events, cmdAwardPoint(state, "left"));
    }

    state = replayBadmintonEvents(META, events);
    events = appendCommand(events, cmdAddMatchNote(state, "Test note"));

    state = replayBadmintonEvents(META, events);
    const report = buildMatchReport(state, events);

    expect(report.players.left.shortLabel).toBe("ALC");
    expect(report.players.right.shortLabel).toBe("BOB");
    expect(report.gamesWon.left).toBeGreaterThanOrEqual(0);
    expect(report.notes.length).toBe(1);
    expect(report.timeline.length).toBeGreaterThan(0);
    expect(report.matchId).toBe(1);
  });
});
