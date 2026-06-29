/**
 * BMW Google Drive Folder Media Import — match folder files to entities.
 */

import { normalizeMobile, getRegistrationCodeFromRow } from "@workspace/api-base/tournament-workbook";
import { importPhotoFromUrl, isPhotoUrl, resolvePhotoDownloadUrl } from "./photo-import-service.ts";
import { readFile } from "node:fs/promises";

export type FolderMediaFile = {
  name: string;
  url?: string;
  localPath?: string;
};

export type FolderMediaMatch = {
  entityType: "Player" | "Team" | "Tournament" | "Sponsor";
  entityName: string;
  identity?: string;
  file: FolderMediaFile;
  matchedBy: "name" | "registration_code" | "mobile" | "filename";
};

export type FolderMediaResult = {
  matches: FolderMediaMatch[];
  unmatched: FolderMediaFile[];
  warnings: string[];
};

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\.(jpg|jpeg|png|gif|webp)$/i, "");
}

export function matchFolderFilesToPlayers(
  files: FolderMediaFile[],
  players: Record<string, unknown>[],
): FolderMediaResult {
  const matches: FolderMediaMatch[] = [];
  const unmatched: FolderMediaFile[] = [...files];
  const warnings: string[] = [];

  const fileIndex = new Map<string, FolderMediaFile>();
  for (const file of files) {
    const baseName = normalizeName(file.name);
    fileIndex.set(baseName, file);
  }

  for (const player of players) {
    const name = String(player["Player Name"] ?? "").trim();
    if (!name) continue;

    const regCode = getRegistrationCodeFromRow(player);
    const mobile = normalizeMobile(player["Mobile"]);
    const nameKey = normalizeName(name);

    let matched: FolderMediaFile | undefined;
    let matchedBy: FolderMediaMatch["matchedBy"] = "name";

    if (fileIndex.has(nameKey)) {
      matched = fileIndex.get(nameKey);
      matchedBy = "name";
    } else if (regCode && fileIndex.has(normalizeName(regCode))) {
      matched = fileIndex.get(normalizeName(regCode));
      matchedBy = "registration_code";
    } else if (mobile.length >= 10 && fileIndex.has(mobile)) {
      matched = fileIndex.get(mobile);
      matchedBy = "mobile";
    }

    if (matched) {
      matches.push({
        entityType: "Player",
        entityName: name,
        identity: regCode || mobile || name,
        file: matched,
        matchedBy,
      });
      const idx = unmatched.findIndex((f) => f.name === matched!.name);
      if (idx >= 0) unmatched.splice(idx, 1);
    } else {
      warnings.push(`No photo found in folder for player "${name}"`);
    }
  }

  for (const file of unmatched) {
    warnings.push(`Unmatched file in folder: ${file.name}`);
  }

  return { matches, unmatched, warnings };
}

export async function importFolderMediaMatches(
  matches: FolderMediaMatch[],
  folder = "bidwar/workbook/folder-import",
): Promise<Array<{ match: FolderMediaMatch; storedUrl: string | null; warning?: string }>> {
  const results: Array<{ match: FolderMediaMatch; storedUrl: string | null; warning?: string }> = [];

  for (const match of matches) {
    try {
      if (match.file.localPath) {
        const buffer = await readFile(match.file.localPath);
        const { uploadBufferToCloudinary } = await import("../cloudinary-media-service.ts");
        const uploaded = await uploadBufferToCloudinary(buffer, { folder, resourceType: "image" });
        results.push({ match, storedUrl: uploaded.url });
      } else if (match.file.url && isPhotoUrl(match.file.url)) {
        const result = await importPhotoFromUrl(match.file.url, folder);
        results.push({
          match,
          storedUrl: result.storedUrl,
          warning: result.warning,
        });
      } else {
        results.push({ match, storedUrl: null, warning: "No valid media source" });
      }
    } catch (err) {
      results.push({
        match,
        storedUrl: null,
        warning: err instanceof Error ? err.message : "Import failed",
      });
    }
  }

  return results;
}

/** Extract Google Drive folder ID from URL */
export function extractDriveFolderId(url: string): string | null {
  const match = url.trim().match(/drive\.google\.com\/drive(?:\/u\/\d+)?\/folders\/([a-zA-Z0-9-_]+)/);
  return match?.[1] ?? null;
}

export function buildDriveFolderFileUrl(fileId: string): string {
  return resolvePhotoDownloadUrl(`https://drive.google.com/file/d/${fileId}/view`);
}
