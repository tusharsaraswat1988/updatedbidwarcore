import { Router, type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import {
  getCloudinary,
  uploadBufferToCloudinary,
  uploadPathToCloudinary,
} from "../lib/cloudinary-media-service";
import { createDiskMulter, readUploadedFile, removeUploadedFile } from "../lib/multer-disk-storage";
import { sharpToBuffer } from "../lib/sharp-pipeline";

const router = Router();

const MAX_IMAGE_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_UPLOAD_DIMENSION_PX = 1600;

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "image/heic",
  "image/heif",
]);

const imageUpload = createDiskMulter({
  limits: { fileSize: MAX_IMAGE_UPLOAD_BYTES },
  fileFilter(_req, file, cb) {
    if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
      cb(
        new Error(
          "Unsupported file type. Upload a JPEG, PNG, WebP, GIF, or SVG image.",
        ),
      );
      return;
    }
    cb(null, true);
  },
});

const mediaUpload = createDiskMulter({
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const allowed =
      file.mimetype.startsWith("image/") || file.mimetype.startsWith("video/");
    if (!allowed) {
      cb(new Error("Only image or video files are allowed"));
      return;
    }
    cb(null, true);
  },
});

const audioUpload = createDiskMulter({
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const allowed = new Set([
      "audio/mpeg",
      "audio/ogg",
      "audio/wav",
      "audio/x-wav",
      "audio/aac",
      "audio/mp4",
      "audio/webm",
    ]);
    if (
      !allowed.has(file.mimetype)
      && !file.originalname.match(/\.(mp3|ogg|wav|aac|m4a|webm)$/i)
    ) {
      cb(new Error("Unsupported audio type. Upload MP3, OGG, WAV, or AAC."));
      return;
    }
    cb(null, true);
  },
});

function isSvg(file: Express.Multer.File) {
  return (
    file.mimetype === "image/svg+xml"
    || file.originalname.toLowerCase().endsWith(".svg")
  );
}

function shouldOptimizeRasterImage(file: Express.Multer.File) {
  return (
    file.mimetype.startsWith("image/")
    && !isSvg(file)
    && file.mimetype !== "image/gif"
  );
}

function uploadInput(file: Express.Multer.File): string {
  if (!file.path) {
    throw new Error("Uploaded file path missing");
  }
  return file.path;
}

async function optimizeImageFile(file: Express.Multer.File) {
  if (!shouldOptimizeRasterImage(file)) {
    const buffer = await readUploadedFile(file);
    return { buffer, mimetype: file.mimetype };
  }

  const optimized = await sharpToBuffer(uploadInput(file), (pipeline) =>
    pipeline
      .rotate()
      .resize({
        width: MAX_IMAGE_UPLOAD_DIMENSION_PX,
        height: MAX_IMAGE_UPLOAD_DIMENSION_PX,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 88, effort: 4 }),
  );

  return { buffer: optimized, mimetype: "image/webp" };
}

/**
 * POST /api/upload
 * Accepts a single image file (multipart/form-data, field name "file").
 * Uploads it to Cloudinary and returns the secure HTTPS URL and public_id.
 */
router.post("/upload", imageUpload.single("file"), async (req, res) => {
  const cloudinary = await getCloudinary();
  if (!cloudinary) {
    res.status(503).json({
      error:
        "Image upload is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.",
    });
    return;
  }

  if (!req.file) {
    res.status(400).json({
      error:
        "No file provided. Send a multipart/form-data request with a field named 'file'.",
    });
    return;
  }

  let uploadBuffer: Buffer | null = null;
  try {
    const optimized = await optimizeImageFile(req.file);
    uploadBuffer = optimized.buffer;
    const uploaded = await uploadBufferToCloudinary(uploadBuffer, {
      folder: "bidwar",
      resource_type: "image",
      quality: "auto",
      fetch_format: "auto",
      format: optimized.mimetype === "image/webp" ? "webp" : undefined,
    });
    res.json({ url: uploaded.url, publicId: uploaded.publicId });
  } catch (err) {
    req.log?.error({ err }, "Cloudinary upload error");
    res.status(500).json({ error: "Upload failed. Please try again." });
  } finally {
    uploadBuffer = null;
    await removeUploadedFile(req.file);
  }
});

/**
 * POST /api/upload/media
 * Accepts images OR video files (MP4, WEBM, GIF) up to 20 MB.
 */
router.post("/upload/media", mediaUpload.single("file"), async (req, res) => {
  const cloudinary = await getCloudinary();
  if (!cloudinary) {
    res.status(503).json({
      error:
        "Media upload is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.",
    });
    return;
  }

  if (!req.file) {
    res.status(400).json({ error: "No file provided." });
    return;
  }

  if (
    req.file.mimetype.startsWith("image/")
    && req.file.size > MAX_IMAGE_UPLOAD_BYTES
  ) {
    await removeUploadedFile(req.file);
    res.status(413).json({ error: "Image uploads are limited to 5 MB." });
    return;
  }

  let uploadBuffer: Buffer | null = null;
  try {
    if (req.file.mimetype.startsWith("image/")) {
      const optimized = await optimizeImageFile(req.file);
      uploadBuffer = optimized.buffer;
      const uploaded = await uploadBufferToCloudinary(uploadBuffer, {
        folder: "bidwar/branding",
        resource_type: "auto",
      });
      res.json({ url: uploaded.url, publicId: uploaded.publicId });
    } else {
      const uploaded = await uploadPathToCloudinary(uploadInput(req.file), {
        folder: "bidwar/branding",
        resource_type: "auto",
      });
      res.json({ url: uploaded.url, publicId: uploaded.publicId });
    }
  } catch (err) {
    req.log?.error({ err }, "Cloudinary media upload error");
    res.status(500).json({ error: "Upload failed. Please try again." });
  } finally {
    uploadBuffer = null;
    await removeUploadedFile(req.file);
  }
});

/**
 * POST /api/upload/audio
 * Accepts audio files up to 8 MB for platform/tournament broadcast sounds.
 */
router.post("/upload/audio", audioUpload.single("file"), async (req, res) => {
  const cloudinary = await getCloudinary();
  if (!cloudinary) {
    res.status(503).json({
      error:
        "Audio upload is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.",
    });
    return;
  }

  if (!req.file) {
    res.status(400).json({ error: "No file provided." });
    return;
  }

  try {
    const uploaded = await uploadPathToCloudinary(uploadInput(req.file), {
      folder: "bidwar/audio",
      resource_type: "raw",
    });
    res.json({ url: uploaded.url, publicId: uploaded.publicId });
  } catch (err) {
    req.log?.error({ err }, "Cloudinary audio upload error");
    res.status(500).json({ error: "Upload failed. Please try again." });
  } finally {
    await removeUploadedFile(req.file);
  }
});

router.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
    res.status(413).json({ error: "Image uploads are limited to 5 MB." });
    return;
  }
  next(err);
});

export default router;
