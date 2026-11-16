import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("BIDWAR — Organizer Portal Locked State UX & Color Contrast", () => {
  const portalSrc = readFileSync(
    path.resolve(__dirname, "../organizer-portal.tsx"),
    "utf8"
  );

  describe("1. High-Contrast Light Theme Locked Banner", () => {
    it("renders a prominent rose-50 / rose-300 light container instead of washed-out dark-mode red text", () => {
      expect(portalSrc).toContain("Account Temporarily Locked");
      expect(portalSrc).toContain("border-rose-300 bg-rose-50/95");
      expect(portalSrc).toContain("text-rose-950");
      expect(portalSrc).not.toContain("text-red-100");
      expect(portalSrc).not.toContain("text-red-200/80");
    });

    it("includes a direct Contact Support button in the banner", () => {
      expect(portalSrc).toContain("Contact Support");
      expect(portalSrc).toContain("mailto:support@bidwar.in");
    });
  });

  describe("2. Top-Right Profile Menu Status Indicator", () => {
    it("displays a red dot and 'Account Locked' text when organizer is suspended", () => {
      expect(portalSrc).toContain("isLocked ? \"bg-rose-500 animate-pulse\" : \"bg-emerald-400\"");
      expect(portalSrc).toContain("isLocked ? (");
      expect(portalSrc).toContain("Account Locked");
    });

    it("includes a locked warning notice inside the open profile dropdown", () => {
      expect(portalSrc).toContain("Account locked by admin");
    });
  });

  describe("3. Unified Disabled CTA Buttons (No Muddy Colors)", () => {
    it("renders locked action buttons with neutral slate styling and Lock icon", () => {
      expect(portalSrc).toContain("if (locked) {");
      expect(portalSrc).toContain("bg-slate-100 text-slate-500 border border-slate-200 cursor-not-allowed");
      expect(portalSrc).toContain("<Lock className=\"h-3.5 w-3.5 text-slate-400 shrink-0\"");
    });

    it("fixes inactive module CTA styling to use light theme border and background", () => {
      expect(portalSrc).not.toContain("border-slate-600/50 bg-slate-900/30 text-slate-300");
      expect(portalSrc).toContain("border-slate-200 bg-slate-50 text-slate-400");
    });
  });

  describe("4. Header Action & Tournament Card Badging", () => {
    it("renders '+ New Tournament (Locked)' with disabled styling when account is suspended", () => {
      expect(portalSrc).toContain("New Tournament (Locked)");
      expect(portalSrc).toContain("isLocked ? <Lock");
    });

    it("replaces live/ready status badges with clear 'Account Locked' badge on cards", () => {
      expect(portalSrc).toContain("Account Locked");
      expect(portalSrc).toContain("bg-rose-50 text-rose-700 border border-rose-200");
    });
  });
});
