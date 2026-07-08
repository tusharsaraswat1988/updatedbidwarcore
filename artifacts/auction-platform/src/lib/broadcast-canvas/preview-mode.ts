export type BroadcastCanvasMode = "production" | "developer";

export type CanvasScaleMode = "fit" | "actual" | "75" | "50";

export type CanvasDisplayMode =
  | "desktop"
  | "led-vertical"
  | "led-horizontal"
  | "mobile";

export type CanvasGuideOverlay = "safe" | "grid" | "center";

export type BroadcastCanvasPreviewState = {
  /** Production = LED-only. Developer = preview tools via ?dev=1 */
  mode: BroadcastCanvasMode;
  scaleMode: CanvasScaleMode;
  displayMode: CanvasDisplayMode;
  guides: Set<CanvasGuideOverlay>;
  showPreviewControls: boolean;
};

const DEFAULT_STATE: BroadcastCanvasPreviewState = {
  mode: "production",
  scaleMode: "fit",
  displayMode: "led-vertical",
  guides: new Set(),
  showPreviewControls: false,
};

export function isDeveloperMode(state: BroadcastCanvasPreviewState): boolean {
  return state.mode === "developer";
}

/**
 * Parse canvas runtime mode from URL.
 * Production is default — developer tools require explicit ?dev=1
 */
export function parseBroadcastCanvasPreview(
  search: string,
): BroadcastCanvasPreviewState {
  const params = new URLSearchParams(search);
  const scaleRaw = params.get("scale");
  const displayRaw = params.get("display");
  const guidesRaw = params.get("guides");
  const devRaw = params.get("dev") ?? params.get("previewControls");

  const mode: BroadcastCanvasMode =
    devRaw === "1" || devRaw === "true" ? "developer" : "production";

  const scaleMode: CanvasScaleMode =
    scaleRaw === "actual" || scaleRaw === "75" || scaleRaw === "50"
      ? scaleRaw
      : "fit";

  const displayMode: CanvasDisplayMode =
    displayRaw === "desktop" ||
    displayRaw === "led-horizontal" ||
    displayRaw === "mobile"
      ? displayRaw
      : "led-vertical";

  const guides = new Set<CanvasGuideOverlay>();
  if (mode === "developer" && guidesRaw) {
    for (const token of guidesRaw.split(",")) {
      const t = token.trim();
      if (t === "safe" || t === "grid" || t === "center") {
        guides.add(t);
      }
    }
  }

  return {
    mode,
    scaleMode,
    displayMode,
    guides,
    showPreviewControls: mode === "developer",
  };
}

export function resolveCanvasScale(
  viewportWidth: number,
  viewportHeight: number,
  scaleMode: CanvasScaleMode,
  canvasWidth = 1080,
  canvasHeight = 1920,
): number {
  const fitScale = Math.min(
    viewportWidth / canvasWidth,
    viewportHeight / canvasHeight,
  );

  switch (scaleMode) {
    case "actual":
      return 1;
    case "75":
      return 0.75;
    case "50":
      return 0.5;
    case "fit":
    default:
      return fitScale > 0 ? fitScale : 1;
  }
}

export function buildPreviewSearchParams(
  state: BroadcastCanvasPreviewState,
): string {
  const params = new URLSearchParams();
  if (state.mode === "developer") params.set("dev", "1");
  if (state.scaleMode !== "fit") params.set("scale", state.scaleMode);
  if (state.displayMode !== "led-vertical") {
    params.set("display", state.displayMode);
  }
  if (state.guides.size > 0) {
    params.set("guides", [...state.guides].join(","));
  }
  return params.toString();
}

export { DEFAULT_STATE };
