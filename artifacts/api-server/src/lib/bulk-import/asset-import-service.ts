/**
 * BMW Asset Import — process 09_Assets sheet rows.
 */

import type { ParsedWorkbook } from "@workspace/api-base/tournament-workbook";
import { importPhotoFromUrl, isPhotoUrl, isStableCloudinaryPhotoUrl } from "./photo-import-service";
import { readFile } from "node:fs/promises";

export type AssetImportResult = {
  entityType: string;
  entityName: string;
  mediaType: string;
  originalUrl: string;
  storedUrl: string | null;
  status: "Uploaded" | "Failed" | "Skipped";
  warning?: string;
};

const MEDIA_TYPE_FOLDER: Record<string, string> = {
  Photo: "bidwar/workbook/photos",
  Logo: "bidwar/workbook/logos",
  Banner: "bidwar/workbook/banners",
  Video: "bidwar/workbook/videos",
  Document: "bidwar/workbook/documents",
};

export async function importAssetsFromWorkbook(
  workbook: ParsedWorkbook,
): Promise<AssetImportResult[]> {
  const assetRows = workbook.sheets["09_Assets"] ?? [];
  const results: AssetImportResult[] = [];

  for (const row of assetRows) {
    const entityType = String(row["Entity Type"] ?? "").trim();
    const entityName = String(row["Entity Name"] ?? "").trim();
    const mediaType = String(row["Media Type"] ?? "Photo").trim();
    const url = String(row["URL"] ?? "").trim();
    const source = String(row["Source"] ?? "").trim();

    if (!entityType || !entityName) {
      results.push({
        entityType,
        entityName,
        mediaType,
        originalUrl: url,
        storedUrl: null,
        status: "Skipped",
        warning: "Missing entity type or name",
      });
      continue;
    }

    if (!url) {
      results.push({
        entityType,
        entityName,
        mediaType,
        originalUrl: "",
        storedUrl: null,
        status: "Skipped",
        warning: "No URL provided",
      });
      continue;
    }

    const folder = String(row["Target Folder"] ?? MEDIA_TYPE_FOLDER[mediaType] ?? "bidwar/workbook/assets");

    try {
      if (url.startsWith("local://")) {
        const localPath = url.replace("local://", "");
        const buffer = await readFile(localPath);
        const { uploadBufferToCloudinary } = await import("../cloudinary-media-service.js");
        const uploaded = await uploadBufferToCloudinary(buffer, {
          folder,
          resourceType: mediaType === "Video" ? "video" : "image",
        });
        results.push({
          entityType,
          entityName,
          mediaType,
          originalUrl: url,
          storedUrl: uploaded.url,
          status: "Uploaded",
        });
      } else if (isStableCloudinaryPhotoUrl(url)) {
        results.push({
          entityType,
          entityName,
          mediaType,
          originalUrl: url,
          storedUrl: url,
          status: "Uploaded",
        });
      } else if (isPhotoUrl(url) || source === "Direct URL" || url.startsWith("http")) {
        const result = await importPhotoFromUrl(url, folder);
        results.push({
          entityType,
          entityName,
          mediaType,
          originalUrl: url,
          storedUrl: result.storedUrl,
          status: result.storedUrl ? "Uploaded" : "Failed",
          warning: result.warning,
        });
      } else {
        results.push({
          entityType,
          entityName,
          mediaType,
          originalUrl: url,
          storedUrl: null,
          status: "Skipped",
          warning: `Unsupported source: ${source || "unknown"}`,
        });
      }
    } catch (err) {
      results.push({
        entityType,
        entityName,
        mediaType,
        originalUrl: url,
        storedUrl: null,
        status: "Failed",
        warning: err instanceof Error ? err.message : "Asset import failed",
      });
    }
  }

  return results;
}

/** Apply imported asset URLs back to entity sheets */
export function applyAssetResultsToWorkbook(
  workbook: ParsedWorkbook,
  results: AssetImportResult[],
): void {
  for (const result of results) {
    if (!result.storedUrl) continue;

    if (result.entityType === "Player" && result.mediaType === "Photo") {
      const players = workbook.sheets["03_Players"] ?? [];
      for (const player of players) {
        if (String(player["Player Name"]).trim() === result.entityName) {
          player["Photo URL"] = result.storedUrl;
        }
      }
    } else if (result.entityType === "Team" && result.mediaType === "Logo") {
      const teams = workbook.sheets["04_Teams"] ?? [];
      for (const team of teams) {
        if (String(team["Team Name"]).trim() === result.entityName) {
          team["Logo URL"] = result.storedUrl;
        }
      }
    } else if (result.entityType === "Tournament") {
      const tournament = workbook.sheets["01_Tournament"]?.[0];
      if (tournament) {
        if (result.mediaType === "Logo") tournament["Logo"] = result.storedUrl;
        if (result.mediaType === "Banner") tournament["Banner"] = result.storedUrl;
      }
    } else if (result.entityType === "Sponsor" && result.mediaType === "Logo") {
      const sponsors = workbook.sheets["05_Sponsors"] ?? [];
      for (const sponsor of sponsors) {
        if (String(sponsor["Sponsor Name"]).trim() === result.entityName) {
          sponsor["Logo URL"] = result.storedUrl;
        }
      }
    }
  }
}
