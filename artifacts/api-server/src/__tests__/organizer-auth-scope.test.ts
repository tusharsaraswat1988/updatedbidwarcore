import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

/**
 * Regression: bare `router.use(requireMasterAdmin)` on communication-center
 * blocked every API request (including badminton organizer saves) with
 * "Super Admin access required".
 */
describe("communication-center Super Admin mount", () => {
  it("scopes requireMasterAdmin to /auth/admin/communication-center only", async () => {
    const src = await readFile(
      new URL("../routes/communication-center.ts", import.meta.url),
      "utf8",
    );
    expect(src).toContain(
      'router.use("/auth/admin/communication-center", requireMasterAdmin)',
    );
    expect(src).not.toMatch(/^\s*router\.use\(requireMasterAdmin\);/m);
  });
});
