import { describe, expect, it, vi, beforeEach } from "vitest";

const selectMock = vi.fn();
const insertMock = vi.fn();

vi.mock("@workspace/db", () => ({
  db: {
    select: (...args: unknown[]) => selectMock(...args),
    insert: (...args: unknown[]) => insertMock(...args),
  },
}));

vi.mock("@workspace/db/schema", () => ({
  clientsTable: {
    active: "active",
    displayOrder: "display_order",
    createdAt: "created_at",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ op: "eq", a, b })),
  asc: vi.fn((col) => ({ op: "asc", col })),
}));

import { listActive, listAll } from "../clients-service.js";

describe("clientsService", () => {
  beforeEach(() => {
    selectMock.mockReset();
    insertMock.mockReset();
  });

  it("queries active clients ordered for homepage display", async () => {
    const mockRows = [
      { id: 1, name: "Vyapari Network", clientType: "brand", displayOrder: 0, active: true },
      { id: 2, name: "Rotary Shine", clientType: "organisation", displayOrder: 1, active: true },
    ];
    const orderBy = vi.fn().mockResolvedValue(mockRows);
    const where = vi.fn().mockReturnValue({ orderBy });
    const from = vi.fn().mockReturnValue({ where });
    selectMock.mockReturnValue({ from });

    const rows = await listActive();

    expect(rows).toEqual(mockRows);
    expect(selectMock).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledTimes(1);
    expect(where).toHaveBeenCalledTimes(1);
    expect(orderBy).toHaveBeenCalledTimes(1);
  });

  it("queries all clients for admin panel", async () => {
    const mockRows = [
      { id: 1, name: "Vyapari Network", clientType: "brand", displayOrder: 0, active: true },
      { id: 2, name: "Rotary Shine", clientType: "organisation", displayOrder: 1, active: false },
    ];
    const orderBy = vi.fn().mockResolvedValue(mockRows);
    const from = vi.fn().mockReturnValue({ orderBy });
    selectMock.mockReturnValue({ from });

    const rows = await listAll();

    expect(rows).toEqual(mockRows);
    expect(selectMock).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledTimes(1);
    expect(orderBy).toHaveBeenCalledTimes(1);
  });
});
