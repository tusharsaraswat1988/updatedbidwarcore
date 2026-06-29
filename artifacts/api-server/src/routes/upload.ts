import { Router, type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import sharp from "sharp";

const router = Router();

const MAX_IMAGE_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_SPONSOR_LOGO_DIMENSION_PX = 1200;

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg", "image/png", "image/webp",
  "image/gif", "image/svg+xml", "image/heic", "image/heif",
]);

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_UPLOAD_BYTES },
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
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB for video/gif
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
  limits: { fileSize: 8 * 1024 * 1024 },
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

function isSvg(file: Express.Multer.File) {
  return file.mimetype === "image/svg+xml" || file.originalname.toLowerCase().endsWith(".svg");
}

function shouldOptimizeRasterImage(file: Express.Multer.File) {
  return file.mimetype.startsWith("image/") && !isSvg(file) && file.mimetype !== "image/gif";
}

async function optimizeImageBuffer(file: Express.Multer.File) {
  if (!shouldOptimizeRasterImage(file)) {
    return { buffer: file.buffer, mimetype: file.mimetype };
  }

  const optimized = await sharp(file.buffer, { failOn: "none" })
    .rotate()
    .resize({
      width: MAX_SPONSOR_LOGO_DIMENSION_PX,
      height: MAX_SPONSOR_LOGO_DIMENSION_PX,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 82, effort: 4 })
    .toBuffer();

  return { buffer: optimized, mimetype: "image/webp" };
}

function clearMulterFileBuffer(file?: Express.Multer.File) {
  if (!file) return;
  file.buffer = Buffer.alloc(0);
}

function uploadToCloudinary(
  cloudinary: Awaited<ReturnType<typeof getCloudinary>>,
  buffer: Buffer,
  options: Record<string, unknown>,
) {
  if (!cloudinary) throw new Error("Cloudinary is not configured");

  return new Promise<string>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      options,
      (error, result) => {
        if (error || !result) reject(error ?? new Error("Cloudinary upload failed"));
        else resolve(result.secure_url);
      },
    );
    stream.end(buffer);
  });
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
router.post("/upload", imageUpload.single("file"), async (req, res) => {
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

  let uploadBuffer: Buffer | null = null;
  try {
    const optimized = await optimizeImageBuffer(req.file);
    uploadBuffer = optimized.buffer;
    const url = await uploadToCloudinary(cloudinary, uploadBuffer, {
      folder: "bidwar",
      resource_type: "image",
      quality: "auto",
      fetch_format: "auto",
      format: optimized.mimetype === "image/webp" ? "webp" : undefined,
    });
    res.json({ url });
  } catch (err) {
    req.log?.error({ err }, "Cloudinary upload error");
    res.status(500).json({ error: "Upload failed. Please try again." });
  } finally {
    uploadBuffer = null;
    clearMulterFileBuffer(req.file);
  }
});

/**
 * POST /api/upload/media
 * Accepts images OR video files (MP4, WEBM, GIF) up to 20 MB.
 * Uses Cloudinary resource_type "auto" so videos are stored correctly.
 * Used for branding assets like logo animations.
 */
router.post("/upload/media", mediaUpload.single("file"), async (req, res) => {
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

  if (req.file.mimetype.startsWith("image/") && req.file.size > MAX_IMAGE_UPLOAD_BYTES) {
    clearMulterFileBuffer(req.file);
    res.status(413).json({ error: "Image uploads are limited to 5 MB." });
    return;
  }

  let uploadBuffer: Buffer | null = null;
  try {
    if (req.file.mimetype.startsWith("image/")) {
      const optimized = await optimizeImageBuffer(req.file);
      uploadBuffer = optimized.buffer;
    } else {
      uploadBuffer = req.file.buffer;
    }

    const url = await uploadToCloudinary(cloudinary, uploadBuffer, {
      folder: "bidwar/branding",
      resource_type: "auto",
    });
    res.json({ url });
  } catch (err) {
    req.log?.error({ err }, "Cloudinary media upload error");
    res.status(500).json({ error: "Upload failed. Please try again." });
  } finally {
    uploadBuffer = null;
    clearMulterFileBuffer(req.file);
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
    clearMulterFileBuffer(req.file);
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
