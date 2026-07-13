import { describe, expect, it } from "vitest";
import {
  buildScorerHomeView,
  mapMatchStatusToScorerHomeUi,
  pinUnlocksMatch,
  resolveEffectiveScorerPin,
  type ScorerHomeMatchCard,
} from "../lib/badminton-scorer-home";

describe("mapMatchStatusToScorerHomeUi", () => {
  it("maps scheduled to READY / Start Scoring", () => {
    expect(mapMatchStatusToScorerHomeUi("scheduled")).toEqual({
      status: "READY",
      actionLabel: "Start Scoring",
      readOnly: false,
    });
  });

  it("maps live to LIVE / Resume", () => {
    expect(mapMatchStatusToScorerHomeUi("live")).toEqual({
      status: "LIVE",
      actionLabel: "Resume",
      readOnly: false,
    });
  });

  it("maps paused to PAUSED / Resume", () => {
    expect(mapMatchStatusToScorerHomeUi("paused")).toEqual({
      status: "PAUSED",
      actionLabel: "Resume",
      readOnly: false,
    });
  });

  it("maps terminal states to COMPLETED / Read Only", () => {
    for (const status of ["completed", "walkover", "retired", "disqualified", "abandoned"]) {
      expect(mapMatchStatusToScorerHomeUi(status)).toEqual({
        status: "COMPLETED",
        actionLabel: "Read Only",
        readOnly: true,
      });
    }
  });
});

describe("pinUnlocksMatch resolution", () => {
  it("match PIN overrides court PIN", () => {
    expect(
      pinUnlocksMatch({ pin: "1111", matchPin: "1111", courtPin: "2222" }),
    ).toEqual({ ok: true, via: "match_pin" });
    expect(
      pinUnlocksMatch({ pin: "2222", matchPin: "1111", courtPin: "2222" }),
    ).toEqual({ ok: false, via: null });
  });

  it("inherits court PIN when match PIN is empty", () => {
    expect(
      pinUnlocksMatch({ pin: "2222", matchPin: null, courtPin: "2222" }),
    ).toEqual({ ok: true, via: "court_pin" });
    expect(
      pinUnlocksMatch({ pin: "2222", matchPin: "  ", courtPin: "2222" }),
    ).toEqual({ ok: true, via: "court_pin" });
  });

  it("denies when neither pin matches", () => {
    expect(
      pinUnlocksMatch({ pin: "9999", matchPin: null, courtPin: "2222" }),
    ).toEqual({ ok: false, via: null });
  });
});

describe("resolveEffectiveScorerPin", () => {
  it("prefers match PIN then court PIN", () => {
    expect(resolveEffectiveScorerPin("1111", "2222")).toBe("1111");
    expect(resolveEffectiveScorerPin(null, "2222")).toBe("2222");
    expect(resolveEffectiveScorerPin("", "")).toBeNull();
  });
});

describe("buildScorerHomeView", () => {
  const match = (partial: Partial<ScorerHomeMatchCard>): ScorerHomeMatchCard => ({
    id: 1,
    category: "MS",
    playerA: "A",
    playerB: "B",
    court: "C1",
    courtId: 10,
    scheduledAt: null,
    status: "READY",
    matchStatus: "scheduled",
    actionLabel: "Start Scoring",
    readOnly: false,
    accessVia: "court_pin",
    ...partial,
  });

  it("uses court view for a single assigned court", () => {
    const view = buildScorerHomeView({
      matches: [match({ id: 1, courtId: 10 })],
      courts: [{ id: 10, name: "Court 1", shortName: "C1", scorerName: "Umpire" }],
    });
    expect(view.view).toBe("court");
    expect(view.courts).toHaveLength(1);
    expect(view.courts[0]?.currentMatch?.id).toBe(1);
  });

  it("uses courts view for multiple courts", () => {
    const view = buildScorerHomeView({
      matches: [],
      courts: [
        { id: 1, name: "Court 1", shortName: "C1", scorerName: null },
        { id: 2, name: "Court 2", shortName: "C2", scorerName: null },
      ],
    });
    expect(view.view).toBe("courts");
    expect(view.courts).toHaveLength(2);
  });

  it("falls back to matches view without court assignment", () => {
    const view = buildScorerHomeView({
      matches: [match({ id: 5, courtId: null, accessVia: "match_pin" })],
      courts: [],
    });
    expect(view.view).toBe("matches");
    expect(view.matches).toHaveLength(1);
  });
});
