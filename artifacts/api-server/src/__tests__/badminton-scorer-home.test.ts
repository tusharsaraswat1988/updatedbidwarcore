import { describe, expect, it } from "vitest";
import { mapMatchStatusToScorerHomeUi } from "../lib/badminton-scorer-home";

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
