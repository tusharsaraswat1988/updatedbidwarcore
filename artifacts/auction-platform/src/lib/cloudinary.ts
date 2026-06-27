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
   * 112×112 px — compact square slots (sidebar icon, mini avatar contexts).
   * Do not use for horizontal main/reverse wordmarks — use brandWordmark instead.
   */
  headerLogo: "w_112,h_112,c_pad,b_transparent,f_auto,q_auto",

  /**
   * Full wordmark — trim empty margins, preserve aspect ratio (no square letterbox).
   */
  brandWordmark: "w_960,c_limit,f_auto,q_auto",

  /**
   * Admin-uploaded OBS broadcast badge — trim transparent margins, preserve aspect ratio.
   */
  obsBroadcastLogo: "w_960,c_limit,e_trim,f_auto,q_auto",

  /**
   * 512×512 px — app icon / favicon source.
   * Uses PNG explicitly for broad favicon compatibility.
   */
  appIcon: "w_512,h_512,c_pad,b_transparent,f_png,q_auto",

  /**
   * Full-screen broadcast banner — scale to max width, never crop server-side.
   * Browser object-fit (cover/contain) matches the settings preview and LED display.
   */
  banner: "w_1920,c_limit,f_auto,q_auto:good",
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
