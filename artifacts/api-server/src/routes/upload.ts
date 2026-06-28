import { Router } from "express";
import multer from "multer";
import Busboy from "busboy";
import sharp from "sharp";
import { pipeline as pipelineCallback } from "node:stream";
import { promisify } from "node:util";

const pipeline = promisify(pipelineCallback);

const router = Router();
const IMAGE_UPLOAD_LIMIT_BYTES = 5 * 1024 * 1024;
const MEDIA_UPLOAD_LIMIT_BYTES = 20 * 1024 * 1024;
const AUDIO_UPLOAD_LIMIT_BYTES = 8 * 1024 * 1024;
const useStreamingUploads = () => process.env.UPLOAD_STREAMING === "true";
const unlessStreaming = (middleware: import("express").RequestHandler): import("express").RequestHandler => (req, res, next) => {
  if (useStreamingUploads()) return next();
  return middleware(req, res, next);
};

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg", "image/png", "image/webp",
  "image/gif", "image/svg+xml", "image/heic", "image/heif",
]);

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: IMAGE_UPLOAD_LIMIT_BYTES }, // 5 MB image limit
  fileFilter(_req, file, cb) {
    if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
      cb(new Error("Unsupported file type. Upload a JPEG, PNG, WebP, GIF, or SVG image."));
      return;
    }
    cb(null, true);
  },
});

const mediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MEDIA_UPLOAD_LIMIT_BYTES }, // 20 MB for video/gif
  fileFilter(_req, file, cb) {
    const allowed = file.mimetype.startsWith("image/") || file.mimetype.startsWith("video/");
    if (!allowed) {
      cb(new Error("Only image or video files are allowed"));
      return;
    }
    cb(null, true);
  },
});

const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: AUDIO_UPLOAD_LIMIT_BYTES },
  fileFilter(_req, file, cb) {
    const allowed = new Set([
      "audio/mpeg", "audio/ogg", "audio/wav", "audio/x-wav",
      "audio/aac", "audio/mp4", "audio/webm",
    ]);
    if (!allowed.has(file.mimetype) && !file.originalname.match(/\.(mp3|ogg|wav|aac|m4a|webm)$/i)) {
      cb(new Error("Unsupported audio type. Upload MP3, OGG, WAV, or AAC."));
      return;
    }
    cb(null, true);
  },
});


type UploadKind = "image" | "media" | "audio";

function uploadOptions(kind: UploadKind, mimeType?: string) {
  if (kind === "media") return { folder: "bidwar/branding", resource_type: "auto" as const };
  if (kind === "audio") return { folder: "bidwar/audio", resource_type: "video" as const };
  return {
    folder: "bidwar",
    resource_type: "image" as const,
    quality: "auto" as const,
    fetch_format: "auto" as const,
    ...(mimeType && shouldOptimizeImage(mimeType) ? { format: "webp" as const } : {}),
  };
}

function isAllowedUpload(kind: UploadKind, mimeType: string, filename: string): boolean {
  if (kind === "media") return mimeType.startsWith("image/") || mimeType.startsWith("video/");
  if (kind === "audio") return new Set(["audio/mpeg", "audio/ogg", "audio/wav", "audio/x-wav", "audio/aac", "audio/mp4", "audio/webm"]).has(mimeType) || /\.(mp3|ogg|wav|aac|m4a|webm)$/i.test(filename);
  return ALLOWED_IMAGE_TYPES.has(mimeType);
}

function uploadLimitBytes(kind: UploadKind): number {
  if (kind === "audio") return AUDIO_UPLOAD_LIMIT_BYTES;
  if (kind === "media") return MEDIA_UPLOAD_LIMIT_BYTES;
  return IMAGE_UPLOAD_LIMIT_BYTES;
}

function shouldOptimizeImage(mimeType: string): boolean {
  return mimeType.startsWith("image/") && mimeType !== "image/svg+xml" && mimeType !== "image/gif";
}

async function optimizeImageBuffer(file: Express.Multer.File): Promise<Buffer> {
  if (!shouldOptimizeImage(file.mimetype)) return file.buffer;
  return sharp(file.buffer)
    .rotate()
    .webp({ quality: 82, effort: 4 })
    .toBuffer();
}

async function uploadStreaming(req: import("express").Request, kind: UploadKind): Promise<string> {
  const cloudinary = await getCloudinary();
  if (!cloudinary) throw Object.assign(new Error("Cloudinary not configured"), { statusCode: 503 });

  return new Promise<string>((resolve, reject) => {
    const bb = Busboy({ headers: req.headers, limits: { files: 1, fileSize: uploadLimitBytes(kind) } });
    let settled = false;
    let sawFile = false;
    const finish = (err?: unknown, url?: string) => {
      if (settled) return;
      settled = true;
      if (err) reject(err);
      else resolve(url!);
    };

    bb.on("file", (_name, file, info) => {
      sawFile = true;
      if (!isAllowedUpload(kind, info.mimeType, info.filename)) {
        file.resume();
        finish(Object.assign(new Error("Unsupported file type"), { statusCode: 400 }));
        return;
      }

      const upload = cloudinary.uploader.upload_stream(uploadOptions(kind, info.mimeType), (error, result) => {
        if (error || !result) finish(error ?? new Error("Cloudinary upload failed"));
        else finish(undefined, result.secure_url);
      });
      upload.on("error", finish);

      const source = kind === "image" && shouldOptimizeImage(info.mimeType)
        ? file.pipe(sharp().rotate().webp({ quality: 82, effort: 4 }))
        : file;

      void pipeline(source, upload).catch(finish);
    });
    bb.on("error", finish);
    bb.on("finish", () => {
      if (!sawFile) finish(Object.assign(new Error("No file provided"), { statusCode: 400 }));
    });
    req.pipe(bb);
  });
}

