import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const cssPath = join(dirname(fileURLToPath(import.meta.url)), "lovable-homepage.css");
const css = readFileSync(cssPath, "utf8");

describe("lovable-theme portal chrome", () => {
  it("does not put min-height: 100vh on the shared token block", () => {
    // The shared :is(.lovable-home, .lovable-theme) block must end before page chrome.
    const tokenBlock = css.match(
      /:is\(\.lovable-home,\s*\.lovable-theme\)[\s\S]*?\n\}/,
    )?.[0];
    expect(tokenBlock).toBeTruthy();
    expect(tokenBlock).not.toMatch(/min-height:\s*100vh/);
    expect(tokenBlock).not.toMatch(/background:\s*var\(--gradient-stage\)/);
  });

  it("resets min-height for portaled lovable-theme overlays", () => {
    expect(css).toMatch(/\.lovable-theme\[data-state\]/);
    expect(css).toMatch(
      /\.lovable-theme\[data-state\][\s\S]*?min-height:\s*0/,
    );
  });

  it("keeps page chrome on full-page surfaces", () => {
    expect(css).toMatch(
      /\.lovable-home,[\s\S]*?min-height:\s*100vh/,
    );
  });
});
