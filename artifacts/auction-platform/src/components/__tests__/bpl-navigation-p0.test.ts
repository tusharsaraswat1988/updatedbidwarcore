import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  fetchActiveBplEdition,
  fetchPublicBplEditions,
  fetchBplEdition,
  listAdminBplEditions,
  createAdminBplEdition,
  updateAdminBplEdition,
  deleteAdminBplEdition,
} from "../../lib/bpl-api";

describe("BPL Homepage & Public Navigation (P0.8)", () => {
  const navbarPath = path.resolve(__dirname, "../public-navbar.tsx");
  const homePath = path.resolve(__dirname, "../../pages/lovable-home.tsx");

  it("removes obsolete BPL Team Registration CTA from PublicNavbar", () => {
    const navbarContent = fs.readFileSync(navbarPath, "utf-8");
    expect(navbarContent).not.toContain("BPL Team Registration");
    expect(navbarContent).not.toContain("https://bpl.bidwar.in/");
    expect(navbarContent).toContain('href="/bpl"');
    expect(navbarContent).toContain("BidWar Premier League");
  });

  it("removes obsolete BPL Team Registration CTA from Lovable Homepage", () => {
    const homeContent = fs.readFileSync(homePath, "utf-8");
    expect(homeContent).not.toContain("BPL Team Registration");
    expect(homeContent).not.toContain("https://bpl.bidwar.in/");
    expect(homeContent).toContain('href="/bpl"');
    expect(homeContent).toContain("BidWar Premier League");
  });

  it("exports BPL client API functions properly", () => {
    expect(typeof fetchActiveBplEdition).toBe("function");
    expect(typeof fetchPublicBplEditions).toBe("function");
    expect(typeof fetchBplEdition).toBe("function");
    expect(typeof listAdminBplEditions).toBe("function");
    expect(typeof createAdminBplEdition).toBe("function");
    expect(typeof updateAdminBplEdition).toBe("function");
    expect(typeof deleteAdminBplEdition).toBe("function");
  });
});
