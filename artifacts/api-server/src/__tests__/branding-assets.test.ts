import { describe, it, expect } from "vitest";
import {
  validateBrandingAssetUpload,
  isBrandingAssetType,
  BRANDING_ASSET_TYPES,
} from "@workspace/api-base/branding-assets";

describe("branding-assets", () => {
  it("recognizes all asset types", () => {
    for (const type of BRANDING_ASSET_TYPES) {
      expect(isBrandingAssetType(type)).toBe(true);
    }
    expect(isBrandingAssetType("INVALID")).toBe(false);
  });

  it("warns on oversized favicon without blocking", () => {
    const warnings = validateBrandingAssetUpload("FAVICON", {
      width: 1024,
      height: 1024,
      mimeType: "image/png",
    });
    expect(warnings.some(w => w.code === "favicon_oversized")).toBe(true);
  });

  it("warns on square open graph image", () => {
    const warnings = validateBrandingAssetUpload("OPEN_GRAPH_IMAGE", {
      width: 1200,
      height: 1200,
      mimeType: "image/png",
    });
    expect(warnings.some(w => w.code === "og_square_format")).toBe(true);
  });

  it("warns on jpeg for transparent-preferred assets", () => {
    const warnings = validateBrandingAssetUpload("OBS_WATERMARK", {
      width: 400,
      height: 100,
      mimeType: "image/jpeg",
    });
    expect(warnings.some(w => w.code === "transparency_recommended")).toBe(true);
  });

  it("returns no warnings for well-sized favicon", () => {
    const warnings = validateBrandingAssetUpload("FAVICON", {
      width: 32,
      height: 32,
      mimeType: "image/png",
    });
    expect(warnings).toHaveLength(0);
  });
});
