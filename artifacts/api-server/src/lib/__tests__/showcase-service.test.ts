import { describe, expect, it, vi, beforeEach } from "vitest";

const selectMock = vi.fn();

vi.mock("@workspace/db", () => ({
  db: {
    select: (...args: unknown[]) => selectMock(...args),
  },
}));

vi.mock("@workspace/db/schema", () => ({
  showcaseEventsTable: {
    active: "active",
    displayOrder: "display_order",
    createdAt: "created_at",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ op: "eq", a, b })),
  asc: vi.fn((col) => ({ op: "asc", col })),
}));

import { listActive } from "../showcase-service.js";

describe("showcaseService.listActive", () => {
  beforeEach(() => {
    selectMock.mockReset();
  });

  it("queries active showcase events ordered for the gallery", async () => {
    const orderBy = vi.fn().mockResolvedValue([{ id: 10, active: true }]);
    const where = vi.fn().mockReturnValue({ orderBy });
    const from = vi.fn().mockReturnValue({ where });
    selectMock.mockReturnValue({ from });

    const rows = await listActive();

    expect(rows).toEqual([{ id: 10, active: true }]);
    expect(selectMock).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledTimes(1);
    expect(where).toHaveBeenCalledTimes(1);
    expect(orderBy).toHaveBeenCalledTimes(1);
  });
});
