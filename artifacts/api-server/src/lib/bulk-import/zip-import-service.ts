/**
 * BMW ZIP Package Import — Tournament.zip with workbook + local media folders.
 * Works offline without internet when media is bundled locally.
 */

import { join, extname, basename } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { parseWorkbookFromRaw, type ParsedWorkbook } from "@workspace/api-base/tournament-workbook";
import { parseExcelBufferToRawWorkbook } from "./google-sheet-workbook-reader";

const WORKBOOK_NAMES = ["workbook.xlsx", "bidwar-workbook.xlsx", "tournament.xlsx", "master-workbook.xlsx"];
const MEDIA_FOLDERS = ["Photos", "photos", "Logos", "logos", "Videos", "videos", "Documents", "documents", "Media", "media"];
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"]);

export type ZipExtractResult = {
  workbookBuffer: Buffer;
  workbookFileName: string;
  localMedia: Record<string, string>;
  extractDir: string;
};

/** Detect workbook file inside extracted directory */
async function findWorkbookFile(dir: string): Promise<{ path: string; name: string } | null> {
  for (const name of WORKBOOK_NAMES) {
    const fullPath = join(dir, name);
    try {
      await fs.access(fullPath);
      return { path: fullPath, name };
    } catch { /* continue */ }
  }

  const entries = await fs.readdir(dir);
  for (const entry of entries) {
    if (entry.endsWith(".xlsx") && !entry.startsWith("~")) {
      return { path: join(dir, entry), name: entry };
    }
  }
  return null;
}

/** Index local media files by filename (lowercase) */
async function indexLocalMedia(dir: string): Promise<Record<string, string>> {
  const media: Record<string, string> = {};

  async function walk(folder: string, prefix = ""): Promise<void> {
    let entries: string[];
    try {
      entries = await fs.readdir(folder);
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = join(folder, entry);
      const stat = await fs.stat(fullPath);
      if (stat.isDirectory()) {
        await walk(fullPath, prefix ? `${prefix}/${entry}` : entry);
      } else if (stat.isFile()) {
        const ext = extname(entry).toLowerCase();
        if (IMAGE_EXTENSIONS.has(ext) || ext === ".mp4" || ext === ".pdf") {
          const key = entry.toLowerCase();
          media[key] = fullPath;
          const nameWithoutExt = basename(entry, ext).toLowerCase();
          media[nameWithoutExt] = fullPath;
          if (prefix) media[`${prefix}/${key}`] = fullPath;
        }
      }
    }
  }

  for (const folder of MEDIA_FOLDERS) {
    await walk(join(dir, folder), folder);
  }

  await walk(dir);
  return media;
}

export async function extractZipToTemp(buffer: Buffer): Promise<ZipExtractResult> {
  const extractDir = join(tmpdir(), `bmw-import-${randomUUID()}`);
  await fs.mkdir(extractDir, { recursive: true });

  const zipPath = join(extractDir, "package.zip");
  await fs.writeFile(zipPath, buffer);

  try {
    const AdmZip = (await import("adm-zip")).default;
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(extractDir, true);
  } catch (err) {
    await fs.rm(extractDir, { recursive: true, force: true }).catch(() => {});
    throw new Error(`Failed to extract ZIP: ${err instanceof Error ? err.message : "unknown error"}`);
  }

  await fs.unlink(zipPath).catch(() => {});

  const workbook = await findWorkbookFile(extractDir);
  if (!workbook) {
    await fs.rm(extractDir, { recursive: true, force: true }).catch(() => {});
    throw new Error("No workbook.xlsx found in ZIP package");
  }

  const workbookBuffer = await fs.readFile(workbook.path);
  const localMedia = await indexLocalMedia(extractDir);

  return {
    workbookBuffer,
    workbookFileName: workbook.name,
    localMedia,
    extractDir,
  };
}

export async function parseWorkbookFromZip(buffer: Buffer): Promise<ParsedWorkbook & { extractDir?: string }> {
  const extracted = await extractZipToTemp(buffer);
  const raw = await parseExcelBufferToRawWorkbook(extracted.workbookBuffer);
  const workbook = parseWorkbookFromRaw({
    ...raw,
    sourceType: "zip_package",
    sourceLabel: extracted.workbookFileName,
    localMedia: extracted.localMedia,
  });
  return { ...workbook, extractDir: extracted.extractDir };
}

export async function cleanupZipExtract(extractDir: string): Promise<void> {
  await fs.rm(extractDir, { recursive: true, force: true }).catch(() => {});
}

/** Match local media file to player by name, registration code, or mobile */
export function matchLocalMediaToPlayer(
  localMedia: Record<string, string>,
  player: Record<string, unknown>,
): string | null {
  const name = String(player["Player Name"] ?? "").trim().toLowerCase();
  const regCode = String(player["Registration Code"] ?? player["Registration ID"] ?? "").trim().toLowerCase();
  const mobile = String(player["Mobile"] ?? "").replace(/\D/g, "");

  const candidates = [
    `${name}.jpg`, `${name}.jpeg`, `${name}.png`, `${name}.webp`,
    regCode ? `${regCode}.jpg` : "",
    mobile ? `${mobile}.jpg` : "",
    name,
    regCode,
    mobile,
  ].filter(Boolean);

  for (const key of candidates) {
    if (localMedia[key]) return localMedia[key];
    if (localMedia[`photos/${key}`]) return localMedia[`photos/${key}`];
  }

  return null;
}

export async function applyLocalMediaToPlayers(
  workbook: ParsedWorkbook,
): Promise<Array<{ row: number; file: string; warning?: string }>> {
  const results: Array<{ row: number; file: string; warning?: string }> = [];
  const localMedia = workbook.localMedia;
  if (!localMedia) return results;

  const playerRows = workbook.sheets["03_Players"] ?? [];
  for (let i = 0; i < playerRows.length; i++) {
    const row = playerRows[i]!;
    if (row["Photo URL"]) continue;

    const matched = matchLocalMediaToPlayer(localMedia, row);
    if (matched) {
      row["Photo URL"] = `local://${matched}`;
      results.push({ row: i + 2, file: matched });
    } else if (String(row["Player Name"] ?? "").trim()) {
      results.push({
        row: i + 2,
        file: "",
        warning: `No local photo found for ${row["Player Name"]}`,
      });
    }
  }

  return results;
}
