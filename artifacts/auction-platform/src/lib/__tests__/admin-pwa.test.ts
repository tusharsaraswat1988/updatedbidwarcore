import { describe, expect, it } from "vitest";
import { isAdminPwaRoute, ADMIN_MANIFEST_HREF } from "../branding-pwa";
import { isAndroidChromeBrowser, isStandalonePwaDisplay } from "../admin-pwa";

describe("admin PWA routing", () => {
  it("uses dedicated admin manifest href", () => {
    expect(ADMIN_MANIFEST_HREF).toBe("/admin.webmanifest");
  });

  it("detects admin routes for manifest switching", () => {
    expect(isAdminPwaRoute("/admin")).toBe(true);
    expect(isAdminPwaRoute("/admin/login")).toBe(true);
    expect(isAdminPwaRoute("/admin/tournaments/1")).toBe(true);
    expect(isAdminPwaRoute("/")).toBe(false);
    expect(isAdminPwaRoute("/tournament/1")).toBe(false);
  });
});

describe("admin PWA install hint helpers", () => {
  it("returns false for standalone detection in SSR", () => {
    expect(isStandalonePwaDisplay()).toBe(false);
  });

  it("returns false for Android Chrome detection in SSR", () => {
    expect(isAndroidChromeBrowser()).toBe(false);
  });
});