function releaseMulterFile(req: { file?: Express.Multer.File }): void {
  if (req.file) {
    req.file.buffer = Buffer.alloc(0);
    req.file = undefined;
  }
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

/**
 * POST /api/upload
 * Accepts a single image file (multipart/form-data, field name "file").
 * Uploads it to Cloudinary and returns the secure HTTPS URL.
 */
router.post("/upload", unlessStreaming(imageUpload.single("file")), async (req, res) => {
  if (useStreamingUploads()) {
    try { res.json({ url: await uploadStreaming(req, "image") }); }
    catch (err) { req.log?.error({ err }, "Cloudinary streaming upload error"); res.status((err as { statusCode?: number }).statusCode ?? 500).json({ error: "Upload failed. Please try again." }); }
    return;
  }
  const cloudinary = await getCloudinary();
  if (!cloudinary) {
    res.status(503).json({
      error: "Image upload is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.",
    });
    return;
  }

  if (!req.file) {
    res.status(400).json({ error: "No file provided. Send a multipart/form-data request with a field named 'file'." });
    return;
  }

  try {
    const url = await new Promise<string>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        uploadOptions("image", req.file!.mimetype),
        (error, result) => {
          if (error || !result) reject(error ?? new Error("Cloudinary upload failed"));
          else resolve(result.secure_url);
        },
      );
      void optimizeImageBuffer(req.file!)
        .then((buffer) => stream.end(buffer))
        .catch(reject);
    });
    res.json({ url });
  } catch (err) {
    req.log?.error({ err }, "Cloudinary upload error");
    res.status(500).json({ error: "Upload failed. Please try again." });
  } finally {
    releaseMulterFile(req);
  }
});

/**
 * POST /api/upload/media
 * Accepts images OR video files (MP4, WEBM, GIF) up to 20 MB.
 * Uses Cloudinary resource_type "auto" so videos are stored correctly.
 * Used for branding assets like logo animations.
 */
router.post("/upload/media", unlessStreaming(mediaUpload.single("file")), async (req, res) => {
  if (useStreamingUploads()) {
    try { res.json({ url: await uploadStreaming(req, "media") }); }
    catch (err) { req.log?.error({ err }, "Cloudinary media streaming upload error"); res.status((err as { statusCode?: number }).statusCode ?? 500).json({ error: "Upload failed. Please try again." }); }
    return;
  }
  const cloudinary = await getCloudinary();
  if (!cloudinary) {
    res.status(503).json({
      error: "Media upload is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.",
    });
    return;
  }

  if (!req.file) {
    res.status(400).json({ error: "No file provided." });
    return;
  }

  try {
    const url = await new Promise<string>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: "bidwar/branding", resource_type: "auto" },
        (error, result) => {
          if (error || !result) reject(error ?? new Error("Cloudinary upload failed"));
          else resolve(result.secure_url);
        },
      );
      stream.end(req.file!.buffer);
    });
    res.json({ url });
  } catch (err) {
    req.log?.error({ err }, "Cloudinary media upload error");
    res.status(500).json({ error: "Upload failed. Please try again." });
  } finally {
    releaseMulterFile(req);
  }
});

/**
 * POST /api/upload/audio
 * Accepts audio files up to 8 MB for platform/tournament broadcast sounds.
 */
router.post("/upload/audio", unlessStreaming(audioUpload.single("file")), async (req, res) => {
  if (useStreamingUploads()) {
    try { res.json({ url: await uploadStreaming(req, "audio") }); }
    catch (err) { req.log?.error({ err }, "Cloudinary audio streaming upload error"); res.status((err as { statusCode?: number }).statusCode ?? 500).json({ error: "Upload failed. Please try again." }); }
    return;
  }
  const cloudinary = await getCloudinary();
  if (!cloudinary) {
    res.status(503).json({
      error: "Audio upload is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.",
    });
    return;
  }

  if (!req.file) {
    res.status(400).json({ error: "No file provided." });
    return;
  }

  try {
    const url = await new Promise<string>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: "bidwar/audio", resource_type: "video" },
        (error, result) => {
          if (error || !result) reject(error ?? new Error("Cloudinary upload failed"));
          else resolve(result.secure_url);
        },
      );
      stream.end(req.file!.buffer);
    });
    res.json({ url });
  } catch (err) {
    req.log?.error({ err }, "Cloudinary audio upload error");
    res.status(500).json({ error: "Upload failed. Please try again." });
  } finally {
    releaseMulterFile(req);
  }
});

export default router;
