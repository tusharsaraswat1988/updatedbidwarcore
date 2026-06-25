/**
 * Upload rendered creative PNG buffers to Cloudinary or local private storage.
 * No public routes — URLs are returned only via organizer-scoped creative job API.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export interface StoreCreativePngInput {
  tournamentId: number;
  jobId: string;
  buffer: Buffer;
}

export interface StoreCreativePngResult {
  resultUrl: string;
  storage: "cloudinary" | "local";
}

async function getCloudinary() {
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    return null;
  }
  if (process.env.CLOUDINARY_URL && !process.env.CLOUDINARY_URL.startsWith("cloudinary://")) {
    delete process.env.CLOUDINARY_URL;
  }
  const { v2: cloudinary } = await import("cloudinary");
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  return cloudinary;
}

async function uploadToCloudinary(input: StoreCreativePngInput): Promise<string> {
  const cloudinary = await getCloudinary();
  if (!cloudinary) {
    throw new Error(
      "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.",
    );
  }

  return new Promise<string>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `bidwar/buzz/${input.tournamentId}`,
        public_id: input.jobId,
        resource_type: "image",
        format: "png",
        overwrite: true,
        invalidate: true,
      },
      (error, result) => {
        if (error || !result) reject(error ?? new Error("Cloudinary upload failed"));
        else resolve(result.secure_url);
      },
    );
    stream.end(input.buffer);
  });
}

async function saveToLocalPrivateStorage(input: StoreCreativePngInput): Promise<string> {
  const baseDir =
    process.env.CREATIVE_RENDER_LOCAL_DIR?.trim() ||
    path.join(process.cwd(), "data", "creative-renders");
  const dir = path.join(baseDir, String(input.tournamentId));
  await mkdir(dir, { recursive: true });
  const filePath = path.join(dir, `${input.jobId}.png`);
  await writeFile(filePath, input.buffer);
  // Internal reference — not exposed via public HTTP; organizer API resolves later.
  return `local://creative-renders/${input.tournamentId}/${input.jobId}.png`;
}

const LOCAL_RESULT_PREFIX = "local://creative-renders/";

function creativeRenderBaseDir(): string {
  return (
    process.env.CREATIVE_RENDER_LOCAL_DIR?.trim() ||
    path.join(process.cwd(), "data", "creative-renders")
  );
}

/** Resolve a stored local:// result URL to an absolute filesystem path (path traversal safe). */
export function resolveLocalCreativePngPath(resultUrl: string): string | null {
  if (!resultUrl.startsWith(LOCAL_RESULT_PREFIX)) return null;
  const relative = resultUrl.slice(LOCAL_RESULT_PREFIX.length);
  if (!relative || relative.includes("..")) return null;

  const baseDir = path.resolve(creativeRenderBaseDir());
  const filePath = path.resolve(baseDir, relative);
  if (filePath !== baseDir && !filePath.startsWith(`${baseDir}${path.sep}`)) {
    return null;
  }
  return filePath;
}

export function isLocalCreativeResultUrl(resultUrl: string): boolean {
  return resultUrl.startsWith(LOCAL_RESULT_PREFIX);
}

/**
 * Persist PNG output. Prefers Cloudinary when configured; falls back to local private disk.
 */
export async function storeCreativePng(input: StoreCreativePngInput): Promise<StoreCreativePngResult> {
  const preferLocal = process.env.CREATIVE_RENDER_STORAGE === "local";
  const cloudinaryConfigured = Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET,
  );

  if (!preferLocal && cloudinaryConfigured) {
    const resultUrl = await uploadToCloudinary(input);
    return { resultUrl, storage: "cloudinary" };
  }

  if (preferLocal || !cloudinaryConfigured) {
    const resultUrl = await saveToLocalPrivateStorage(input);
    return { resultUrl, storage: "local" };
  }

  throw new Error("No creative render storage backend is available.");
}
