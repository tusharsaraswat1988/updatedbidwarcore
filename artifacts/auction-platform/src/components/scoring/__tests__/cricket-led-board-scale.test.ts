import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const shellSrc = readFileSync(
  path.resolve(__dirname, "../score-display-shell.tsx"),
  "utf8",
);
const boardCss = readFileSync(
  path.resolve(__dirname, "../../../styles/cricket-led-board.css"),
  "utf8",
);
const scoringMain = readFileSync(
  path.resolve(__dirname, "../../../../../scoring-app/src/main.tsx"),
  "utf8",
);

describe("ground LED scoreboard fills the venue screen", () => {
  it("loads the viewport scale stylesheet from the scoring app", () => {
    expect(scoringMain).toContain('import "@/styles/cricket-led-board.css"');
  });

  it("renders the live board full-bleed instead of a centered max-width column", () => {
    expect(shellSrc).toContain("cricket-led-board");
    expect(shellSrc).toContain("led-arena");
    expect(shellSrc).not.toContain("max-w-7xl");
  });

  it("sizes the hero score from the viewport, not a phone breakpoint", () => {
    expect(shellSrc).toContain("led-score");
    expect(shellSrc).not.toContain("text-[clamp(6rem,22vh,15rem)]");
    expect(boardCss).toContain("--led-score: clamp(6rem, min(22dvh, 14dvw), 18rem)");
    expect(boardCss).toContain(".cricket-led-board .led-arena");
    expect(boardCss).toContain("max-width: none");
  });
});
