import {
  isBidWarManagedPublicId,
  normalizeCloudinaryImageUrl,
  parseCloudinaryPublicIdFromUrl,
  resolveCloudinaryPublicId,
  type CloudinaryUploadResult,
  type StoredCloudinaryImage,
} from "@workspace/api-base/cloudinary-media";

type CloudinaryLogger = {
  error?: (obj: unknown, msg?: string) => void;
  warn?: (obj: unknown, msg?: string) => void;
};

let cloudinaryModule: typeof import("cloudinary") | null = null;

export async function getCloudinary() {
  if (
    !process.env.CLOUDINARY_CLOUD_NAME
    || !process.env.CLOUDINARY_API_KEY
    || !process.env.CLOUDINARY_API_SECRET
  ) {
    return null;
  }
  if (
    process.env.CLOUDINARY_URL
    && !process.env.CLOUDINARY_URL.startsWith("cloudinary://")
  ) {
    delete process.env.CLOUDINARY_URL;
  }

  if (!cloudinaryModule) {
    cloudinaryModule = await import("cloudinary");
  }

  cloudinaryModule.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  return cloudinaryModule.v2;
}

export async function uploadBufferToCloudinary(
  buffer: Buffer,
  options: Record<string, unknown>,
): Promise<CloudinaryUploadResult> {
  const cloudinary = await getCloudinary();
  if (!cloudinary) throw new Error("Cloudinary is not configured");

  return new Promise<CloudinaryUploadResult>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      options,
      (error, result) => {
        if (error || !result?.secure_url || !result.public_id) {
          reject(error ?? new Error("Cloudinary upload failed"));
          return;
        }
        resolve({ url: result.secure_url, publicId: result.public_id });
      },
    );
    stream.end(buffer);
  });
}

export async function destroyCloudinaryAssetSafe(
  publicId: string | null | undefined,
  logger?: CloudinaryLogger,
  context?: Record<string, unknown>,
): Promise<void> {
  const normalized = publicId?.trim();
  if (!normalized || !isBidWarManagedPublicId(normalized)) return;

  try {
    const cloudinary = await getCloudinary();
    if (!cloudinary) {
      logger?.warn?.({ publicId: normalized, ...context }, "Cloudinary delete skipped: not configured");
      return;
    }

    const result = await cloudinary.uploader.destroy(normalized, {
      resource_type: "image",
      invalidate: true,
    });

    if (result.result !== "ok" && result.result !== "not found") {
      logger?.warn?.(
        { publicId: normalized, result: result.result, ...context },
        "Cloudinary asset destroy returned unexpected result",
      );
    }
  } catch (err) {
    logger?.error?.(
      { err, publicId: normalized, ...context },
      "Cloudinary asset destroy failed",
    );
  }
}

/**
 * Replace flow: persist first, then delete the previous asset.
 * Remove flow: delete first, then persist cleared fields.
 */
export async function commitCloudinaryImageWrite(options: {
  previous: StoredCloudinaryImage;
  next: StoredCloudinaryImage;
  persist: () => Promise<void>;
  logger?: CloudinaryLogger;
  context?: Record<string, unknown>;
}): Promise<void> {
  const previousId = resolveCloudinaryPublicId(options.previous);
  const nextUrl = normalizeCloudinaryImageUrl(options.next.url);
  const nextId = resolveCloudinaryPublicId(options.next);
  const isRemoval = !nextUrl;

  if (isRemoval) {
    if (previousId) {
      await destroyCloudinaryAssetSafe(previousId, options.logger, options.context);
    }
    await options.persist();
    return;
  }

  await options.persist();

  if (previousId && previousId !== nextId) {
    await destroyCloudinaryAssetSafe(previousId, options.logger, options.context);
  }
}

export function resolvePublicIdFromStoredOrUrl(
  publicId: string | null | undefined,
  url: string | null | undefined,
): string | null {
  return publicId?.trim() || parseCloudinaryPublicIdFromUrl(url);
}

export async function destroyRemovedCloudinaryImages(
  removed: StoredCloudinaryImage[],
  logger?: CloudinaryLogger,
  context?: Record<string, unknown>,
): Promise<void> {
  for (const image of removed) {
    const publicId = resolveCloudinaryPublicId(image);
    if (publicId) {
      await destroyCloudinaryAssetSafe(publicId, logger, context);
    }
  }
}

export async function commitBatchCloudinaryImageWrites(options: {
  changes: Array<{
    previous: StoredCloudinaryImage;
    next: StoredCloudinaryImage;
    label?: string;
  }>;
  persist: () => Promise<void>;
  logger?: CloudinaryLogger;
  context?: Record<string, unknown>;
}): Promise<void> {
  const removals = options.changes.filter(
    (change) => !normalizeCloudinaryImageUrl(change.next.url),
  );
  const replacements = options.changes.filter(
    (change) => normalizeCloudinaryImageUrl(change.next.url),
  );

  for (const change of removals) {
    const previousId = resolveCloudinaryPublicId(change.previous);
    if (previousId) {
      await destroyCloudinaryAssetSafe(previousId, options.logger, {
        ...options.context,
        field: change.label,
        mode: "remove",
      });
    }
  }

  await options.persist();

  for (const change of replacements) {
    const previousId = resolveCloudinaryPublicId(change.previous);
    const nextId = resolveCloudinaryPublicId(change.next);
    if (previousId && previousId !== nextId) {
      await destroyCloudinaryAssetSafe(previousId, options.logger, {
        ...options.context,
        field: change.label,
        mode: "replace",
      });
    }
  }
}
