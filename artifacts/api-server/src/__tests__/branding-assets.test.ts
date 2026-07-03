import { describe, it, expect } from "vitest";
import {
  validateBrandingAssetUpload,
  isBrandingAssetType,
  BRANDING_ASSET_TYPES,
  isFaviconPipelineComplete,
} from "@workspace/api-base/branding-assets";
import {
  needsFaviconPipelineRun,
  initialFaviconPipelineMetadata,
} from "../lib/favicon-pipeline.js";

describe("branding-assets", () => {
  it("recognizes all asset types", () => {
    for (const type of BRANDING_ASSET_TYPES) {
      expect(isBrandingAssetType(type)).toBe(true);
    }
    expect(isBrandingAssetType("INVALID")).toBe(false);
  });

  it("warns on oversized favicon without blocking when pipeline incomplete", () => {
    const warnings = validateBrandingAssetUpload("FAVICON", {
      width: 1024,
      height: 1024,
      mimeType: "image/png",
    });
    expect(warnings.some(w => w.code === "favicon_oversized")).toBe(true);
  });

  it("clears oversized favicon warning when pipeline completed", () => {
    const warnings = validateBrandingAssetUpload(
      "FAVICON",
      { width: 512, height: 512, mimeType: "image/png" },
      {
        status: "completed",
        sourceVersion: 2,
        generated: {
          "16": { url: "https://example.com/16.png", publicId: "a", width: 16, height: 16 },
          "32": { url: "https://example.com/32.png", publicId: "b", width: 32, height: 32 },
          "48": { url: "https://example.com/48.png", publicId: "c", width: 48, height: 48 },
          ico: { url: "https://example.com/favicon.ico", publicId: "d", width: 32, height: 32 },
        },
      },
    );
    expect(warnings).toHaveLength(0);
  });

  it("warns when favicon pipeline failed", () => {
    const warnings = validateBrandingAssetUpload(
      "FAVICON",
      { width: 32, height: 32, mimeType: "image/png" },
      { status: "failed", sourceVersion: 1, error: "Cloudinary upload failed" },
    );
    expect(warnings.some(w => w.code === "favicon_pipeline_failed")).toBe(true);
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

describe("favicon-pipeline helpers", () => {
  it("detects when pipeline needs to run", () => {
    expect(needsFaviconPipelineRun(1, null)).toBe(true);
    expect(needsFaviconPipelineRun(2, initialFaviconPipelineMetadata(1))).toBe(true);
    expect(
      needsFaviconPipelineRun(2, {
        status: "completed",
        sourceVersion: 2,
        generated: {
          "16": { url: "u", publicId: "p", width: 16, height: 16 },
          "32": { url: "u", publicId: "p", width: 32, height: 32 },
          "48": { url: "u", publicId: "p", width: 48, height: 48 },
          ico: { url: "u", publicId: "p", width: 32, height: 32 },
        },
      }),
    ).toBe(false);
  });

  it("validates completed pipeline structure", () => {
    expect(isFaviconPipelineComplete(null)).toBe(false);
    expect(isFaviconPipelineComplete({ status: "completed", sourceVersion: 1 })).toBe(false);
    expect(
      isFaviconPipelineComplete(
        {
          status: "completed",
          sourceVersion: 3,
          generated: {
            "16": { url: "u", publicId: "p", width: 16, height: 16 },
            "32": { url: "u", publicId: "p", width: 32, height: 32 },
            "48": { url: "u", publicId: "p", width: 48, height: 48 },
            ico: { url: "u", publicId: "p", width: 32, height: 32 },
          },
        },
        3,
      ),
    ).toBe(true);
  });
});
