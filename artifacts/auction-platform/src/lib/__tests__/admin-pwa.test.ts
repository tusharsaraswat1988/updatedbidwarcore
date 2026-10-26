import { describe, expect, it } from "vitest";
import {
  isAdminPwaRoute,
  ADMIN_MANIFEST_HREF,
  isScorerPwaRoute,
  SCORER_MANIFEST_HREF,
} from "../branding-pwa";
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

describe("scorer PWA routing", () => {
  it("uses dedicated scorer manifest href", () => {
    expect(SCORER_MANIFEST_HREF).toBe("/scoring-app/manifest.webmanifest");
  });

  it("detects cricket and badminton scorer routes for manifest switching", () => {
    expect(isScorerPwaRoute("/scoring-app")).toBe(true);
    expect(isScorerPwaRoute("/scoring-app/cricket/scorer")).toBe(true);
    expect(isScorerPwaRoute("/cricket/scorer")).toBe(true);
    expect(isScorerPwaRoute("/cricket/scorer?tid=1")).toBe(true);
    expect(isScorerPwaRoute("/cricket/12/score")).toBe(true);
    expect(isScorerPwaRoute("/badminton/scorer")).toBe(true);
    expect(isScorerPwaRoute("/badminton/5/score")).toBe(true);
    expect(isScorerPwaRoute("/")).toBe(false);
    expect(isScorerPwaRoute("/login")).toBe(false);
    expect(isScorerPwaRoute("/admin")).toBe(false);
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
