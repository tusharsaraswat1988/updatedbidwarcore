/**
 * Cloudinary delivery-URL transformation helpers.
 *
 * All images are stored on Cloudinary as raw uploads. Before rendering we
 * inject transformation parameters into the URL so Cloudinary:
 *   - Converts to WebP (or AVIF) for browsers that support it  (f_auto)
 *   - Applies optimal compression                               (q_auto)
 *   - Resizes to the exact dimensions required for that slot
 *   - Centers on the subject's face for player photos          (g_face)
 *
 * Non-Cloudinary URLs (local assets, external hosts) are returned unchanged,
 * so the function is always safe to call on any URL string.
 *
 * Usage:
 *   import { cldUrl } from "@/lib/cloudinary";
 *   <img src={cldUrl(player.photoUrl, "playerCard")} ... />
 */

const PRESETS = {
  /** 80×80 px — circular mini-avatars in player lists / player registry overlay */
  thumbnail: "w_80,h_80,c_fill,g_face,f_auto,q_auto",

  /** 160×160 px — medium avatars (operator panel, sold-to chips) */
  avatar: "w_160,h_160,c_fill,g_face,f_auto,q_auto",

  /** 560×700 px — large player card on LED / 4K venue displays */
  playerCard: "w_560,h_700,c_fill,g_face,f_auto,q_auto",

  /** 320×384 px — sold card player photo (sharp on large panels) */
  soldCard: "w_320,h_384,c_fill,g_face,f_auto,q_auto",

  /**
   * 200×200 px — team logos and sponsor logos.
   * c_pad preserves the full logo without cropping; b_transparent fills
   * padding with transparency (retained in WebP/PNG delivery).
   */
  teamLogo: "w_200,h_200,c_pad,b_transparent,f_auto,q_auto",

  /**
   * 112×112 px — tournament header / identity logo (40-56 px rendered size
   * with retina headroom).
   */
  headerLogo: "w_112,h_112,c_pad,b_transparent,f_auto,q_auto",

  /**
   * 1920×1080 px — full-screen broadcast banner.
   * q_auto:good gives excellent quality for a large hero image without
   * the file size cost of q_auto:best.
   */
  banner: "w_1920,h_1080,c_fill,f_auto,q_auto:good",
} as const;

export type CldPreset = keyof typeof PRESETS;

/**
 * Returns a Cloudinary URL with the given transformation preset injected.
 *
 * - If `url` is null / undefined / empty, returns "".
 * - If `url` is not a Cloudinary URL, returns `url` unchanged.
 * - If the preset params are already present in the URL, returns `url`
 *   unchanged (prevents double-injection on re-renders).
 */
export function cldUrl(
  url: string | null | undefined,
  preset: CldPreset,
): string {
  if (!url) return "";
  if (!url.includes("res.cloudinary.com")) return url;
  const params = PRESETS[preset];
  if (url.includes(params)) return url;
  return url.replace("/upload/", `/upload/${params}/`);
}
