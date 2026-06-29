import type { StoredCloudinaryImage } from "@workspace/api-base/cloudinary-media";

export type ImageFieldChange = {
  previous: StoredCloudinaryImage;
  next: StoredCloudinaryImage;
  label: string;
};

export function queueImageFieldChange(
  changes: ImageFieldChange[],
  updates: Record<string, unknown>,
  options: {
    label: string;
    urlKey: string;
    publicIdKey: string;
    existing: StoredCloudinaryImage;
    nextUrl?: string | null;
    nextPublicId?: string | null;
  },
): void {
  if (options.nextUrl === undefined && options.nextPublicId === undefined) return;

  const nextUrl = options.nextUrl !== undefined
    ? (options.nextUrl || null)
    : (options.existing.url ?? null);
  const nextPublicId = options.nextPublicId !== undefined
    ? (options.nextPublicId || null)
    : (options.existing.publicId ?? null);

  updates[options.urlKey] = nextUrl;
  updates[options.publicIdKey] = nextPublicId;
  changes.push({
    label: options.label,
    previous: {
      url: options.existing.url ?? null,
      publicId: options.existing.publicId ?? null,
    },
    next: { url: nextUrl, publicId: nextPublicId },
  });
}
