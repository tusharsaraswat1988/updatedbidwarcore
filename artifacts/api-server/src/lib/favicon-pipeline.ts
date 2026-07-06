import type { FaviconPipelineMetadata } from "@workspace/api-base/branding-assets";
import { FAVICON_GENERATED_SIZE_KEYS } from "@workspace/api-base/branding-assets";
import { fetchImageBuffer } from "./pdf-branding.js";
import { uploadBufferToCloudinary, destroyCloudinaryAssetSafe } from "./cloudinary-media-service.js";
import { sharpToBuffer } from "./sharp-pipeline.js";
import { logger } from "./logger.js";

const GENERATED_FOLDER = "bidwar/branding/favicon/generated";

function parsePipelineMetadata(raw: unknown): FaviconPipelineMetadata | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const status = obj.status;
  if (
    status !== "pending"
    && status !== "processing"
    && status !== "completed"
    && status !== "failed"
  ) {
    return null;
  }
  return raw as FaviconPipelineMetadata;
}

export function coerceFaviconPipelineMetadata(
  raw: unknown,
): FaviconPipelineMetadata | null {
  return parsePipelineMetadata(raw);
}

async function destroyGeneratedVariant(
  variant: { publicId?: string } | undefined,
): Promise<void> {
  if (!variant?.publicId) return;
  await destroyCloudinaryAssetSafe(variant.publicId, logger, {
    route: "favicon-pipeline.cleanup",
  });
}

async function cleanupPreviousGenerated(
  previous: FaviconPipelineMetadata | null | undefined,
): Promise<void> {
  const generated = previous?.generated;
  if (!generated) return;
  await Promise.all([
    destroyGeneratedVariant(generated["16"]),
    destroyGeneratedVariant(generated["32"]),
    destroyGeneratedVariant(generated["48"]),
    destroyGeneratedVariant(generated.ico),
  ]);
}

async function resizePng(sourceBuffer: Buffer, size: number): Promise<Buffer> {
  return sharpToBuffer(sourceBuffer, (pipeline) =>
    pipeline.resize(size, size, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    }).png(),
  );
}

export async function runFaviconPipeline(input: {
  sourceUrl: string;
  sourceVersion: number;
  previousMetadata?: FaviconPipelineMetadata | null;
}): Promise<FaviconPipelineMetadata> {
  const startedAt = new Date().toISOString();
  const base: FaviconPipelineMetadata = {
    status: "processing",
    sourceVersion: input.sourceVersion,
    startedAt,
    error: null,
  };

  logger.info(
    { sourceVersion: input.sourceVersion, sourceUrl: input.sourceUrl },
    "Favicon pipeline: started",
  );

  try {
    const sourceBuffer = await fetchImageBuffer(input.sourceUrl);
    if (!sourceBuffer) {
      throw new Error("Could not download favicon source image");
    }

    const generated: NonNullable<FaviconPipelineMetadata["generated"]> = {};

    for (const size of FAVICON_GENERATED_SIZE_KEYS) {
      const pngBuffer = await resizePng(sourceBuffer, size);
      const uploaded = await uploadBufferToCloudinary(pngBuffer, {
        folder: GENERATED_FOLDER,
        public_id: `favicon-${size}-v${input.sourceVersion}`,
        overwrite: true,
        resource_type: "image",
        format: "png",
      });

      generated[String(size) as "16" | "32" | "48"] = {
        url: uploaded.url,
        publicId: uploaded.publicId,
        width: size,
        height: size,
      };
    }

    const icoBuffer = await resizePng(sourceBuffer, 32);
    const icoUploaded = await uploadBufferToCloudinary(icoBuffer, {
      folder: GENERATED_FOLDER,
      public_id: `favicon-ico-v${input.sourceVersion}`,
      overwrite: true,
      resource_type: "image",
      format: "png",
    });
    generated.ico = {
      url: icoUploaded.url,
      publicId: icoUploaded.publicId,
      width: 32,
      height: 32,
    };

    await cleanupPreviousGenerated(input.previousMetadata);

    const completed: FaviconPipelineMetadata = {
      ...base,
      status: "completed",
      completedAt: new Date().toISOString(),
      generated,
      error: null,
    };

    logger.info(
      {
        sourceVersion: input.sourceVersion,
        sizes: FAVICON_GENERATED_SIZE_KEYS,
      },
      "Favicon pipeline: completed",
    );

    return completed;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Favicon generation failed";
    logger.error(
      { err, sourceUrl: input.sourceUrl, sourceVersion: input.sourceVersion },
      "Favicon pipeline: failed",
    );
    return {
      ...base,
      status: "failed",
      error: message,
      completedAt: new Date().toISOString(),
    };
  }
}

export function needsFaviconPipelineRun(
  assetVersion: number,
  metadata: FaviconPipelineMetadata | null | undefined,
): boolean {
  if (!metadata) return true;
  if (metadata.sourceVersion !== assetVersion) return true;
  if (metadata.status === "failed") return true;
  if (metadata.status === "pending") return true;
  if (metadata.status === "processing") return true;
  if (metadata.status === "completed") {
    const g = metadata.generated;
    return !(g?.["16"] && g?.["32"] && g?.["48"] && g?.ico);
  }
  return true;
}

export function initialFaviconPipelineMetadata(sourceVersion: number): FaviconPipelineMetadata {
  return {
    status: "pending",
    sourceVersion,
    startedAt: new Date().toISOString(),
    error: null,
  };
}
