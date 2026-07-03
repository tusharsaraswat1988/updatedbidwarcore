import { describe, expect, it, beforeEach } from "vitest";
import path from "path";
import { fileURLToPath } from "url";
import {
  getSpaIndexShellPath,
  getSpaIndexHtml,
  initSpaIndexShell,
  resetSpaIndexShellForTests,
} from "../html-meta-injector.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const auctionDist = path.resolve(__dirname, "../../../../auction-platform/dist/public");
const auctionSource = path.resolve(__dirname, "../../../../auction-platform/index.html");
const builtIndex = path.join(auctionDist, "index.html");

describe("initSpaIndexShell", () => {
  beforeEach(() => {
    resetSpaIndexShellForTests();
  });

  it("loads built index in production static mode", () => {
    initSpaIndexShell({
      distDir: auctionDist,
      sourceIndexPath: auctionSource,
      serveStatic: true,
    });

    expect(getSpaIndexShellPath()).toBe(builtIndex);
    expect(getSpaIndexHtml()).toContain('/assets/');
    expect(getSpaIndexHtml()).not.toContain("/src/main.tsx");
  });

  it("loads source index in development mode", () => {
    initSpaIndexShell({
      distDir: auctionDist,
      sourceIndexPath: auctionSource,
      serveStatic: false,
    });

    expect(getSpaIndexShellPath()).toBe(auctionSource);
    expect(getSpaIndexHtml()).toContain("/src/main.tsx");
    expect(getSpaIndexHtml()).not.toMatch(/\/assets\/index-/);
  });

  it("fails fast when built index is missing in production static mode", () => {
    expect(() =>
      initSpaIndexShell({
        distDir: path.join(auctionDist, "missing-dist"),
        sourceIndexPath: auctionSource,
        serveStatic: true,
      }),
    ).toThrow(/SPA index shell not found/);
  });

  it("fails fast when source index is missing in development mode", () => {
    expect(() =>
      initSpaIndexShell({
        distDir: auctionDist,
        sourceIndexPath: path.join(auctionSource, "missing-index.html"),
        serveStatic: false,
      }),
    ).toThrow(/SPA index shell not found/);
  });

  it("never loads source index when serveStatic is true even if built index exists", () => {
    initSpaIndexShell({
      distDir: auctionDist,
      sourceIndexPath: auctionSource,
      serveStatic: true,
    });

    expect(getSpaIndexShellPath()).not.toBe(auctionSource);
    expect(getSpaIndexHtml()).not.toContain("/src/main.tsx");
  });
});
