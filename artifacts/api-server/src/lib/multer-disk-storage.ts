import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import multer from "multer";

const UPLOAD_TMP_DIR = join(tmpdir(), "bidwar-uploads");

mkdirSync(UPLOAD_TMP_DIR, { recursive: true });

function uniqueUploadFilename(originalname: string): string {
  const ext = extname(originalname) || "";
  return `${Date.now()}-${randomBytes(8).toString("hex")}${ext}`;
}

export function createDiskMulter(options: {
  limits: { fileSize: number };
  fileFilter?: multer.Options["fileFilter"];
}) {
  return multer({
    storage: multer.diskStorage({
      destination: UPLOAD_TMP_DIR,
      filename: (_req, file, cb) => {
        cb(null, uniqueUploadFilename(file.originalname));
      },
    }),
    limits: options.limits,
    fileFilter: options.fileFilter,
  });
}

export async function readUploadedFile(file: Express.Multer.File): Promise<Buffer> {
  if (file.path) {
    return readFile(file.path);
  }
  if (file.buffer?.length) {
    return file.buffer;
  }
  throw new Error("Uploaded file has no path or buffer");
}

export async function removeUploadedFile(file?: Express.Multer.File): Promise<void> {
  if (!file?.path) return;
  await unlink(file.path).catch(() => {});
}
