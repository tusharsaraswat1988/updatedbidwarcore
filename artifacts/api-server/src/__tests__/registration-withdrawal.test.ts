import { describe, expect, it } from "vitest";
import { PLAYER_AUCTION_STATUSES } from "../lib/player-status";

describe("player withdrawal status contract", () => {
  it("includes withdrawn as a registration lifecycle status", () => {
    expect(PLAYER_AUCTION_STATUSES).toContain("withdrawn");
  });
});
