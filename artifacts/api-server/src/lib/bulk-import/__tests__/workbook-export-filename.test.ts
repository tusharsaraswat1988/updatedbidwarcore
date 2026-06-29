import { describe, expect, it } from "vitest";
import { buildWorkbookExportFilename } from "../workbook-export-filename.js";

describe("buildWorkbookExportFilename", () => {
  it("includes tournament name and auction code", () => {
    expect(buildWorkbookExportFilename("Mumbai Premier League 2026", "RC732504")).toBe(
      "BidWar-BMW-Mumbai-Premier-League-2026-RC732504.xlsx",
    );
  });

  it("falls back when auction code is missing", () => {
    expect(buildWorkbookExportFilename("Summer Cup", null)).toBe("BidWar-BMW-Summer-Cup.xlsx");
  });
});
