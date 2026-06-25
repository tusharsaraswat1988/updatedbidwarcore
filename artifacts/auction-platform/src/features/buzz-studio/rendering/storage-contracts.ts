/**
 * Buzz Studio — Storage Contracts
 *
 * Provider-agnostic storage interfaces for rendered assets.
 *
 * Design principle: the pipeline never references S3, R2, Firebase, or
 * Cloudflare directly. Storage implementations plug in by satisfying
 * AssetStorageProvider. This keeps templates, contracts, and the pipeline
 * decoupled from any specific cloud vendor.
 *
 * Future flow:
 *   RenderResult
 *       ↓  (storeRenderResult → provider.store)
 *   StoredAsset           ← this file
 *       ↓  (createShareMetadata)
 *   ShareMetadata
 *
 * No imports. No SDK dependencies. Pure interfaces.
 */

/* ─── StoredAsset ────────────────────────────────────────────────────────── */

/**
 * A rendered image that has been persisted to a durable storage provider.
 * The assetId is the correlation key used to retrieve or share the asset.
 *
 * @example
 * {
 *   assetId: "ba7c9f12-3e4a-4d91-a3e2-0d8f2e3c1b5a",
 *   jobId: "abc-123",
 *   publicUrl: "https://cdn.bidwar.app/buzz/ba7c9f12.png",
 *   storageProvider: "cloudflare-r2",
 *   bucket: "buzz-studio-assets",
 *   storagePath: "generated/2026/06/ba7c9f12.png",
 *   fileSizeBytes: 184320,
 *   createdAt: "2026-06-18T12:34:56.789Z"
 * }
 */
export interface StoredAsset {
  /**
   * Unique identifier for this stored asset.
   * Used as the primary key in storage and as the basis for share URLs.
   * Recommended format: UUID v4.
   */
  assetId: string;

  /**
   * The jobId of the RenderJob that produced this asset.
   * Links back through the pipeline for auditing and re-generation.
   */
  jobId?: string;

  /**
   * Publicly accessible URL for this asset.
   * Populated after the storage provider confirms the upload.
   * This URL is what gets embedded in ShareMetadata.publicUrl.
   *
   * Examples:
   *   "https://cdn.bidwar.app/buzz/ba7c9f12.png"
   *   "https://r2.bidwar.app/assets/ba7c9f12.png"
   */
  publicUrl?: string;

  /**
   * Identifier of the storage provider that holds this asset.
   * Informational — used for provider-specific operations and debugging.
   *
   * Examples: "cloudflare-r2", "aws-s3", "firebase-storage", "local-fs"
   */
  storageProvider?: string;

  /**
   * Storage bucket or container name.
   * Provider-specific. Used for direct storage SDK operations.
   */
  bucket?: string;

  /**
   * Path within the bucket / container.
   * Example: "generated/2026/06/ba7c9f12.png"
   */
  storagePath?: string;

  /**
   * MIME type of the stored file.
   * e.g. "image/png", "image/jpeg", "image/webp"
   */
  mimeType?: string;

  /**
   * File size in bytes. Used for quota tracking and analytics.
   */
  fileSizeBytes?: number;

  /**
   * ISO 8601 timestamp when this asset was stored.
   */
  createdAt?: string;

  /**
   * ISO 8601 expiry timestamp.
   * When set, the storage provider may automatically delete the asset.
   * Useful for temporary share assets vs permanent tournament archives.
   */
  expiresAt?: string;
}

/* ─── AssetStorageProvider ───────────────────────────────────────────────── */

/**
 * Provider identity metadata.
 * Future AssetStorageAdapter interface will extend this.
 *
 * Named providers at integration time:
 *   "cloudflare-r2"   — preferred, zero egress cost
 *   "aws-s3"          — fallback, wide ecosystem
 *   "firebase-storage" — if existing Firebase project is in use
 *   "local-fs"        — development / self-hosted
 */
export interface AssetStorageProvider {
  /**
   * Machine-readable provider identifier.
   * Must be stable — used as a discriminant in storage routing logic.
   *
   * Examples: "cloudflare-r2", "aws-s3", "firebase-storage", "local-fs"
   */
  name: string;

  /**
   * Human-readable display name.
   * Example: "Cloudflare R2", "Amazon S3"
   */
  displayName?: string;

  /**
   * Whether this provider supports public URL generation.
   * If false, a CDN proxy or signed URL must be used.
   */
  supportsPublicUrl?: boolean;

  /**
   * Whether this provider supports automatic expiry (TTL on objects).
   * Determines whether StoredAsset.expiresAt will be honoured.
   */
  supportsTtl?: boolean;
}
