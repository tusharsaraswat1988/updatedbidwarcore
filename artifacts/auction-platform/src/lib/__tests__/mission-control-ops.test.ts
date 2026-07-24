import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildAttentionItems,
  courtDisplayPriority,
  explainStartBlocker,
  resolvePrimaryAction,
  sortCourtsByOpsPriority,
  type CourtBoardRow,
} from "../mission-control-ops.ts";
import type { ControlMatch } from "../badminton-control-center.ts";

function row(
  partial: Partial<CourtBoardRow> & { courtId: number; status: CourtBoardRow["status"] },
): CourtBoardRow {
  return {
    court: {
      id: partial.courtId,
      name: `Court ${partial.courtId}`,
      shortName: `C${partial.courtId}`,
      sortOrder: partial.courtId,
      scorerPin: partial.court?.scorerPin ?? "1234",
      hasScorerPin: partial.court?.hasScorerPin ?? true,
    },
    status: partial.status,
    currentMatch: partial.currentMatch ?? null,
    nextMatch: partial.nextMatch ?? null,
    nextFixture: partial.nextFixture ?? null,
    readyOverflow: 0,
    delayed: partial.status === "DELAYED",
    ...partial,
  };
}

describe("mission-control-ops", () => {
  it("sorts courts LIVE → DELAYED → READY → WAITING → EMPTY → FINISHED", () => {
    const board = [
      row({ courtId: 1, status: "EMPTY" }),
      row({ courtId: 2, status: "FINISHED", nextFixture: { id: 9, categoryId: 1, status: "scheduled" } as never }),
      row({ courtId: 3, status: "READY", currentMatch: { id: 1, status: "scheduled", detail: null, state: null } }),
      row({ courtId: 4, status: "LIVE", currentMatch: { id: 2, status: "live", detail: null, state: null } }),
      row({ courtId: 5, status: "DELAYED", currentMatch: { id: 3, status: "scheduled", detail: null, state: null } }),
    ];
    const sorted = sortCourtsByOpsPriority(board);
    assert.deepEqual(
      sorted.map((r) => courtDisplayPriority(r)),
      ["LIVE", "DELAYED", "READY", "WAITING", "EMPTY"],
    );
  });

  it("explains missing scorer as start blocker", () => {
    const r = row({
      courtId: 1,
      status: "READY",
      currentMatch: { id: 10, status: "scheduled", detail: null, state: null },
      court: {
        id: 1,
        name: "Court 1",
        sortOrder: 1,
        scorerPin: null,
        hasScorerPin: false,
      },
    });
    assert.match(explainStartBlocker(r) ?? "", /scorer/i);
  });

  it("surfaces delayed and finished-needs-assign in attention", () => {
    const delayedMatch: ControlMatch = {
      id: 5,
      status: "scheduled",
      scheduledAt: "2020-01-01T00:00:00.000Z",
      detail: { courtId: 2 },
      state: null,
    };
    const board = [
      row({ courtId: 2, status: "DELAYED", currentMatch: delayedMatch }),
      row({
        courtId: 3,
        status: "FINISHED",
        currentMatch: { id: 8, status: "completed", detail: null, state: null },
        nextFixture: { id: 12, categoryId: 1, status: "scheduled" } as never,
      }),
    ];
    const items = buildAttentionItems({
      board,
      matches: [delayedMatch],
      ready: [],
      primaryMatchId: null,
      tournamentId: 7,
    });
    assert.ok(items.some((i) => i.problem.includes("delayed")));
    assert.ok(items.some((i) => i.problem.includes("next not assigned")));
  });

  it("picks Start Next Match when ready exists", () => {
    const ready: ControlMatch = {
      id: 42,
      status: "scheduled",
      detail: { courtId: 1 },
      state: null,
    };
    const action = resolvePrimaryAction({
      board: [row({ courtId: 1, status: "READY", currentMatch: ready })],
      ready: [ready],
      tournamentId: 3,
    });
    assert.equal(action.kind, "start");
    assert.match(action.label, /Start Next/i);
    assert.equal(action.matchId, 42);
  });
});
