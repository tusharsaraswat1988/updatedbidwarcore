import { describe, expect, it } from "vitest";
import adminMembersRouter from "../routes/admin-members";
import {
  reconcileAllPlatformMembers,
  getMemberKpis,
  listMembers,
  normalizeIndianMobile,
} from "../lib/members/member-directory-service";
import { pool } from "@workspace/db";

describe("Admin Members Directory Router & Service", () => {
  it("exports an Express router with all administrative members endpoints", () => {
    expect(adminMembersRouter).toBeDefined();
    const stack = (adminMembersRouter as unknown as { stack: Array<{ route?: { path: string; methods: Record<string, boolean> } }> }).stack;
    const paths = stack.filter((layer) => layer.route).map((layer) => layer.route?.path);

    expect(paths).toContain("/auth/admin/members");
    expect(paths).toContain("/auth/admin/members/:id");
    expect(paths).toContain("/auth/admin/members/sync");
    expect(paths).toContain("/auth/admin/communicate/contacts/player/:id");
    expect(paths).toContain("/auth/admin/communicate/contacts/team/:id");
  });

  it("normalizes Indian mobile numbers correctly", () => {
    expect(normalizeIndianMobile("9876543210")).toBe("9876543210");
    expect(normalizeIndianMobile("+919876543210")).toBe("9876543210");
    expect(normalizeIndianMobile("09876543210")).toBe("9876543210");
    expect(normalizeIndianMobile("919876543210")).toBe("9876543210");
    expect(normalizeIndianMobile("12345")).toBeNull();
    expect(normalizeIndianMobile("")).toBeNull();
    expect(normalizeIndianMobile(null)).toBeNull();
  });

  it("reconciles all platform members into canonical members with accurate roles", async () => {
    const syncRes = await reconcileAllPlatformMembers(pool);
    expect(syncRes).toBeDefined();
    expect(syncRes.totalMembers).toBeGreaterThan(0);
    expect(syncRes.ownersCount).toBeGreaterThan(0);
    expect(syncRes.organizersCount).toBeGreaterThan(0);
    expect(syncRes.playersCount).toBeGreaterThan(0);

    const kpis = await getMemberKpis();
    expect(kpis.totalMembers).toBeGreaterThan(0);
    expect(kpis.activePlayers).toBeGreaterThan(0);
    expect(kpis.franchiseOwners).toBeGreaterThan(0);

    const listRes = await listMembers({ page: 1, limit: 10 });
    expect(listRes.members.length).toBeGreaterThan(0);
    expect(listRes.total).toBeGreaterThan(0);
  });
});
