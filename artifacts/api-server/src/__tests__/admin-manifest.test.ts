import { describe, it, expect, vi, beforeEach } from "vitest";

const selectMock = vi.fn();

vi.mock("@workspace/db", () => ({
  db: {
    select: () => selectMock(),
  },
}));

vi.mock("../lib/branding-asset-resolver.js", () => ({
  getBrandingIconCacheVersion: vi.fn(async () => 42),
}));

import { buildAdminAppManifest, buildAuctionPlatformManifest, buildOwnerAppManifest } from "../lib/branding-manifest.js";

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

describe("buildAuctionPlatformManifest", () => {
  beforeEach(() => {
    selectMock.mockReset();
  });

  it("uses absolute PWA icon URLs with correct declared sizes", async () => {
    selectMock.mockReturnValue(
      chainSelectLimit([{ brandName: "BidWar", backgroundColor: "#09090b" }]),
    );

    const manifest = await buildAuctionPlatformManifest();
    const icons = manifest.icons as { src: string; sizes: string }[];

    expect(icons[0]?.src).toBe("https://bidwar.in/pwa-icon-192.png?v=42");
    expect(icons[0]?.sizes).toBe("192x192");
    expect(icons[1]?.src).toBe("https://bidwar.in/pwa-icon-512.png?v=42");
    expect(icons[1]?.sizes).toBe("512x512");
  });
});
