import { describe, it, expect, vi, beforeEach } from "vitest";

const selectMock = vi.fn();
const mockCacheVersion = vi.fn(async () => 42);

vi.mock("@workspace/db", () => ({
  db: {
    select: () => selectMock(),
  },
}));

vi.mock("../lib/branding-asset-resolver.js", () => ({
  getBrandingIconCacheVersion: () => mockCacheVersion(),
}));

import {
  buildAdminAppManifest,
  buildAuctionPlatformManifest,
  buildOwnerAppManifest,
  buildScoringAppManifest,
} from "../lib/branding-manifest.js";

function chainSelectLimit(rows: unknown[]) {
  return {
    from: () => ({
      limit: () => Promise.resolve(rows),
    }),
  };
}

describe("buildAdminAppManifest", () => {
  beforeEach(() => {
    selectMock.mockReset();
    mockCacheVersion.mockReset().mockResolvedValue(42);
  });

  it("returns admin-scoped PWA fields for install from /admin/login", async () => {
    selectMock.mockReturnValue(
      chainSelectLimit([{ brandName: "BidWar", backgroundColor: "#09090b" }]),
    );

    const manifest = await buildAdminAppManifest();

    expect(manifest.name).toBe("BidWar Admin");
    expect(manifest.short_name).toBe("BidWar Admin");
    expect(manifest.start_url).toBe("/admin/login");
    expect(manifest.scope).toBe("/admin");
    expect(manifest.id).toBe("/admin/");
    expect(manifest.display).toBe("standalone");
    expect(manifest.orientation).toBe("any");
    expect(Array.isArray(manifest.icons)).toBe(true);
    const icons = manifest.icons as { src: string; sizes: string }[];
    expect(icons[0]?.src).toBe("/pwa-icon-192.png?v=42");
    expect(icons[1]?.src).toBe("/pwa-icon-512.png?v=42");
  });

  it("falls back to default brand name when settings row is missing", async () => {
    selectMock.mockReturnValue(chainSelectLimit([]));

    const manifest = await buildAdminAppManifest();

    expect(manifest.name).toBe("BidWar Admin");
    expect(manifest.theme_color).toBe("#09090b");
  });
});

describe("buildOwnerAppManifest", () => {
  beforeEach(() => {
    selectMock.mockReset();
    mockCacheVersion.mockReset().mockResolvedValue(42);
  });

  it("uses same-origin PWA icons with correct declared sizes", async () => {
    selectMock.mockReturnValue(
      chainSelectLimit([{ brandName: "BidWar", backgroundColor: "#09090b" }]),
    );

    const manifest = await buildOwnerAppManifest();
    const icons = manifest.icons as { src: string; sizes: string }[];

    expect(icons[0]?.src).toBe("/pwa-icon-192.png?v=42");
    expect(icons[0]?.sizes).toBe("192x192");
    expect(icons[1]?.src).toBe("/pwa-icon-512.png?v=42");
    expect(icons[1]?.sizes).toBe("512x512");
  });
});

describe("buildScoringAppManifest", () => {
  beforeEach(() => {
    selectMock.mockReset();
    mockCacheVersion.mockReset().mockResolvedValue(42);
  });

  it("returns dedicated scorer console PWA manifest pointing to cricket scorer portal", async () => {
    selectMock.mockReturnValue(
      chainSelectLimit([{ brandName: "BidWar", backgroundColor: "#09090b" }]),
    );

    const manifest = await buildScoringAppManifest();

    expect(manifest.name).toBe("BidWar Scoring Console");
    expect(manifest.short_name).toBe("BidWar Scorer");
    expect(manifest.start_url).toBe("/scoring-app/cricket/scorer");
    expect(manifest.scope).toBe("/scoring-app/");
    expect(manifest.id).toBe("/scoring-app/");
    expect(manifest.display).toBe("standalone");
    expect(manifest.theme_color).toBe("#1b2044");
    expect(Array.isArray(manifest.icons)).toBe(true);
    const icons = manifest.icons as { src: string; sizes: string }[];
    expect(icons[0]?.src).toBe("/pwa-icon-192.png?v=42");
    expect(icons[1]?.src).toBe("/pwa-icon-512.png?v=42");
  });
});

describe("buildAuctionPlatformManifest", () => {
  beforeEach(() => {
    selectMock.mockReset();
    mockCacheVersion.mockReset().mockResolvedValue(42);
  });

  it("uses same-origin relative PWA icon URLs with cache-busting and never hardcodes production host", async () => {
    selectMock.mockReturnValue(
      chainSelectLimit([{ brandName: "BidWar", backgroundColor: "#09090b" }]),
    );

    const manifest = await buildAuctionPlatformManifest();
    const icons = manifest.icons as { src: string; sizes: string }[];

    expect(icons[0]?.src).toBe("/pwa-icon-192.png?v=42");
    expect(icons[0]?.sizes).toBe("192x192");
    expect(icons[1]?.src).toBe("/pwa-icon-512.png?v=42");
    expect(icons[1]?.sizes).toBe("512x512");

    // Regression assertions: must be relative and never contain hardcoded domain
    for (const icon of icons) {
      expect(icon.src.startsWith("/")).toBe(true);
      expect(icon.src).not.toMatch(/^https?:\/\//);
      expect(icon.src).not.toContain("bidwar.in");
    }
  });

  it("omits cache query when version is 0", async () => {
    mockCacheVersion.mockResolvedValue(0);

    selectMock.mockReturnValue(
      chainSelectLimit([{ brandName: "BidWar", backgroundColor: "#09090b" }]),
    );

    const manifest = await buildAuctionPlatformManifest();
    const icons = manifest.icons as { src: string; sizes: string }[];

    expect(icons[0]?.src).toBe("/pwa-icon-192.png");
    expect(icons[1]?.src).toBe("/pwa-icon-512.png");
    for (const icon of icons) {
      expect(icon.src.startsWith("/")).toBe(true);
      expect(icon.src).not.toContain("?");
      expect(icon.src).not.toContain("bidwar.in");
    }
  });
});
