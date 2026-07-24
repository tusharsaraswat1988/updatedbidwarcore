import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

/**
 * Regression: bare `router.use(requireMasterAdmin)` on communication-center
 * when that router was mounted at `/` blocked every unmatched API request
 * (including badminton organizer saves) with "Super Admin access required".
 *
 * Defense in depth:
 * 1. Mount communication-center at `/auth/admin/communication-center` in index.ts
 * 2. Keep requireMasterAdmin inside that router (safe under the path prefix)
 */
describe("communication-center Super Admin mount", () => {
  it("mounts communication-center under /auth/admin/communication-center in index", async () => {
    const src = await readFile(new URL("../routes/index.ts", import.meta.url), "utf8");
    expect(src).toContain(
      'router.use("/auth/admin/communication-center", communicationCenterRouter)',
    );
    expect(src).not.toMatch(/^\s*router\.use\(communicationCenterRouter\);/m);
  });

  it("keeps badminton/scoring mounts above communication-center", async () => {
    const src = await readFile(new URL("../routes/index.ts", import.meta.url), "utf8");
    const badmintonAt = src.indexOf('router.use("/tournaments/:id/badminton", badmintonRouter)');
    const commAt = src.indexOf(
      'router.use("/auth/admin/communication-center", communicationCenterRouter)',
    );
    expect(badmintonAt).toBeGreaterThan(-1);
    expect(commAt).toBeGreaterThan(-1);
    expect(badmintonAt).toBeLessThan(commAt);
  });

  it("does not register absolute /auth/admin/communication-center paths inside the router", async () => {
    const src = await readFile(
      new URL("../routes/communication-center.ts", import.meta.url),
      "utf8",
    );
    expect(src).toMatch(/^\s*router\.use\(requireMasterAdmin\);/m);
    expect(src).not.toMatch(
      /router\.(get|post|put|patch|delete)\("\/auth\/admin\/communication-center/,
    );
  });
});

/**
 * Regression: diagnostics mounted `requireMasterAdmin` at bare `/auth/admin`,
 * which blocked organizer POST /auth/admin/communicate/consent-declare-bulk
 * with "Super Admin access required" before the comm router could run.
 */
describe("diagnostics Super Admin mount", () => {
  it("mounts diagnostics under /auth/admin/diagnostics, not bare /auth/admin", async () => {
    const src = await readFile(new URL("../routes/diagnostics.ts", import.meta.url), "utf8");
    expect(src).toContain('router.use("/auth/admin/diagnostics", adminDiagnostics)');
    expect(src).not.toMatch(/router\.use\("\/auth\/admin",\s*adminDiagnostics\)/);
  });

  it("keeps consent-declare-bulk reachable for organizers in comm router", async () => {
    const src = await readFile(new URL("../routes/comm.ts", import.meta.url), "utf8");
    expect(src).toContain('router.post("/auth/admin/communicate/consent-declare-bulk"');
    expect(src).toMatch(/organizerAccountId/);
  });
});
