import { describe, expect, it } from "vitest";
import adminMembersRouter from "../routes/admin-members";

describe("Admin Members Directory Router & Service", () => {
  it("exports an Express router with members endpoints", () => {
    expect(adminMembersRouter).toBeDefined();
    // Check that routes are registered
    const stack = (adminMembersRouter as unknown as { stack: Array<{ route?: { path: string; methods: Record<string, boolean> } }> }).stack;
    const paths = stack.filter((layer) => layer.route).map((layer) => layer.route?.path);

    expect(paths).toContain("/auth/admin/members");
    expect(paths).toContain("/auth/admin/members/:id");
    expect(paths).toContain("/auth/admin/members/sync");
    expect(paths).toContain("/auth/admin/communicate/contacts/player/:id");
    expect(paths).toContain("/auth/admin/communicate/contacts/team/:id");
  });
});
