import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { computeTeamReportPlanningRows } from "@workspace/api-base";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("Team Planning Sheet - Fixed Row Heights and High Contrast Header", () => {
  const teamReportsSrc = readFileSync(path.resolve(__dirname, "../team-reports.tsx"), "utf8");

  describe("1. Fixed row heights and strict min/max player row calculation", () => {
    it("defines fixed row height constant without dynamic ResizeObserver runaway loops", () => {
      expect(teamReportsSrc).toContain("const PLANNING_ROW_HEIGHT_PX = 28;");
      expect(teamReportsSrc).not.toContain("ResizeObserver");
      expect(teamReportsSrc).not.toContain("PLANNING_ROW_MIN_PX");
    });

    it("ensures AuctionPlanningTable rows have strict fixed heights and no h-full stretching", () => {
      expect(teamReportsSrc).toContain("height: `${PLANNING_ROW_HEIGHT_PX}px`");
      expect(teamReportsSrc).toContain("maxHeight: `${PLANNING_ROW_HEIGHT_PX}px`");
      expect(teamReportsSrc).not.toContain("h-full w-full table-fixed border-collapse border border-gray-400 text-xs print-table");
    });

    it("strictly renders exactly the calculated squadInfo.planningRows slots", () => {
      expect(teamReportsSrc).toContain("const planningRows = squadInfo.planningRows;");
      expect(teamReportsSrc).toContain("displayRows={planningRows}");
      expect(teamReportsSrc).toMatch(/\{planningRows > 0 \? \(\s*<AuctionPlanningTable/);
    });

    it("verifies computeTeamReportPlanningRows calculates slots based on min and max squad targets", () => {
      // 0 acquired, target 13 -> 13 rows
      expect(computeTeamReportPlanningRows(0, 13, 13)).toEqual({ planningRows: 13, slotsRemaining: 13 });
      // 2 acquired, target 15 -> 13 rows
      expect(computeTeamReportPlanningRows(2, 10, 15)).toEqual({ planningRows: 13, slotsRemaining: 13 });
      // 15 acquired, target 15 -> 0 rows
      expect(computeTeamReportPlanningRows(15, 10, 15)).toEqual({ planningRows: 0, slotsRemaining: 0 });
    });
  });

  describe("2. High contrast header typography and legibility", () => {
    it("styles Purse Summary header with bright visible colors", () => {
      expect(teamReportsSrc).toContain("text-amber-300\">Purse Summary</p>");
      expect(teamReportsSrc).toContain("text-[10px] font-semibold text-slate-300\">{item.label}</p>");
      expect(teamReportsSrc).toContain("item.highlight ? \"text-yellow-300\" : \"text-white\"");
    });

    it("ensures owner details and sport are bright and readable on dark header", () => {
      expect(teamReportsSrc).toContain("font-mono text-[11px] font-semibold text-amber-300\">{team.ownerMobile}</p>");
      expect(teamReportsSrc).toContain("capitalize text-slate-200\">{tournament.sport}</p>");
      expect(teamReportsSrc).toContain("font-bold uppercase tracking-[0.15em] text-white\">");
    });

    it("ensures Access Code card and Non-Playing members have bright high-contrast typography", () => {
      expect(teamReportsSrc).toContain("text-amber-300\">{isCompleted ? \"Status\" : \"Access Code\"}</p>");
      expect(teamReportsSrc).toContain("text-white\">{isCompleted ? \"COMPLETED\" : \"_ _ _ _ _ _\"}</p>");
      expect(teamReportsSrc).toContain("text-amber-300\">Non-Playing Members</p>");
    });

    it("ensures table headers have explicit high-contrast background and bright text", () => {
      expect(teamReportsSrc).toContain("bg-slate-800 text-yellow-300 print-table-header");
      expect(teamReportsSrc).toContain("bg-slate-800 px-1.5 py-1 text-[10px] font-bold uppercase leading-tight tracking-wider text-yellow-300");
    });
  });
});
