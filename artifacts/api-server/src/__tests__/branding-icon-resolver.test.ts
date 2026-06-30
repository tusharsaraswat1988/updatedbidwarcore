import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  BRANDING_ICON_PATHS,
  type BrandingAssetRecord,
} from "@workspace/api-base/branding-assets";
import { buildBrandingIconHeadLinks } from "@workspace/api-base/branding-icon-head";

const getAssetMock = vi.fn<() => Promise<BrandingAssetRecord | null>>();

vi.mock("../lib/branding-service.js", () => ({
  getAsset: (...args: unknown[]) => getAssetMock(...args),
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
  getBrandingIconCacheVersion,
} from "../lib/branding-asset-resolver.js";

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

  it("builds versioned canonical head links", () => {
    const html = buildBrandingIconHeadLinks(5);
    expect(html).toContain('href="/favicon.ico?v=5"');
    expect(html).toContain('href="/favicon-32x32.png?v=5"');
    expect(html).toContain('href="/apple-touch-icon.png?v=5"');
  });

  it("returns max version across icon assets", async () => {
    getAssetMock.mockImplementation(async (type: string) => {
      if (type === "FAVICON") return asset("FAVICON", "https://cdn.example/f.png", 2);
      if (type === "PWA_ICON") return asset("PWA_ICON", "https://cdn.example/p.png", 7);
      if (type === "APPLE_TOUCH_ICON") return asset("APPLE_TOUCH_ICON", "https://cdn.example/a.png", 4);
      return null;
    });

    expect(await getBrandingIconCacheVersion()).toBe(7);
  });
});
