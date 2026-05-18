/**
 * Returns true if the value is acceptable as an image URL:
 * - null / undefined / empty string (field being cleared)
 * - a Cloudinary HTTPS URL
 *
 * Returns false for data: URIs, local paths, attached_assets, or
 * any other non-Cloudinary URL.
 *
 * NOTE: The cloudinary SDK itself is loaded lazily inside the upload route
 * (dynamic import) so the server can start without Cloudinary credentials.
 */
export function isValidImageUrl(value: string | null | undefined): boolean {
  if (!value) return true;
  if (value.startsWith("data:")) return false;
  if (value.startsWith("file:") || value.startsWith("/")) return false;
  return value.startsWith("https://res.cloudinary.com/");
}
