/**
 * Buzz Studio — Share Contracts
 *
 * Contracts for the public share layer — the final step in the pipeline
 * that makes a rendered asset accessible to players, teams, and audiences
 * via a short URL on Instagram, WhatsApp, and Facebook.
 *
 * Design principle: ShareMetadata is the public face of a render.
 * It is the only contract that external consumers (WhatsApp delivery,
 * share pages, QR codes) interact with. It NEVER exposes raw storage paths,
 * bucket names, or internal IDs.
 *
 * Future flow:
 *   StoredAsset
 *       ↓  (createShareMetadata)
 *   ShareMetadata         ← this file
 *       ↓
 *   Share page / WhatsApp / Instagram / QR code
 *
 * No imports. No SDK dependencies. Pure interfaces.
 */

/* ─── ShareChannel ───────────────────────────────────────────────────────── */

/**
 * Distribution channels a share link targets.
 * Used for analytics tracking and deep-link URL formatting.
 */
export enum ShareChannel {
  /** Public web share page. Default channel. */
  WEB   = "web",
  /** WhatsApp deep-link (wa.me) with pre-filled caption. */
  WHATSAPP = "whatsapp",
  /** Instagram story / post intent. */
  INSTAGRAM = "instagram",
  /** Facebook post share. */
  FACEBOOK  = "facebook",
  /** Direct download link — returns the raw image file. */
  DOWNLOAD  = "download",
}

/* ─── ShareMetadata ──────────────────────────────────────────────────────── */

/**
 * Public share envelope for a Buzz Studio creative.
 *
 * This is what a player receives when the organiser shares their sold card:
 * a short URL they can open in a browser, tap "Save", and post immediately.
 *
 * The `downloadEnabled` flag is architectural — players must be able to
 * download their card for offline sharing on WhatsApp and other platforms
 * that do not support web share links directly.
 *
 * @example
 * {
 *   shareId: "buzz_ab12cd",
 *   jobId: "abc-123",
 *   assetId: "ba7c9f12-...",
 *   publicUrl: "https://cdn.bidwar.app/buzz/ba7c9f12.png",
 *   shareUrl: "https://bidwar.app/share/buzz_ab12cd",
 *   downloadEnabled: true,
 *   downloadUrl: "https://bidwar.app/share/buzz_ab12cd/download",
 *   templateId: "sold_player",
 *   channel: ShareChannel.WEB,
 *   createdAt: "2026-06-18T12:34:56.789Z"
 * }
 */
export interface ShareMetadata {
  /**
   * Short, human-safe share identifier.
   * Used in share URLs: /share/{shareId}
   * Recommended format: "buzz_" + 6-char alphanumeric (e.g. "buzz_ab12cd").
   */
  shareId: string;

  /**
   * The jobId of the originating RenderJob.
   * Enables full pipeline trace: share → asset → result → job → contract.
   */
  jobId?: string;

  /**
   * The assetId of the StoredAsset this share points to.
   * Links share metadata to the storage layer.
   */
  assetId?: string;

  /**
   * Direct public URL to the rendered image file.
   * This is the URL embedded in Open Graph tags, WhatsApp previews,
   * and QR code payloads.
   *
   * Example: "https://cdn.bidwar.app/buzz/ba7c9f12.png"
   */
  publicUrl?: string;

  /**
   * The short share page URL players receive.
   * Opening this URL shows a branded page with the card + download button.
   *
   * Example: "https://bidwar.app/share/buzz_ab12cd"
   */
  shareUrl?: string;

  /**
   * Whether the download button is shown on the share page.
   *
   * MUST be true by default — players need to save their sold card
   * to their phone for sharing on WhatsApp, Instagram, and Facebook.
   * Only set to false for watermark-only previews or paid-tier restrictions.
   *
   * @default true
   */
  downloadEnabled?: boolean;

  /**
   * Direct download URL that serves the image as an attachment.
   * Populated only when downloadEnabled is true.
   *
   * Example: "https://bidwar.app/share/buzz_ab12cd/download"
   */
  downloadUrl?: string;

  /**
   * Which template produced this share.
   * Used for analytics grouping ("sold_player shares in June").
   */
  templateId?: string;

  /**
   * Primary distribution channel this share is optimised for.
   * @default ShareChannel.WEB
   */
  channel?: ShareChannel;

  /**
   * ISO 8601 timestamp when this share was created.
   */
  createdAt?: string;

  /**
   * ISO 8601 expiry timestamp.
   * After this time, the share page returns a 410 Gone response.
   * Undefined = share never expires.
   */
  expiresAt?: string;

  /**
   * Pre-formatted WhatsApp caption text.
   * Used when building wa.me deep-links for WhatsApp delivery.
   *
   * Example: "🏏 SOLD! Rahul Sharma → Varanasi Warriors for ₹75,000 🎉\n{shareUrl}"
   */
  whatsappCaption?: string;
}

/* ─── ShareRequest ───────────────────────────────────────────────────────── */

/**
 * Input shape for createShareMetadata().
 * Carries the minimum data needed to produce a ShareMetadata record.
 */
export interface ShareRequest {
  /** The StoredAsset to create a share link for. */
  assetId: string;
  jobId?: string;
  /** Which channel to optimise the share link for. @default ShareChannel.WEB */
  channel?: ShareChannel;
  /**
   * Whether to enable download.
   * @default true
   */
  downloadEnabled?: boolean;
  /** Pre-formatted WhatsApp caption. Used for WhatsApp delivery channel. */
  whatsappCaption?: string;
}
