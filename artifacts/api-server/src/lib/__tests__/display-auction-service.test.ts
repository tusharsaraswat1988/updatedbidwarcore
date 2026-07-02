import { describe, expect, it, vi, beforeEach } from "vitest";

const selectMock = vi.fn();

vi.mock("@workspace/db", () => ({
  db: {
    select: (...args: unknown[]) => selectMock(...args),
  },
}));

vi.mock("@workspace/db/schema", () => ({
  displayAuctionsTable: {
    showOnLanding: "show_on_landing",
    scheduledDate: "scheduled_date",
    scheduledTime: "scheduled_time",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ op: "eq", a, b })),
  asc: vi.fn((col) => ({ op: "asc", col })),
}));

import { listForLanding } from "../display-auction-service.js";

describe("displayAuctionService.listForLanding", () => {
  beforeEach(() => {
    selectMock.mockReset();
  });

  it("queries landing display auctions ordered by schedule", async () => {
    const orderBy = vi.fn().mockResolvedValue([{ id: 1, showOnLanding: true }]);
    const where = vi.fn().mockReturnValue({ orderBy });
    const from = vi.fn().mockReturnValue({ where });
    selectMock.mockReturnValue({ from });

    const rows = await listForLanding();

    expect(rows).toEqual([{ id: 1, showOnLanding: true }]);
    expect(selectMock).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledTimes(1);
    expect(where).toHaveBeenCalledTimes(1);
    expect(orderBy).toHaveBeenCalledTimes(1);
  });
});
