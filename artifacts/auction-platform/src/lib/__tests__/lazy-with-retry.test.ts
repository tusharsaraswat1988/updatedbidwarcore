import { describe, it, expect, vi } from "vitest";
import { isChunkLoadError, reloadForFreshVersion } from "../lazy-with-retry";

describe("lazy-with-retry module", () => {
  describe("isChunkLoadError", () => {
    it("detects Chrome/Vite chunk load failures", () => {
      const err = new Error(
        "Failed to fetch dynamically imported module: https://bidwar.in/assets/admin-reports-D12345.js"
      );
      expect(isChunkLoadError(err)).toBe(true);
    });

    it("detects Firefox module script failures", () => {
      const err = new Error("Importing a module script failed.");
      expect(isChunkLoadError(err)).toBe(true);
    });

    it("detects Safari dynamic module failures", () => {
      const err = new Error("error loading dynamically imported module");
      expect(isChunkLoadError(err)).toBe(true);
    });

    it("detects Webpack/Rollup chunk load failures", () => {
      const err = new Error("Loading chunk 52 failed.");
      expect(isChunkLoadError(err)).toBe(true);
    });

    it("returns false for regular application errors", () => {
      expect(isChunkLoadError(new Error("Cannot read properties of undefined"))).toBe(false);
      expect(isChunkLoadError(new Error("Invalid password"))).toBe(false);
      expect(isChunkLoadError(null)).toBe(false);
      expect(isChunkLoadError(undefined)).toBe(false);
    });
  });

  describe("reloadForFreshVersion", () => {
    it("throttles reloads to avoid infinite loops", () => {
      // Mock sessionStorage
      const store: Record<string, string> = {};
      const sessionStorageMock = {
        getItem: vi.fn((key: string) => store[key] || null),
        setItem: vi.fn((key: string, val: string) => {
          store[key] = val;
        }),
      };
      const reloadMock = vi.fn();

      vi.stubGlobal("sessionStorage", sessionStorageMock);
      vi.stubGlobal("window", {
        location: { reload: reloadMock },
        sessionStorage: sessionStorageMock,
      });

      // First call should trigger reload
      const first = reloadForFreshVersion();
      expect(first).toBe(true);
      expect(reloadMock).toHaveBeenCalledTimes(1);

      // Immediate second call should be throttled (returns false)
      const second = reloadForFreshVersion();
      expect(second).toBe(false);
      expect(reloadMock).toHaveBeenCalledTimes(1);

      vi.unstubAllGlobals();
    });
  });
});
