import { describe, expect, it } from "vitest";

import {
  applyPhotoImportResultsToRows,
  extractDriveFileId,
  isStableCloudinaryPhotoUrl,
  photoSourceKey,
  resolvePhotoImportConcurrency,
  PHOTO_IMPORT_CONCURRENCY,
  validateImageQuality,
  PHOTO_QUALITY_WARNING_LABELS,
} from "../photo-import-service.js";
import { googleDriveAdapter } from "../photo-source-adapter.js";

describe("photo-import-service", () => {
  it("detects stable Cloudinary delivery URLs", () => {
    expect(
      isStableCloudinaryPhotoUrl(
        "https://res.cloudinary.com/demo/image/upload/v123/bidwar/player.webp",
      ),
    ).toBe(true);
    expect(isStableCloudinaryPhotoUrl("https://drive.google.com/file/d/abc/view")).toBe(false);
  });

  it("extracts Google Drive file IDs for dedup", () => {
    expect(extractDriveFileId("https://drive.google.com/file/d/abc123/view")).toBe("abc123");
    expect(extractDriveFileId("https://drive.google.com/open?id=xyz789")).toBe("xyz789");
    expect(photoSourceKey("https://drive.google.com/file/d/abc123/view")).toBe("drive:abc123");
  });

  it("uses google drive adapter source keys", () => {
    expect(googleDriveAdapter.sourceKey("https://drive.google.com/file/d/abc123/view")).toBe("drive:abc123");
  });

  it("flags low resolution and very large images", () => {
    const low = validateImageQuality({
      width: 100,
      height: 120,
      format: "jpeg",
      bytes: 5000,
      checksum: "abc",
    });
    expect(low).toContain("low_resolution");

    const large = validateImageQuality({
      width: 9000,
      height: 9000,
      format: "jpeg",
      bytes: 500000,
      checksum: "def",
    });
    expect(large).toContain("very_large_image");
  });

  it("maps quality warning codes to labels", () => {
    expect(PHOTO_QUALITY_WARNING_LABELS.low_resolution).toBe("Low Resolution");
    expect(PHOTO_QUALITY_WARNING_LABELS.corrupted_image).toBe("Corrupted Image");
  });

  it("defaults photo import concurrency to 1", () => {
    expect(resolvePhotoImportConcurrency(undefined)).toBe(1);
    expect(resolvePhotoImportConcurrency("")).toBe(1);
    expect(PHOTO_IMPORT_CONCURRENCY).toBeGreaterThanOrEqual(1);
  });

  it("reads photo import concurrency from PHOTO_IMPORT_CONCURRENCY", () => {
    expect(resolvePhotoImportConcurrency("3")).toBe(3);
    expect(resolvePhotoImportConcurrency("0")).toBe(1);
    expect(resolvePhotoImportConcurrency("invalid")).toBe(1);
  });

  it("applies imported photo URLs back to workbook rows", () => {
    const rows = [{ "Photo URL": "https://drive.google.com/old" }];
    const results = new Map([
      [
        "Photo URL:https://drive.google.com/old",
        {
          originalUrl: "https://drive.google.com/old",
          storedUrl: "https://res.cloudinary.com/demo/image/upload/bidwar/new.webp",
          publicId: "bidwar/new",
        },
      ],
    ]);

    applyPhotoImportResultsToRows(rows, results, ["Photo URL"]);
    expect(rows[0]!["Photo URL"]).toBe(
      "https://res.cloudinary.com/demo/image/upload/bidwar/new.webp",
    );
  });
});
