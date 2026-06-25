/**
 * Buzz Studio — Render context for preview vs PNG export.
 *
 * Templates receive renderMode + canvas dimensions to produce full-bleed posters
 * instead of centered preview cards.
 */

export type BuzzRenderMode = "preview" | "export";

export type BuzzAspectRatio = "1:1" | "4:5" | "9:16" | "16:9";

export const BUZZ_EXPORT_DIMENSIONS: Record<BuzzAspectRatio, { width: number; height: number }> = {
  "1:1": { width: 1080, height: 1080 },
  "4:5": { width: 1080, height: 1350 },
  "9:16": { width: 1080, height: 1920 },
  "16:9": { width: 1920, height: 1080 },
};

export interface BuzzTemplateRenderProps {
  renderMode?: BuzzRenderMode;
  aspectRatio?: BuzzAspectRatio | string;
  renderWidth?: number;
  renderHeight?: number;
  /**
   * Top Buys only — use absolute zones calibrated to the template-specific
   * background frames (uploaded separately from global backgrounds).
   */
  featuredFrameLayout?: boolean;
}

export interface BuzzRenderContext extends Required<BuzzTemplateRenderProps> {
  aspectRatio: BuzzAspectRatio;
}

export function isBuzzAspectRatio(value: string): value is BuzzAspectRatio {
  return value === "1:1" || value === "4:5" || value === "9:16" || value === "16:9";
}

export function resolveBuzzExportDimensions(aspectRatio: string): BuzzRenderContext {
  if (!isBuzzAspectRatio(aspectRatio)) {
    throw new Error(`Unsupported aspect ratio: ${aspectRatio}`);
  }
  const size = BUZZ_EXPORT_DIMENSIONS[aspectRatio];
  return {
    renderMode: "export",
    aspectRatio,
    renderWidth: size.width,
    renderHeight: size.height,
  };
}

export function hasRenderFrame(props: BuzzTemplateRenderProps): props is BuzzRenderContext {
  return (
    typeof props.renderWidth === "number" &&
    typeof props.renderHeight === "number" &&
    typeof props.aspectRatio === "string" &&
    isBuzzAspectRatio(props.aspectRatio)
  );
}

/** Scale a value as a fraction of canvas height, optionally clamped. */
export function canvasH(
  renderHeight: number,
  fraction: number,
  min?: number,
  max?: number,
): number {
  let value = Math.round(renderHeight * fraction);
  if (min != null) value = Math.max(min, value);
  if (max != null) value = Math.min(max, value);
  return value;
}

/** Scale a value as a fraction of canvas width, optionally clamped. */
export function canvasW(
  renderWidth: number,
  fraction: number,
  min?: number,
  max?: number,
): number {
  let value = Math.round(renderWidth * fraction);
  if (min != null) value = Math.max(min, value);
  if (max != null) value = Math.min(max, value);
  return value;
}

export function pickRenderContext(props: BuzzTemplateRenderProps): BuzzRenderContext | null {
  if (!hasRenderFrame(props)) return null;
  return {
    renderMode: props.renderMode ?? "export",
    aspectRatio: props.aspectRatio,
    renderWidth: props.renderWidth,
    renderHeight: props.renderHeight,
  };
}
