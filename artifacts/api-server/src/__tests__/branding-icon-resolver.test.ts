import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  BRANDING_ICON_PATHS,
  BRANDING_LOGO_PATHS,
  type BrandingAssetRecord,
} from "@workspace/api-base/branding-assets";
import { buildBrandingIconHeadLinks } from "@workspace/api-base/branding-icon-head";

const getAssetMock = vi.fn<(type: string) => Promise<BrandingAssetRecord | null>>();
const getMaxBrandingAssetVersionMock = vi.fn<() => Promise<number>>();

vi.mock("../lib/branding-service.js", () => ({
  getAsset: (type: string) => getAssetMock(type),
  getMaxBrandingAssetVersion: () => getMaxBrandingAssetVersionMock(),
}));

vi.mock("../lib/pdf-branding.js", () => ({
  fetchImageBuffer: vi.fn(async () => Buffer.from("fake-image")),
}));

vi.mock("../lib/html-meta-injector.js", () => ({
  patchBrandingIconsInCachedHtml: vi.fn(),
}));

vi.mock("../lib/logger.js", () => ({
  logger: { info: vi.fn(), error: vi.fn() },
}));

import {
  resolveBrandingIconForPath,
  refreshBrandingIconCache,
  getCachedFaviconVersion,
  getBrandingIconCacheVersion,
  getSerializedIconVersionResponse,
  isBrandingIconCacheInitialized,
  __resetBrandingIconCacheForTests,
} from "../lib/branding-asset-resolver.js";

function mockMaxVersionQuery(maxVersion: number): void {
  getMaxBrandingAssetVersionMock.mockResolvedValue(maxVersion);
}

function asset(type: string, url: string, version = 1): BrandingAssetRecord {
  return {
    id: 1,
    assetType: type as BrandingAssetRecord["assetType"],
    fileUrl: url,
    filePublicId: null,
    fileName: "icon.png",
    mimeType: "image/png",
    width: 32,
    height: 32,
    fileSize: 100,
    version,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe("branding-asset-resolver", () => {
  beforeEach(() => {
    getAssetMock.mockReset();
    getMaxBrandingAssetVersionMock.mockReset();
    __resetBrandingIconCacheForTests();
  });

  it("maps /favicon.ico to FAVICON asset", async () => {
    getAssetMock.mockImplementation(async (type: string) => {
      if (type === "FAVICON") return asset("FAVICON", "https://cdn.example/favicon.png");
      return null;
    });

    const resolved = await resolveBrandingIconForPath(BRANDING_ICON_PATHS.faviconIco);
    expect(resolved?.fileUrl).toBe("https://cdn.example/favicon.png");
    expect(resolved?.assetType).toBe("FAVICON");
  });

  it("falls back PWA_ICON when FAVICON missing for /favicon-32x32.png", async () => {
    getAssetMock.mockImplementation(async (type: string) => {
      if (type === "FAVICON") return null;
      if (type === "PWA_ICON") return asset("PWA_ICON", "https://cdn.example/pwa.png", 3);
      return null;
    });

    const resolved = await resolveBrandingIconForPath(BRANDING_ICON_PATHS.favicon32x32);
    expect(resolved?.assetType).toBe("PWA_ICON");
    expect(resolved?.version).toBe(3);
  });

  it("maps /apple-touch-icon.png to APPLE_TOUCH_ICON chain", async () => {
    getAssetMock.mockImplementation(async (type: string) => {
      if (type === "APPLE_TOUCH_ICON") return asset("APPLE_TOUCH_ICON", "https://cdn.example/apple.png");
      return null;
    });

    const resolved = await resolveBrandingIconForPath(BRANDING_ICON_PATHS.appleTouchIcon);
    expect(resolved?.assetType).toBe("APPLE_TOUCH_ICON");
  });

  it("maps /bidwar-primary-logo.png to PRIMARY_LOGO chain", async () => {
    getAssetMock.mockImplementation(async (type: string) => {
      if (type === "PRIMARY_LOGO") return asset("PRIMARY_LOGO", "https://cdn.example/primary.png", 4);
      return null;
    });

    const resolved = await resolveBrandingIconForPath(BRANDING_LOGO_PATHS.primary);
    expect(resolved?.assetType).toBe("PRIMARY_LOGO");
    expect(resolved?.fileUrl).toBe("https://cdn.example/primary.png");
  });

  it("maps /bidwar-reverse-logo.png to REVERSE_LOGO chain", async () => {
    getAssetMock.mockImplementation(async (type: string) => {
      if (type === "REVERSE_LOGO") return asset("REVERSE_LOGO", "https://cdn.example/reverse.png", 6);
      return null;
    });

    const resolved = await resolveBrandingIconForPath(BRANDING_LOGO_PATHS.reverse);
    expect(resolved?.assetType).toBe("REVERSE_LOGO");
  });

  it("builds versioned canonical head links", () => {
    const html = buildBrandingIconHeadLinks(5);
    expect(html).toContain('href="/favicon.ico?v=5"');
    expect(html).toContain('href="/favicon-32x32.png?v=5"');
    expect(html).toContain('href="/apple-touch-icon.png?v=5"');
  });

  it("returns max version from a single DB query on refresh", async () => {
    mockMaxVersionQuery(9);
    await refreshBrandingIconCache();
    expect(getCachedFaviconVersion()).toBe(9);
    expect(isBrandingIconCacheInitialized()).toBe(true);
    expect(getMaxBrandingAssetVersionMock).toHaveBeenCalledTimes(1);
  });

  it("serves cached version without DB after refresh", async () => {
    mockMaxVersionQuery(7);
    await refreshBrandingIconCache();
    getMaxBrandingAssetVersionMock.mockClear();

    expect(await getBrandingIconCacheVersion()).toBe(7);
    expect(getMaxBrandingAssetVersionMock).not.toHaveBeenCalled();
  });

  it("reuses pre-serialized JSON for repeated polls", async () => {
    mockMaxVersionQuery(5);
    await refreshBrandingIconCache();
    const first = getSerializedIconVersionResponse(5);
    const second = getSerializedIconVersionResponse(5);
    expect(first).toBe(second);
    expect(first).toBe('{"version":5}');
  });
});
