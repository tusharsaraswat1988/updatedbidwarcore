/** Supported Buzz Studio creative aspect ratios and output pixel dimensions. */
export const SUPPORTED_ASPECT_RATIOS = ["1:1", "4:5", "9:16", "16:9"] as const;
export type SupportedAspectRatio = (typeof SUPPORTED_ASPECT_RATIOS)[number];

export interface RenderDimensions {
  width: number;
  height: number;
  aspectRatio: SupportedAspectRatio;
}

const DIMENSION_MAP: Record<SupportedAspectRatio, { width: number; height: number }> = {
  "1:1": { width: 1080, height: 1080 },
  "4:5": { width: 1080, height: 1350 },
  "9:16": { width: 1080, height: 1920 },
  "16:9": { width: 1920, height: 1080 },
};

export function isSupportedAspectRatio(value: string): value is SupportedAspectRatio {
  return (SUPPORTED_ASPECT_RATIOS as readonly string[]).includes(value);
}

export function resolveRenderDimensions(aspectRatio: string): RenderDimensions {
  if (!isSupportedAspectRatio(aspectRatio)) {
    throw new Error(`Unsupported aspect ratio: ${aspectRatio}. Use 1:1, 4:5, 9:16, or 16:9.`);
  }
  const size = DIMENSION_MAP[aspectRatio];
  return { ...size, aspectRatio };
}
